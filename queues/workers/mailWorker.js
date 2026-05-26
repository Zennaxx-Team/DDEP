const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { connection } = require('../config/queuesConfigartion');
const mailQueueConfig = require('../config/email.config');
const log_historyModel = require('../../models/log_history.model');
const alert_historyModel = require('../../models/alert_history.model');
const alert_history_debugModel = require('../../models/alert_history_debug.model');

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

async function startMailWorker() {
    const mailWorker = new Worker(mailQueueConfig.name, async (job) => {
        console.log(`Processing job ${job.id}:`);

        const { smtpConfig, mailConfig, successDescription, errorDescription, queueId, logDataConnect, logDataSend } = job.data;

        if (!smtpConfig || !mailConfig || !queueId || !logDataConnect || !logDataSend) {
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
            return successDescription;
        } catch (error) {
            throw new Error(`${errorDescription || 'Mail failed:'} ${error.message}`);
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

    const logUpdateWorker = new Worker(mailQueueConfig.name_mail_log_update, async job => {
        const { queueId, action, description } = job.data;

        const maxWaitTime = 20 * 60 * 1000; // Maximum 20 minutes
        const startTime = Date.now();
        let attempt = 0;

        while (Date.now() - startTime < maxWaitTime) {
            attempt++;

            try {
                const result = await log_historyModel.updateOne(
                    { queueId, action },
                    { $set: { description, updatedAt: new Date() } }
                );

                if (result.matchedCount > 0) {
                    console.log(`[Log Update] Success after ${attempt} attempts: queueId=${queueId}, action=${action}`);
                    return;
                }

                console.log(`[Log Update] Attempt ${attempt}: Record not found yet, waiting... queueId=${queueId}, action=${action}`);

            } catch (error) {
                console.error(`[Log Update] Attempt ${attempt} error: ${error.message}`);
            }

            // Wait 3 seconds before next attempt
            await new Promise(resolve => setTimeout(resolve, 3000));
        }

        throw new Error(`Failed to update log after ${attempt} attempts in 20 minutes: queueId=${queueId}, action=${action}`);
    }, {
        connection,
        concurrency: 1,
        attempts: 1
    });

    logUpdateWorker.on('failed', (job, err) => {
        console.error(`[Log Update] Final failure: queueId=${job.data.queueId}, error=${err.message}`);
    });
}

async function startMailActionWorker() {
    const mailWorker = new Worker(mailQueueConfig.name_action_mail, async (job) => {
        console.log(`Processing job ${job.id}:`);

        const { smtpConfig, mailConfig, successDescription, errorDescription } = job.data;

        if (!smtpConfig || !mailConfig) {
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
            return successDescription;
        } catch (error) {
            throw new Error(`${errorDescription || 'Mail failed:'} ${error.message}`);
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
}

async function startMailAlertnWorker() {
    const mailWorker = new Worker(mailQueueConfig.name_alert_mail, async (job) => {
        console.log(`Processing job ${job.id}:`);

        const { smtpConfig, mailConfig, successDescription, errorDescription } = job.data;

        if (!smtpConfig || !mailConfig) {
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
            return successDescription;
        } catch (error) {
            throw new Error(`${errorDescription || 'Mail failed:'} ${error.message}`);
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

    const logHistoryUpdateWorker = new Worker(mailQueueConfig.name_mail_history_log_update, async job => {
            const { queueId, action, description } = job.data;

            const maxWaitTime = 20 * 60 * 1000; // 20 minutes
            const startTime = Date.now();
            let attempt = 0;

            while (Date.now() - startTime < maxWaitTime) {
                attempt++;

                try {
                    const mainResult = await alert_historyModel.updateOne(
                        { queueId, action },
                        { $set: { description, updatedAt: new Date() } }
                    );

                    if (mainResult.matchedCount > 0) {

                        try {
                            const debugResult = await alert_history_debugModel.updateOne(
                                { queueId, action },
                                { $set: { description, updatedAt: new Date() } }
                            );

                            if (debugResult.matchedCount > 0) {
                                console.log(
                                    `[Log Update] Alert History Debug log updated: queueId=${queueId}, action=${action}`
                                );
                            }
                        } catch (err) {
                            console.warn(
                                `[Log Update] Alert History Debug debug update failed (ignored): ${err.message}`
                            );
                        }

                        console.log(
                            `[Log Update] Alert History Success after ${attempt} attempts: queueId=${queueId}, action=${action}`
                        );
                        return;
                    }

                    console.log(
                        `[Log Update] Alert History Attempt ${attempt}: Main record not found yet, waiting... queueId=${queueId}, action=${action}`
                    );

                } catch (error) {
                    console.error(
                        `[Log Update] Alert History Attempt ${attempt} error: ${error.message}`
                    );
                }

                // wait 3 seconds
                await new Promise(resolve => setTimeout(resolve, 3000));
            }

            throw new Error(
                `Failed to update alert_history after ${attempt} attempts in 20 minutes: queueId=${queueId}, action=${action}`
            );
        },
        {
            connection,
            concurrency: 1,
            attempts: 1
        }
    );


    logHistoryUpdateWorker.on('failed', (job, err) => {
        console.error(`[Log Update] Final failure: queueId=${job.data.queueId}, error=${err.message}`);
    });
}

module.exports = {
    startMailWorker,
    startMailActionWorker,
    startMailAlertnWorker
};
