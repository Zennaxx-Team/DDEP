const { QueueEvents, Job, Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { connection } = require('../config/queuesConfigartion');
const mailQueueConfig = require('../config/email.config');
const emailFailureModel = require("../../models/email_failures.model");

// Cache for Nodemailer transporters based on smtpConfig
const transporterCache = new Map();

function getTransporter(smtpConfig) {
    // Create a cache key from smtpConfig (stringify to handle object comparison)
    const cacheKey = JSON.stringify(smtpConfig);

    // Return cached transporter if it exists
    if (transporterCache.has(cacheKey)) {
        return transporterCache.get(cacheKey);
    }

    // Create new transporter with pooling
    const transporter = nodemailer.createTransport({
        ...smtpConfig,
        pool: true, // Enable connection pooling
        maxConnections: 5, // Limit concurrent connections
        maxMessages: 100, // Limit messages per connection
    });

    // Cache the transporter
    transporterCache.set(cacheKey, transporter);

    // Clean up cache if it grows too large (e.g., > 50 configs)
    if (transporterCache.size > 50) {
        const oldestKey = transporterCache.keys().next().value;
        const oldTransporter = transporterCache.get(oldestKey);
        oldTransporter.close(); // Close SMTP connections
        transporterCache.delete(oldestKey);
    }

    return transporter;
}

async function startResendWorker() {
    const mailWorker = new Worker(mailQueueConfig.resend_name, async (job) => {
        console.log(`Processing job ${job.id}:`);

        const { smtpConfig, mailConfig, emailId, queueId } = job.data;

        if (!smtpConfig || !mailConfig || !queueId || !emailId) {
            throw new Error(`Invalid job data for job ${job.id}`);
        }

        try {
            const transporter = getTransporter(smtpConfig);

            // Verify transporter (skip if already verified in cache)
            const cacheKey = JSON.stringify(smtpConfig);
            if (!transporterCache.has(cacheKey)) {
                await transporter.verify();
                console.log(`[Nodemailer] Verified transporter for job ${job.id}`);
            }
            const info = await transporter.sendMail(mailConfig);
            console.log(info, "info");
            return { status: 'Email Sent', messageId: info.messageId, emailId, queueId, mailConfig };
        } catch (error) {
            console.log(error, "error");
            throw new Error(JSON.stringify({
                status: 'Fail',
                message: error.message,
                emailId,
                queueId,
                mailConfig
            }));
        }
    }, {
        connection,
        concurrency: mailQueueConfig.concurrency || 1,
        limiter: mailQueueConfig.limiter || {
            max: 1,
            duration: 3000
        },
        settings: {
            stallInterval: 60000,
            retryProcessDelay: mailQueueConfig.retryDelay || 5000
        },
        attempts: mailQueueConfig.attempts || 3
    });

    let queueResendEvents;

    async function setupResendQueueEvents() {
        if (queueResendEvents) {
            await queueResendEvents.close();
        }
        queueResendEvents = new QueueEvents(mailQueueConfig.resend_name, { connection });

        queueResendEvents.on('error', (err) => {
            console.error(`[QueueEvents] Error: ${err.message}`);
            setTimeout(() => {
                console.log('[QueueEvents] Attempting to reconnect...');
                setupResendQueueEvents();
            }, 5000);
        });

        queueResendEvents.on('completed', async ({ jobId, returnvalue }) => {
            try {
                console.log(jobId, "jobId", returnvalue, "returnvalue");
                if (!returnvalue?.emailId) return;

                const successMessage = `Successful Email to ${returnvalue.mailConfig.to} : Success`;

                await emailFailureModel.updateOne(
                    { _id: returnvalue.emailId },
                    {
                        $set: {
                            resendMessage: successMessage,
                            latestStatus: 'Success',
                            dateTime: new Date(),
                        },
                        $inc: { resendTime: 1 }
                    }
                );

                console.log(`[QueueEvents] Job ${jobId} succeeded, DB updated.`);
            } catch (err) {
                console.error(`[QueueEvents] Completed handler error:`, err);
            }
        });

        queueResendEvents.on('failed', async ({ jobId, failedReason }) => {
            try {
                let parsedError;
                try {
                    parsedError = JSON.parse(failedReason); // extract originalEmailId
                } catch {
                    parsedError = { message: failedReason };
                }
                console.log(parsedError, "parsedError");

                if (!parsedError.emailId) return;

                const failMessage = `Failure Email to ${parsedError.mailConfig?.to || ''} : Fail : Error : ${parsedError.message || failedReason}`;

                await emailFailureModel.updateOne(
                    { _id: parsedError.emailId },
                    {
                        $set: {
                            latestStatus: 'Fail',
                            dateTime: new Date(),
                            resendMessage: failMessage
                        },
                        $inc: { resendTime: 1 }
                    }
                );

                console.log(`[QueueEvents] Job ${jobId} failed, DB updated.`);
            } catch (err) {
                console.error(err);
            }
        });


        await queueResendEvents.waitUntilReady();
    }

    await setupResendQueueEvents();
}

module.exports = {
    startResendWorker
};
