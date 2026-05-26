const jwtDecode = require("jwt-decode");
const config = require("../config");
const alerthistoryModel = require("../models/alert_history.model");
const email_failuresModel = require("../models/email_failures.model");
const { updateHistoryLogDescription } = require("../queues/helper/logHelpers");
const { convertIfJSON } = require("./log_history.controller");
const { default: axios } = require("axios");
const alert_history_debugModel = require("../models/alert_history_debug.model");

const extractUserInfoFromToken = (cookies) => {
    if (cookies && cookies.Token && process.env.EnableGima === "true") {
        const decoded = jwtDecode(cookies.Token);

        return {
            companyCode: decoded.company_code,
            userName: decoded.username
        };
    }

    return {
        companyCode: config.companyCode,
        userName: config.userName
    };
};

const list = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);

        const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
        const page = Math.max(parseInt(req.body.page) || 1, 1);
        const skipRecord = (page - 1) * limitRecord;

        const matchStage = { companyCode };

        if (req.body.fromDate && req.body.toDate) {
            const from = new Date(req.body.fromDate);
            const to = new Date(req.body.toDate);
            matchStage.createdAt = { $gte: from, $lte: to };
        }

        /* ================= BASE PIPELINE ================= */
        const basePipeline = [
            {
                $match: matchStage
            },

            { $sort: { createdAt: 1 } },

            /* ================= GROUP ================= */
            {
                $group: {
                    _id: "$unique_id",

                    policyName: { $first: "$policyName" },
                    conditionName: { $first: "$conditionName" },
                    ruleName: { $first: "$ruleName" },

                    startTime: { $first: "$createdAt" },
                    endTime: { $last: "$createdAt" },

                    notifyType: {
                        $max: {
                            $cond: [
                                { $in: ["$notifyMethod", ["Email", "Webhook"]] },
                                "$notifyMethod",
                                null
                            ]
                        }
                    },

                    httpStatusCode: {
                        $max: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$httpStatus", null] },
                                        {
                                            $in: [
                                                "$action",
                                                ["Webhook API Response", "Webhook API Response Size", "Webhook Error"]
                                            ]
                                        }
                                    ]
                                },
                                { $toInt: "$httpStatus" },
                                null
                            ]
                        }
                    },


                    /* -------- API / SYSTEM / TIMEOUT ERROR -------- */
                    hasApiError: {
                        $max: {
                            $cond: [
                                {
                                    $in: [
                                        "$exception_type",
                                        ["API Error", "System Error", "Webhook Error"]
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    },

                    /* -------- EMAIL SUCCESS -------- */
                    emailSuccess: {
                        $max: {
                            $cond: [
                                {
                                    $and: [
                                        { $eq: ["$notifyMethod", "Email"] },
                                        { $eq: ["$action", "Email Send"] },
                                        {
                                            $regexMatch: {
                                                input: "$description",
                                                regex: /success/i
                                            }
                                        }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },

            /* ================= ADD FIELDS ================= */
            {
                $addFields: {
                    timeConsumedMs: {
                        $subtract: ["$endTime", "$startTime"]
                    },

                    result: {
                        $switch: {
                            branches: [
                                /* -------- EMAIL -------- */
                                {
                                    case: { $eq: ["$notifyType", "Email"] },
                                    then: {
                                        $cond: [
                                            {
                                                $or: [
                                                    { $eq: ["$hasApiError", 1] },
                                                    { $eq: ["$emailSuccess", 0] }
                                                ]
                                            },
                                            "Fail",
                                            "Success"
                                        ]
                                    }
                                },

                                /* -------- WEBHOOK -------- */
                                {
                                    case: { $eq: ["$notifyType", "Webhook"] },
                                    then: {
                                        $cond: [
                                            {
                                                $or: [
                                                    { $eq: ["$hasApiError", 1] },
                                                    { $lt: ["$httpStatusCode", 200] },
                                                    { $gt: ["$httpStatusCode", 208] }
                                                ]
                                            },
                                            "Fail",
                                            "Success"
                                        ]
                                    }
                                }
                            ],
                            default: "Fail"
                        }
                    }
                }
            },

            { $sort: { endTime: -1 } }
        ];

        const totalAggregation = await alerthistoryModel.aggregate([
            ...basePipeline,
            { $count: "total" }
        ]);

        const total = totalAggregation[0]?.total || 0;

        const data = await alerthistoryModel.aggregate([
            ...basePipeline,
            { $skip: skipRecord },
            { $limit: limitRecord }
        ]);

        return res.status(200).send({
            status: 1,
            message: "Alert History retrieved successfully!",
            data,
            total
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const detail = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { id: unique_id } = req.params;

        if (!unique_id) {
            return res.status(400).json({
                status: 0,
                message: "Invalid alert history ID"
            });
        }

        const data = await alerthistoryModel.aggregate([
            {
                $match: { unique_id, companyCode }
            },
            { $sort: { createdAt: 1 } },

            {
                $group: {
                    _id: "$unique_id",

                    policyName: { $first: "$policyName" },
                    conditionName: { $first: "$conditionName" },
                    ruleName: { $first: "$ruleName" },
                    securityLevel: { $first: "$securityLevel" },
                    triggerBy: { $first: "$trigger_by" },
                    log_unique_id: { $first: "$log_unique_id" },
                    startTime: { $first: "$createdAt" },
                    endTime: { $last: "$createdAt" },

                    notifyTypes: {
                        $addToSet: "$notifyMethod"
                    },

                    logs: {
                        $push: {
                            action: "$action",
                            description: "$description",
                            datas: "$datas",
                            httpStatus: "$httpStatus",
                            queueId: "$queueId",
                            notifyMethod: "$notifyMethod"
                        }
                    },
                    hasApiError: {
                        $max: {
                            $cond: [
                                {
                                    $in: [
                                        "$exception_type",
                                        ["API Error", "System Error"]
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                }
            },

            {
                $project: {
                    _id: 0,

                    /* ================= META ================= */
                    meta: {
                        unique_id: "$_id",
                        policyName: "$policyName",
                        conditionName: "$conditionName",
                        ruleName: "$ruleName",
                        security: "$securityLevel",
                        triggerBy: "$triggerBy",
                        log_unique_id: "$log_unique_id",
                        startTime: "$startTime",
                        endTime: "$endTime",
                        timeConsumedMs: {
                            $subtract: ["$endTime", "$startTime"]
                        },

                        notifyType: {
                            $reduce: {
                                input: {
                                    $filter: {
                                        input: "$notifyTypes",
                                        as: "n",
                                        cond: { $ne: ["$$n", null] }
                                    }
                                },
                                initialValue: "",
                                in: {
                                    $cond: [
                                        { $eq: ["$$value", ""] },
                                        "$$this",
                                        { $concat: ["$$value", ", ", "$$this"] }
                                    ]
                                }
                            }
                        },
                        httpStatus: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: {
                                                    $and: [
                                                        { $ne: ["$$l.httpStatus", null] },
                                                        {
                                                            $in: [
                                                                "$$l.action",
                                                                ["Webhook API Response", "Webhook API Response Size", "API Error", "System Error", "Webhook Error"]
                                                            ]
                                                        }
                                                    ]
                                                }
                                            }
                                        },
                                        as: "h",
                                        in: { $toInt: "$$h.httpStatus" }
                                    }
                                },
                                -1
                            ]
                        }
                        ,

                        hasApiError: {
                            $eq: ["$hasApiError", 1]
                        },

                        emailStatus: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: { $eq: ["$$l.action", "Email Send"] }
                                            }
                                        },
                                        as: "e",
                                        in: "$$e.description"
                                    }
                                },
                                -1
                            ]
                        }
                    },

                    /* ================= RULE ================= */
                    rule: {
                        matched: {
                            $gt: [
                                {
                                    $size: {
                                        $filter: {
                                            input: "$logs",
                                            as: "l",
                                            cond: { $eq: ["$$l.action", "Monitor Rules Matched"] }
                                        }
                                    }
                                },
                                0
                            ]
                        },

                        sqlQuery: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: {
                                                    $in: [
                                                        "$$l.action",
                                                        ["Monitor Rules Query"]
                                                    ]
                                                }
                                            }
                                        },
                                        as: "r",
                                        in: "$$r.description"
                                    }
                                },
                                0
                            ]
                        },

                        sqlResult: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: {
                                                    $in: [
                                                        "$$l.action",
                                                        ["Monitor Rules Query Result"]
                                                    ]
                                                }
                                            }
                                        },
                                        as: "r",
                                        in: "$$r.description"
                                    }
                                },
                                0
                            ]
                        },

                        data: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: {
                                                    $in: [
                                                        "$$l.action",
                                                        ["Monitor Rules Matched", "Monitor Rules Not Matched"]
                                                    ]
                                                }
                                            }
                                        },
                                        as: "r",
                                        in: "$$r.datas"
                                    }
                                },
                                0
                            ]
                        }
                    },

                    /* ================= WEBHOOK ================= */
                    webhook: {
                        $cond: [
                            {
                                $gt: [{
                                    $size: {
                                        $filter: { input: "$logs", as: "l", cond: { $eq: ["$$l.notifyMethod", "Webhook"] } }
                                    }
                                }, 0]
                            },
                            {
                                url: {
                                    $arrayElemAt: [
                                        {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: "$logs",
                                                        as: "l",
                                                        cond: { $eq: ["$$l.description", "Webhook EndPoint URL"] }
                                                    }
                                                },
                                                as: "w",
                                                in: "$$w.datas"
                                            }
                                        },
                                        0
                                    ]
                                },

                                postData: {
                                    $arrayElemAt: [
                                        {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: "$logs",
                                                        as: "l",
                                                        cond: { $eq: ["$$l.action", "Webhook Post Data"] }
                                                    }
                                                },
                                                as: "w",
                                                in: "$$w.datas"
                                            }
                                        },
                                        0
                                    ]
                                },

                                curl: {
                                    $arrayElemAt: [
                                        {
                                            $map: {
                                                input: {
                                                    $filter: {
                                                        input: "$logs",
                                                        as: "l",
                                                        cond: { $eq: ["$$l.action", "Webhook CURL Bash"] }
                                                    }
                                                },
                                                as: "w",
                                                in: "$$w.datas"
                                            }
                                        },
                                        0
                                    ]
                                },

                                response: {
                                    httpStatus: {
                                        $arrayElemAt: [
                                            {
                                                $map: {
                                                    input: {
                                                        $filter: {
                                                            input: "$logs",
                                                            as: "l",
                                                            cond: {
                                                                $and: [
                                                                    {
                                                                        $in: [
                                                                            "$$l.action",
                                                                            ["Webhook API Response", "Webhook API Response Size", "Webhook Error"]
                                                                        ]
                                                                    },
                                                                    { $ne: ["$$l.httpStatus", null] }
                                                                ]
                                                            }
                                                        }
                                                    },
                                                    as: "r",
                                                    in: { $toInt: "$$r.httpStatus" }
                                                }
                                            },
                                            0
                                        ]
                                    },

                                    size: {
                                        $arrayElemAt: [
                                            {
                                                $map: {
                                                    input: {
                                                        $filter: {
                                                            input: "$logs",
                                                            as: "l",
                                                            cond: { $eq: ["$$l.action", "Webhook API Response Size"] }
                                                        }
                                                    },
                                                    as: "r",
                                                    in: "$$r.datas"
                                                }
                                            },
                                            0
                                        ]
                                    },

                                    body: {
                                        $arrayElemAt: [
                                            {
                                                $map: {
                                                    input: {
                                                        $filter: {
                                                            input: "$logs",
                                                            as: "l",
                                                            cond: { $eq: ["$$l.action", "Webhook API Response"] }
                                                        }
                                                    },
                                                    as: "r",
                                                    in: "$$r.datas"
                                                }
                                            },
                                            0
                                        ]
                                    }
                                }
                            },
                            "$$REMOVE"
                        ]
                    },

                    /* ================= EMAIL ================= */
                    email: {
                        subject: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: { $eq: ["$$l.description", "Email Subject"] }
                                            }
                                        },
                                        as: "e",
                                        in: "$$e.datas"
                                    }
                                },
                                0
                            ]
                        },

                        body: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: { $eq: ["$$l.description", "Email Body"] }
                                            }
                                        },
                                        as: "e",
                                        in: "$$e.datas"
                                    }
                                },
                                0
                            ]
                        },

                        to: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: { $eq: ["$$l.description", "Email To"] }
                                            }
                                        },
                                        as: "e",
                                        in: "$$e.datas"
                                    }
                                },
                                0
                            ]
                        },

                        queueId: {
                            $arrayElemAt: [
                                {
                                    $map: {
                                        input: {
                                            $filter: {
                                                input: "$logs",
                                                as: "l",
                                                cond: {
                                                    $in: [
                                                        "$$l.action",
                                                        ["Email Send", "Email Failure", "Email Connect"]
                                                    ]
                                                }
                                            }
                                        },
                                        as: "e",
                                        in: "$$e.queueId"
                                    }
                                },
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        if (!data.length) {
            return res.status(404).json({
                status: 0,
                message: "Alert history not found"
            });
        }

        return res.status(200).json({
            status: 1,
            message: "Alert history detail fetched successfully",
            data: data[0]
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const alertDetailsLogs = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { id: unique_id } = req.params;

        const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
        const page = Math.max(parseInt(req.body.page) || 1, 1);
        const skipRecord = (page - 1) * limitRecord;

        if (!unique_id) {
            return res.status(400).json({
                status: 0,
                message: "Invalid alert history ID"
            });
        }

        /* ---------------- BASE PIPELINE ---------------- */
        const basePipeline = [
            {
                $match: { unique_id, companyCode }
            },
            {
                $sort: { createdAt: 1, updatedAt: 1, _id: 1 }
            }
        ];

        /* ---------------- TOTAL COUNT ---------------- */
        const totalAggregation = await alerthistoryModel.aggregate([
            ...basePipeline,
            { $count: "total" }
        ]);

        const total = totalAggregation[0]?.total || 0;

        if (!total) {
            return res.status(404).json({
                status: 0,
                message: "Alert history not found"
            });
        }

        /* ---------------- PAGINATED DATA ---------------- */
        const data = await alerthistoryModel.aggregate([
            ...basePipeline,
            { $skip: skipRecord },
            { $limit: limitRecord }
        ]);

        return res.status(200).json({
            status: 1,
            message: "Alert history detail fetched successfully",
            data,
            total
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const bulkSaveHistory = async (logs, retries = 3, retryDelay = 500) => {
    try {
        const productionLogs = [];
        const debugLogs = [];

        logs.forEach(log => {
            // Production table: only matched rules (isDebugLog = false)
            if (log.isMatched !== false) {
                productionLogs.push(log);
            }

            // Debug table: ALL logs where isDebugLog = true (matched + non-matched)
            if (log.enableAlertDebug.toLowerCase() == "true") {
                debugLogs.push(log);
            }
        });

        const results = {
            production: { insertedCount: 0 },
            debug: { insertedCount: 0 }
        };

        // Save production logs to alert_histories (matched only)
        if (productionLogs.length > 0) {
            const sortedProdLogs = [...productionLogs].sort((a, b) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return (a._id?.toString() || '').localeCompare(b._id?.toString() || '');
            });

            const prodResult = await alerthistoryModel.insertMany(sortedProdLogs, {
                ordered: true,
                timestamps: false,
                writeConcern: { w: 1 },
            });

            results.production.insertedCount = prodResult.length;
            console.log(`[insertMany] Inserted ${prodResult.length} MATCHED logs to alert_histories`);
        }

        // Save debug logs to alert_histories_debug (matched + non-matched)
        if (debugLogs.length > 0) {
            const sortedDebugLogs = [...debugLogs].sort((a, b) => {
                const timeA = new Date(a.createdAt).getTime();
                const timeB = new Date(b.createdAt).getTime();
                if (timeA !== timeB) return timeA - timeB;
                return (a._id?.toString() || '').localeCompare(b._id?.toString() || '');
            });

            const debugResult = await alert_history_debugModel.insertMany(sortedDebugLogs, {
                ordered: true,
                timestamps: false,
                writeConcern: { w: 1 },
            });

            results.debug.insertedCount = debugResult.length;
            console.log(`[insertMany] Inserted ${debugResult.length} MATCHED+NON-MATCHED logs to alert_histories_debug`);
        }

        return {
            status: 1,
            ...results,
            totalInserted: (results.production.insertedCount + results.debug.insertedCount),
        };

    } catch (error) {
        console.error(`[insertMany Error]`, error.message);

        if (retries > 0) {
            console.warn(`Retrying bulkSaveHistory... attempts left: ${retries}`);
            await new Promise(resolve => setTimeout(resolve, retryDelay));
            return await bulkSaveHistory(logs, retries - 1, retryDelay);
        }

        return {
            status: 0,
            error,
        };
    }
}

const createFailedAlertMail = async ({ mailInfo, failedReason }) => {
    try {
        if (!mailInfo) {
            console.error("Invalid mailInfo or failedReason provided");
            return;
        }

        // Prepare data for the email failure record
        const emailData = {
            unique_id: mailInfo?.itemDetails?.unique_id || null,
            companyId: mailInfo?.itemDetails?.companyId.toString() || null,
            projectId: mailInfo?.itemDetails?.projectId.toString() || null,
            environmentId: mailInfo?.itemDetails?.environmentId.toString() || null,
            itemId: mailInfo?.itemDetails?.item_id.toString() || null,
            companyName: mailInfo?.itemDetails?.companyName || "",
            projectName: mailInfo?.itemDetails?.projectName || "",
            environmentName: mailInfo?.itemDetails?.environmentName || "",
            emailTo: mailInfo.mailConfig?.to || "",
            subject: mailInfo.mailConfig?.subject || "",
            content: mailInfo.mailConfig?.html || "",
            dateTime: new Date(),
            resendTime: 0,
            resendMessage: "",
            failureReason: failedReason || "Unknown Error",
            latestStatus: "Fail",
            mail_type: "alert_type",
            companyCode: mailInfo?.itemDetails?.CompanyCode || ""
        };

        // Create the email failure record
        const emailFailureRecord = await email_failuresModel.create(emailData);

        console.log("Email failure record created with ID:", emailFailureRecord._id);
    } catch (err) {
        console.error("Error in createFailedMail:", err);
    }
};

const excuteAlertEmailReturnUrl = async (infoData) => {
    try {
        const {
            itemId, uniqueId, itemName, entrypointURL, endpointURL,
            emailTo, emailSubject, body, transformedBody, responseBody,
            transformedResponseBody, emailHtml, dateTime, queueId,
            email_failures_return_url, action
        } = infoData;

        if (!email_failures_return_url) return;

        // Update log to indicate return URL will be called
        await updateHistoryLogDescription({
            queueId,
            action,
            description: "Return URL triggered"
        });

        const payload = {
            itemId, uniqueId, dateTime, itemName,
            entrypointURL, endpointURL, emailTo, emailSubject,
            body: convertIfJSON(body), transformedBody: convertIfJSON(transformedBody), responseBody: convertIfJSON(responseBody), transformedResponseBody: convertIfJSON(transformedResponseBody),
            emailHtml
        };

        console.log(payload, "payload");

        const returnUrlResponse = await callReturnUrl(email_failures_return_url, payload);

        // Handle response properly
        if (returnUrlResponse.success) {
            console.log(`[Return URL Success] ${email_failures_return_url}`, returnUrlResponse.data);
            await updateHistoryLogDescription({
                queueId,
                action,
                description: "Return URL Success"
            });
        } else {
            console.error(`[Return URL Failed] ${email_failures_return_url}`, returnUrlResponse.error);
            await updateHistoryLogDescription({
                queueId,
                action,
                description: `Return URL Failed: ${returnUrlResponse.errorMessage}`
            });
        }

    } catch (err) {
        console.error("Error in excuteEmailReturnUrl:", err);
        await updateHistoryLogDescription({
            queueId: infoData.queueId,
            action: infoData.action,
            description: `Exception: ${err.message}`
        });
    }
};

async function callReturnUrl(url, data) {
    try {
        const response = await axios({
            method: "POST",
            url,
            headers: { "Content-Type": "application/json" },
            data,
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        return {
            success: true,
            data: response.data,
            status: response.status,
            statusText: response.statusText
        };
    } catch (error) {
        let errorMessage = error.response?.data?.message || error.message || "Unknown error";
        return {
            success: false,
            error: error,
            errorMessage,
            status: error.response?.status || 500,
            statusText: error.response?.statusText || "Error"
        };
    }
}


module.exports = { list, detail, bulkSaveHistory, createFailedAlertMail, excuteAlertEmailReturnUrl, alertDetailsLogs };