const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const emailFailureModel = require("../models/email_failures.model");
const { getGeneralSetting } = require("./settings.controller");
const { v4: uuidv4 } = require("uuid");
const { failuresmailQueue } = require("../queues/config/queuesConfigartion");
const mailQueueConfig = require('../queues/config/email.config');
const { getNotificationSettings } = require("./notification.controller");

const extractUserInfoFromToken = (cookies) => {
    if (cookies && cookies.Token && process.env.EnableGima === "true") {
        const decoded = jwtDecode(cookies.Token);

        return {
            companyCode: decoded.company_code,
            userName: decoded.username,
        };
    }

    return {
        companyCode: config.companyCode,
        userName: config.userName,
    };
};

const getEmailFailures = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { page = 1, limit = 10, companyId, projectId, environmentId, itemId, fromDate, toDate } = req.body;

        // Base query
        let query = process.env.EnableGima === "true" ? { companyCode } : {};

        // Apply filters
        if (companyId && companyId !== 'all' && mongoose.Types.ObjectId.isValid(companyId)) {
            query.companyId = mongoose.Types.ObjectId(companyId);
        }
        if (projectId && projectId !== 'all') {
            query.projectId = projectId.trim() === "" ? null : mongoose.Types.ObjectId(projectId);
        }
        if (environmentId && environmentId !== 'all' && mongoose.Types.ObjectId.isValid(environmentId)) {
            query.environmentId = mongoose.Types.ObjectId(environmentId);
        }
        if (itemId && itemId !== 'all' && mongoose.Types.ObjectId.isValid(itemId)) {
            query.itemId = mongoose.Types.ObjectId(itemId);
        }
        if (fromDate && toDate) {
            const from = new Date(fromDate);
            const to = new Date(toDate);
            query.createdAt = { $gte: from, $lte: to };
        }

        // Pagination
        const limitRecord = Math.max(parseInt(limit), 1);
        const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

        // Fetch data with pagination and sort by creation date descending
        const logHistory = await emailFailureModel.aggregate([
            { $match: query },
            { $sort: { dateTime: -1 } },
            { $skip: skipRecord },
            { $limit: limitRecord },
            {
                $lookup: {
                    from: "items",
                    localField: "itemId",
                    foreignField: "_id",
                    as: "item_details",
                    pipeline: [{ $project: { ItemName: 1 } }]
                }
            },
            {
                $unwind: {
                    path: "$item_details",
                    preserveNullAndEmptyArrays: true
                }
            }

        ]);

        // Get total count for pagination
        const totalCount = await emailFailureModel.countDocuments(query);

        return res.status(200).send({
            status: 1,
            message: "Email failure records retrieved successfully!",
            data: logHistory,
            total: totalCount
        });
    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const resendFailedEmails = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { emailIds } = req.body;

        // Validate input
        if (!Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).send({ status: 0, message: "Invalid email IDs provided." });
        }

        // Filter valid ObjectIds
        const objectIdArray = emailIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => mongoose.Types.ObjectId(id));

        if (objectIdArray.length === 0) {
            return res.status(400).send({ status: 0, message: "No valid email IDs provided." });
        }

        // Get SMTP settings
        const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
        if (smtpResult.status !== 1 || smtpResult?.data?.smtpActive != "1") {
            return res.status(400).send({ status: 0, message: "SMTP is not active." });
        }

        // Get notification settings
        const notification = await getNotificationSettings(companyCode, "notification");
        if (notification.status !== 1) {
            return res.status(400).send({ status: 0, message: "Notification is not active." });
        }

        const providerName = notification.data.providerName;
        const queue = failuresmailQueue;

        // Configure SMTP
        const smtpSecure = smtpResult.data.smtpPort == 465;
        const smtpConfig = {
            host: smtpResult.data.smtpServer,
            port: smtpResult.data.smtpPort,
            secure: smtpSecure,
            auth: {
                user: smtpResult.data.smtpAccount,
                pass: smtpResult.data.smtpPassword
            },
            family: 4,
            pool: true,
            maxConnections: 20,
            maxMessages: 500,
            rateLimit: 10
        };

        // Fetch failed emails
        const email_failures = await emailFailureModel.find({
            _id: { $in: objectIdArray },
            companyCode
        });

        // Queue each email for resend
        for (const email of email_failures) {
            const emailId = email._id.toString();
            const queueId = `resend-${emailId}-${uuidv4()}`;
            const jobData = {
                queueId,
                emailId,
                smtpConfig,
                mailConfig: {
                    from: `${providerName} <${smtpResult.data.smtpEmail}>`,
                    to: email.emailTo,
                    subject: email.subject,
                    html: email.content
                }
            };

            await queue.add(mailQueueConfig.resend_name, jobData, {
                jobId: queueId,
                delay: 0,
                removeOnComplete: 10,
                removeOnFail: 10
            });
        }

        return res.status(200).send({
            status: 1,
            message: "Failed email(s) queued for resend successfully!"
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const deleteFailedEmails = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { emailIds } = req.body;

        // Validate input
        if (!Array.isArray(emailIds) || emailIds.length === 0) {
            return res.status(400).send({ status: 0, message: "Invalid email IDs provided." });
        }

        // Filter valid ObjectIds
        const objectIdArray = emailIds
            .filter(id => mongoose.Types.ObjectId.isValid(id))
            .map(id => mongoose.Types.ObjectId(id));

        if (objectIdArray.length === 0) {
            return res.status(400).send({ status: 0, message: "No valid email IDs provided." });
        }

        // Perform bulk delete
        const result = await emailFailureModel.deleteMany({
            _id: { $in: objectIdArray },
            companyCode
        });

        if (result.deletedCount === 0) {
            return res.status(404).send({
                status: 0,
                message: "No emails found to delete."
            });
        }

        return res.status(200).send({
            status: 1,
            message: `${result.deletedCount} email(s) deleted successfully!`
        });

    } catch (err) {
        console.error("Error deleting failed emails:", err);
        err.statusCode = 500;
        next(err);
    }
};


module.exports = { getEmailFailures, resendFailedEmails, deleteFailedEmails }