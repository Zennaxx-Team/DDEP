const mongoose = require('mongoose');
const { default: axios } = require("axios");
const { v4: uuidv4 } = require("uuid");
const Config = require('../../config');
const mailQueueConfig = require('../../queues/config/email.config');
const logHistory = require('../../models/log_history.model');
const { conditionListByCompanyCode } = require('../../controllers/alert_conditions.controller');
const { formulaGetValue, replacePlaceholders, getContentType, isNonEmptyObjectOrArray, generateCurlCommand, addToLogAlertQueue, processVariablesAndHeaders, processWebhookContent, buildFinalReturnUrl } = require('../../common/common');
const { getGeneralSetting } = require('../../controllers/settings.controller');
const { getNotificationSettings } = require('../../controllers/notification.controller');
const { safeJSONWithOutStringify } = require('../../my_modules/checkSize');
const { mailAlertQueue } = require('../../queues/config/queuesConfigartion');

function normalizeValue(val) {
    if (val === null || val === undefined) return null;

    // numeric check
    const num = Number(val);
    if (!isNaN(num) && val !== '') {
        return num;   // treat as number
    }

    return String(val); // treat as string
}

function normalizeInValues(value) {
    if (Array.isArray(value)) {
        return value.map(v => normalizeValue(v));
    }

    if (typeof value !== 'string') {
        return [normalizeValue(value)];
    }

    let str = value.trim();

    // remove surrounding ()
    if (str.startsWith('(') && str.endsWith(')')) {
        str = str.slice(1, -1);
    }

    return str
        .split(',')
        .map(v => v.trim())
        .map(v => v.replace(/^['"]|['"]$/g, ''))
        .map(v => normalizeValue(v))
        .filter(v => v !== null);
}

function castExpectedToActualType(actualValue, expectedValue) {
    if (actualValue === null || actualValue === undefined) return expectedValue;

    if (typeof actualValue === 'number') {
        const num = Number(expectedValue);
        return isNaN(num) ? expectedValue : num;
    }

    if (typeof actualValue === 'boolean') {
        if (expectedValue === 'true' || expectedValue === true) return true;
        if (expectedValue === 'false' || expectedValue === false) return false;
        return expectedValue;
    }

    // default - string
    return String(expectedValue);
}

async function evaluateLeafRule(companyCode, rule, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) {
    const actualValue = context[rule.monitor];

    // Resolve expected value
    let rawExpected = rule.value || '';
    rawExpected = replacePlaceholders(rawExpected, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

    const resolvedExpected = await formulaGetValue(companyCode, rawExpected, rawExpected, "", {}, {}, "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);

    let expectedValue = null;
    let result = false;

    if (actualValue !== undefined && actualValue !== null) {
        expectedValue = castExpectedToActualType(actualValue, resolvedExpected);
        const actualType = typeof actualValue;

        const actualStr = String(actualValue);
        const expectedStr = String(expectedValue);

        switch (rule.operation) {
            case '=':
                result = actualType === 'number'
                    ? actualValue === expectedValue
                    : actualStr === expectedStr;
                break;

            case '<>':
                result = actualType === 'number'
                    ? actualValue !== expectedValue
                    : actualStr !== expectedStr;
                break;

            case '>':
                result = actualType === 'number' && actualValue > expectedValue;
                break;

            case '>=':
                result = actualType === 'number' && actualValue >= expectedValue;
                break;

            case '<':
                result = actualType === 'number' && actualValue < expectedValue;
                break;

            case '<=':
                result = actualType === 'number' && actualValue <= expectedValue;
                break;

            case 'Contains':
                result = actualStr.includes(expectedStr);
                break;

            case 'Not Contains':
                result = !actualStr.includes(expectedStr);
                break;

            case 'In': {
                const list = normalizeInValues(resolvedExpected).map(v =>
                    castExpectedToActualType(actualValue, v)
                );
                result = list.includes(actualValue);
                break;
            }

            case 'Not In': {
                const list = normalizeInValues(resolvedExpected).map(v =>
                    castExpectedToActualType(actualValue, v)
                );
                result = !list.includes(actualValue);
                break;
            }
        }
    }

    return {
        type: 'rule',
        monitor: rule.monitor,
        actualValue,                 // always correct
        expectedRaw: rule.value,     // original rule value
        expectedResolved: resolvedExpected, // after placeholder + formula
        expectedValue,               // casted value used in comparison
        actualType: typeof actualValue,
        operation: rule.operation,
        result
    };
}

async function evaluateConditions(companyCode, group, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) {
    const condition = (group.condition || 'AND').toUpperCase();
    const evaluations = [];

    let hasTrue = false;
    let hasFalse = false;

    for (const rule of group.rules) {
        const evalResult = rule.rules ? await evaluateConditions(companyCode, rule, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) : await evaluateLeafRule(companyCode, rule, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);

        evaluations.push(evalResult);

        if (evalResult.result) hasTrue = true;
        else hasFalse = true;
    }

    let finalResult;
    if (condition === 'AND') {
        finalResult = !hasFalse;
    } else { // OR
        finalResult = hasTrue;
    }

    return {
        type: 'group',
        condition,
        rules: evaluations,
        result: finalResult
    };
}

async function evaluateAlertCondition(companyCode, rules, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) {
    try {
        const evaluationReport = await evaluateConditions(companyCode, rules, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);
        return {
            matched: evaluationReport.result,
            report: evaluationReport
        };
    } catch (err) {
        if (enableError) {
            console.error('Alert condition evaluation error:', err);
        }
        return {
            matched: false,
            report: null
        };
    }
}

function resolveWebhookBody(result, bodyType) {
    if (result == null) return null;

    const raw =
        typeof result === "string"
            ? result.trim()
            : typeof result === "object"
                ? JSON.stringify(result)
                : String(result);

    // ---------- JSON ----------
    if (bodyType === "JSON") {

        // Pure JSON
        if ((raw.startsWith("{") && raw.endsWith("}")) ||
            (raw.startsWith("[") && raw.endsWith("]"))) {
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        }

        // JSON inside <pre>
        const preMatch = raw.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
        if (preMatch) {
            try {
                return JSON.parse(preMatch[1].trim());
            } catch {
                return raw;
            }
        }

        return raw;
    }

    // ---------- HTML ----------
    if (bodyType === "HTML") {
        if (/<\/?[a-z][\s\S]*>/i.test(raw)) {
            return raw;
        }
        return `<pre>${escapeHTML(raw)}</pre>`;
    }

    // ---------- TEXT ----------
    if (bodyType === "TEXT") {
        return raw;
    }

    // ---------- XML ----------
    if (bodyType === "XML") {
        return raw;
    }

    return raw;
}

function escapeHTML(str) {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

async function webhook_call_alert({ upUrl, methodType, webhook, result, actionHeaders, ctx }) {
    const { companyCode, schedulerUniqueId, request_id, unique_id, alertCondition, monitorRule, enableAlertDebug, trigger_by } = ctx;

    const baseLogData = { companyCode, unique_id, ...(schedulerUniqueId ? { log_unique_id: schedulerUniqueId } : {}), ...(request_id ? { log_request_id: request_id } : {}), trigger_by: trigger_by, securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

    const startTime = Date.now();

    try {
        const method = methodType || "POST";
        const url = upUrl;

        const bodyToSend = resolveWebhookBody(result, webhook.bodyType);

        const storedRequestBody =
            typeof bodyToSend === "object"
                ? JSON.stringify(bodyToSend)
                : bodyToSend;

        const finalHeaders = {
            ...actionHeaders,
            "Content-Type": getContentType(webhook.bodyType)
        };

        const axiosConfig = {
            method,
            url,
            headers: finalHeaders,
            data: bodyToSend,
        };

        const urlObj = new URL(url); 
        const curlCommand = await generateCurlCommand({
            method,
            protocol: urlObj.protocol.replace(":", ""),
            host: urlObj.host,
            originalUrl: urlObj.pathname,
            query: Object.fromEntries(urlObj.searchParams.entries()),
            headers: axiosConfig.headers,
            body: axiosConfig.data,
            bodyType: webhook.bodyType // JSON | HTML | TEXT | XML
        });


        addToLogAlertQueue({ ...baseLogData, action: "Webhook Post Data", description: "Posting Data", datas: JSON.stringify(axiosConfig), notifyMethod: "Webhook" });
        addToLogAlertQueue({ ...baseLogData, action: "Webhook Triggered", description: "Webhook Triggered", notifyMethod: "Webhook" });
        addToLogAlertQueue({ ...baseLogData, action: "Webhook CURL Bash", description: "CURL Bash", datas: curlCommand, notifyMethod: "Webhook" });

        const response = await axios(axiosConfig);

        const responseStr = JSON.stringify(response.data);
        let responseStrByte = Buffer.byteLength(responseStr, 'utf8');

        addToLogAlertQueue({ ...baseLogData, action: "Webhook API Response Size", description: "Response Data Size", datas: responseStrByte, httpStatus: response.status, notifyMethod: "Webhook" });
        addToLogAlertQueue({ ...baseLogData, action: "Webhook API Response", description: "Response Data", datas: JSON.stringify(response.data), httpStatus: response.status, notifyMethod: "Webhook" });

        let storedResponseBody =
            typeof response.data === "object"
                ? JSON.stringify(response.data)
                : response.data;

        return {
            success: response.status >= 200 && response.status < 300,
            statusCode: response.status,
            timeConsumedMs: Date.now() - startTime,
            webhook: {
                url,
                method,
                request: {
                    headers: finalHeaders,
                    body: storedRequestBody
                },
                response: {
                    statusCode: response.status,
                    body: storedResponseBody
                }
            }
        };

    } catch (error) {

        const httpStatus = error?.response?.status || 500;

        addToLogAlertQueue({
            ...baseLogData,
            action: "Webhook Error",
            description: error.message,
            httpStatus,
            notifyMethod: "Webhook"
        });

        return {
            success: false,
            statusCode: httpStatus,
            timeConsumedMs: Date.now() - startTime,
            webhook: {
                url: upUrl,
                method: methodType,
                error: error.message,
                response: {
                    body:
                        typeof error?.response?.data === "object"
                            ? JSON.stringify(error.response.data)
                            : error?.response?.data
                }
            }
        };
    }
}

function normalizeEmailCtx(ctx = {}) {
    return {
        companyCode: ctx.companyCode,
        schedulerUniqueId: ctx.schedulerUniqueId,
        request_id: ctx.request_id,
        unique_id: ctx.unique_id,
        trigger_by: ctx.trigger_by || "Item",
        alertCondition: ctx.alertCondition || {},
        monitorRule: ctx.monitorRule || {},
        enableAlertDebug: ctx.enableAlertDebug,
        item: ctx.item || {},

        inboundPostData: ctx.inboundPostData,
        outboundMappedData: ctx.outboundMappedData,
        resBodyData: ctx.resBodyData,
        pickContent: ctx.pickContent,

        disabledMail: ctx.disabledMail || "on",
        entrypointURL: ctx.entrypointURL || "",
        endpointURL: ctx.endpointURL || ""
    };
}

function safePayload(data) {
    if (isNonEmptyObjectOrArray(data)) {
        return safeJSONWithOutStringify(data, Config.dataSize);
    }
    return {};
}

async function emailSend_alert({ email, emailSubject, result, ctx }) {
    try {
        const c = normalizeEmailCtx(ctx);

        const baseLogData = {
            companyCode: c.companyCode,
            unique_id: c.unique_id,
            log_unique_id: c.schedulerUniqueId,
            ...(c.request_id ? { log_request_id: c.request_id } : {}),
            trigger_by: c.trigger_by,
            securityLevel: c.monitorRule?.securityLevel,
            ruleName: c.monitorRule?.name,
            policyId: c.alertCondition?.policyId,
            conditionId: c.alertCondition?._id,
            policyName: c.alertCondition?.alertPolicy?.name || "",
            conditionName: c.alertCondition?.name || "",
            enableAlertDebug: c.enableAlertDebug
        };

        const queueId = uuidv4();
        let dateTime = new Date();

        addToLogAlertQueue({ ...baseLogData, action: "Email Connect", description: "Queuing", notifyMethod: "Email", queueId });
        addToLogAlertQueue({ ...baseLogData, action: "Email Send", description: "Queuing", notifyMethod: "Email", queueId });
        addToLogAlertQueue({ ...baseLogData, action: "Email Failure", description: "No", notifyMethod: "Email", queueId });

        const smtpResult = await getGeneralSetting(c.companyCode, "email-smtp");
        if (smtpResult?.status !== 1 || smtpResult?.data?.smtpActive !== "1") return;

        const notification = await getNotificationSettings(c.companyCode, "notification");
        if (notification?.status !== 1) return;

        const queue = mailAlertQueue;
        const smtpSecure = smtpResult.data.smtpPort == 465;

        const mockJobData = {
            queueId,
            smtpConfig: {
                host: smtpResult.data.smtpServer,
                port: smtpResult.data.smtpPort,
                secure: smtpSecure,
                auth: {
                    user: smtpResult.data.smtpAccount,
                    pass: smtpResult.data.smtpPassword,
                },
                family: 4,
                pool: true,
                maxConnections: 20,
                maxMessages: 500,
                rateLimit: 10
            },
            mailConfig: {
                from: `${notification.data.providerName} <${smtpResult.data.smtpEmail}>`,
                to: email.to,
                subject: emailSubject,
                html: result
            },
            logDataConnect: {
                action: "Email Connect",
                description: `SMTP ${smtpResult.data.smtpServer} connected`
            },
            logDataSend: {
                action: "Email Send"
            },
            infoData: {
                itemId: c.item?._id,
                uniqueId: c.schedulerUniqueId,
                itemName: c.item?.ItemName,
                emailTo: email.to,
                emailSubject,
                body: safePayload(c.inboundPostData),
                transformedBody: safePayload(c.outboundMappedData),
                responseBody: safePayload(c.resBodyData),
                transformedResponseBody: safePayload(c.pickContent),
                emailHtml: result,
                dateTime,
                action: "Email Failure",
                description: "Yes",
                CompanyCode: c.companyCode,
                queueId,
                email_failures_return_url: notification?.data?.email_failures_return_url || "",
                disbleFlag: c.disabledMail,
                entrypointURL: c.entrypointURL,
                endpointURL: c.endpointURL
            },
            itemDetails: {
                projectId: c.item?.ProjectId,
                companyId: c.item?.companyId,
                environmentId: c.item?.environmentId,
                companyName: c.item?.companyName,
                projectName: c.item?.projectName,
                environmentName: c.item?.environmentName,
                unique_id: c.unique_id,
                CompanyCode: c.companyCode,
                item_id: c.item?._id
            },
            successDescription: `${c.item?._id} > Sent Email to ${email.to} : Success`,
            errorDescription: `${c.item?._id} > Sent Email to ${email.to} : Fail : Error : `
        };

        await queue.add(
            mailQueueConfig.name_alert_mail,
            mockJobData,
            { delay: 0, removeOnComplete: 10, removeOnFail: 10 }
        );
    } catch (error) {
        addToLogQueue({
            ...baseLogData,
            action: "Email Send Error",
            description: error.message,
            exception_type: "System Error",
            detail_exception: error.stack || error.message,
            notifyMethod: "Email",
            httpStatus: 500
        });
    }
}

// -------------------- Database Queries --------------------
async function getItemExecutions(itemId, startTime, endTime, companyCode) {
    const pipeline = [
        {
            $match: {
                item_id: mongoose.Types.ObjectId(itemId),
                type: { $in: ['Inbound', 'OutBound', 'Outbound', 'FTP', 'SFTP'] },
                CompanyCode: companyCode,
                createdAt: { $gte: startTime, $lte: endTime },
                unique_id: { $exists: true, $ne: null }
            }
        },
        {
            $sort: { createdAt: 1 }
        },
        {
            $group: {
                _id: '$unique_id',
                item_id: { $first: '$item_id' },
                startTime: { $min: '$createdAt' },
                endTime: { $max: '$createdAt' },
                logs: { $push: '$$ROOT' }
            }
        },
        {
            $project: {
                itemId: '$item_id',
                uniqueId: '$_id',
                startTime: 1,
                endTime: 1,
                metrics: {
                    totalDuration: { $subtract: ['$endTime', '$startTime'] },
                    httpStatusCode: {
                        $let: {
                            vars: {
                                statusLog: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: '$logs',
                                                as: 'log',
                                                cond: {
                                                    $and: [
                                                        { $eq: ['$$log.action', 'Outbound API Response'] },
                                                        { $ne: ['$$log.httpStatus', null] },
                                                        { $ne: ['$$log.httpStatus', ''] }
                                                    ]
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: { $ifNull: ['$$statusLog.httpStatus', null] }
                        }
                    }
                    ,
                    errorCount: {
                        $size: {
                            $filter: {
                                input: '$logs',
                                as: 'log',
                                cond: {
                                    $and: [
                                        { $ne: [{ $ifNull: ['$$log.exception_type', null] }, null] },
                                        { $ne: ['$$log.exception_type', ''] },
                                        {
                                            $not: {
                                                $in: [
                                                    '$$log.exception_type',
                                                    ['Validation Error', 'Formula Error']
                                                ]
                                            }
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        {
            $sort: { endTime: 1 }
        }
    ];

    return await logHistory.aggregate(pipeline);
}

async function getAllExecutions(companyCode, startTime, endTime) {
    const matchStage = {
        CompanyCode: companyCode,
        type: { $in: ['Inbound', 'OutBound', 'Outbound', 'FTP', 'SFTP'] },
        createdAt: { $gte: startTime, $lte: endTime },
        unique_id: { $exists: true, $ne: null }
    };

    const pipeline = [
        { $match: matchStage },
        { $sort: { createdAt: 1 } },
        {
            $group: {
                _id: '$unique_id',
                itemId: { $first: '$item_id' },
                startTime: { $min: '$createdAt' },
                endTime: { $max: '$createdAt' },
                logs: { $push: '$$ROOT' }
            }
        },
        {
            $addFields: {
                metrics: {
                    totalDuration: {
                        $subtract: ['$endTime', '$startTime']
                    },

                    httpStatusCode: {
                        $let: {
                            vars: {
                                statusLog: {
                                    $arrayElemAt: [
                                        {
                                            $filter: {
                                                input: '$logs',
                                                as: 'log',
                                                cond: {
                                                    $and: [
                                                        { $ne: ['$$log.httpStatus', null] },
                                                        { $ne: ['$$log.httpStatus', ''] }
                                                    ]
                                                }
                                            }
                                        },
                                        0
                                    ]
                                }
                            },
                            in: {
                                $ifNull: [
                                    {
                                        $toInt: {
                                            $arrayElemAt: [
                                                { $split: ['$$statusLog.httpStatus', ' '] },
                                                0
                                            ]
                                        }
                                    },
                                    200
                                ]
                            }
                        }
                    },

                    hasErrors: {
                        $gt: [
                            {
                                $size: {
                                    $filter: {
                                        input: '$logs',
                                        as: 'log',
                                        cond: {
                                            $and: [
                                                { $eq: [{ $type: '$$log.exception_type' }, 'string'] },
                                                { $ne: ['$$log.exception_type', ''] },
                                                {
                                                    $not: {
                                                        $in: ['$$log.exception_type', ['Validation Error', 'Formula Error']]
                                                    }
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            0
                        ]
                    }
                }
            }
        },
        {
            $project: {
                _id: 0,
                uniqueId: '$_id',
                itemId: 1,
                metrics: {
                    totalDuration: 1,
                    httpStatusCode: 1,
                    hasErrors: 1,
                    success: {
                        $and: [
                            { $eq: ['$metrics.hasErrors', false] },
                            { $gte: ['$metrics.httpStatusCode', 200] },
                            { $lt: ['$metrics.httpStatusCode', 300] }
                        ]
                    }
                },
                logs: 1
            }
        }
    ];

    return logHistory.aggregate(pipeline);
}

function createEvalLogger(scope, meta = {}) {
    const base = `[${new Date().toISOString()}][${scope}]`;

    return {
        log: (msg, data) =>
            console.log(base, msg, data ?? "", meta),

        json: (msg, obj) =>
            console.log(base, msg, JSON.stringify(obj, null, 2), meta),

        error: (msg, err) =>
            console.error(base, msg, err?.stack || err, meta)
    };
}

// -------------------- Rule Evaluation --------------------
async function evaluateRule(rule, item, companyCode) {
    const log = createEvalLogger("EVALUATE_RULE", {
        ruleName: rule.name,
        itemId: item._id,
        companyCode
    });

    const { threshold, rules: ruleBlock } = rule;
    const { durationValue, durationUnit, groupBy, times = 1 } = threshold;

    const now = new Date();
    const effectiveEndTime = new Date(
        now.getTime() - durationToMs(Config.scheduler_delay_minutes, 'minutes')
    );

    const windowStart = new Date(
        effectiveEndTime.getTime() - durationToMs(durationValue, durationUnit)
    );

    log.log("START");
    log.json("Rule config", {
        groupBy,
        times,
        window: {
            start: windowStart,
            end: effectiveEndTime
        }
    });

    // -------- PER ITEM --------
    if (groupBy === 'per_item') {
        const executions = await getItemExecutions(
            item._id,
            windowStart,
            effectiveEndTime,
            companyCode
        );

        log.log("Executions found", executions.length);

        if (!executions.length) {
            log.log("No executions — skipped");
            return {
                matched: false,
                type: 'per_item',
                executionsCount: 0
            };
        }

        const rootResult = await evaluateRuleNode(
            ruleBlock,
            executions,
            times,
            0,
            false,
            log
        );

        log.json("FINAL RESULT", rootResult);

        return {
            matched: rootResult.result,
            type: 'per_item',
            executionsCount: executions.length,
            itemId: item._id,
            itemName: item.ItemName,
            report: rootResult
        };
    }

    // -------- AVERAGE / COMPANY-WIDE (Per-execution logic) --------
    if (groupBy === 'average') {
        // fetch all executions for all items in company
        const executions = await getAllExecutions(companyCode, windowStart, effectiveEndTime);
        log.log("Company-wide executions", executions.length);

        if (!executions.length) {
            log.log("No executions — skipped");
            return {
                matched: false,
                type: 'average',
                executionsCount: 0
            };
        }

        // Use evaluateRuleNode but override leaf monitors to handle '@avg.*'
        const overriddenRuleBlock = JSON.parse(JSON.stringify(ruleBlock));

        const rootResult = await evaluateRuleNode(overriddenRuleBlock, executions, times, 0, true, log);

        log.json("FINAL COMPANY RESULT", rootResult);

        return {
            matched: rootResult.result,
            type: 'average',
            groupBy,
            timeWindow: { start: windowStart, end: effectiveEndTime },
            executionsCount: executions.length,
            report: rootResult
        };
    }

    log.log("UNKNOWN GROUP TYPE");
    return {
        matched: false,
        type: 'unknown'
    };

}

function getSQLOperator(operation) {
    switch (operation) {
        case "Contains": return "LIKE";
        case "Not Contains": return "NOT LIKE";
        case "=":
        case "==": return "=";
        case "<=":
        case ">=":
        case "<":
        case ">": return operation;
        case "IN": return "IN";
        case "Regex": return "REGEXP";
        default: return operation;
    }
}

function buildSQLQuery(node) {
    // Leaf rule
    if (node.type === "rule") {
        const sqlOp = getSQLOperator(node.operation);

        if (node.operation === "Contains" || node.operation === "Not Contains") {
            return `${node.monitor} ${sqlOp} '%${node.expectedRaw}%'`;
        }

        return `${node.monitor} ${sqlOp} '${node.expectedRaw}'`;
    }

    // Group rule (AND / OR)
    if (node.rules?.length) {
        const inner = node.rules
            .map(r => buildSQLQuery(r))
            .join(` ${node.condition} `);

        return `(${inner})`;
    }

    return "";
}

function buildSQLResult(node) {
    // Leaf rule
    if (node.type === "rule") {
        const op = node.operation.toLowerCase();

        const actual = node.actualValue;
        const expected = node.expectedResolved;

        return `${actual} ${op} ${expected}`;
    }

    // Group rule
    if (node.rules?.length) {
        const inner = node.rules
            .map(r => buildSQLResult(r))
            .join(` ${node.condition} `);

        return `(${inner})`;
    }

    return "";
}

function isGroupRule(rule) {
    return rule.rules && Array.isArray(rule.rules) && rule.condition;
}

// -------------------- Rule Node Evaluation --------------------
async function evaluateRuleNode(ruleNode, executions, times, level = 0, isCompanyAverage = false, parentLog) {
    const indent = '  '.repeat(level);
    const log = parentLog;

    // ================= GROUP NODE =================
    if (isGroupRule(ruleNode)) {
        log.log(`${indent}GROUP START`, ruleNode.condition);

        const childReports = [];
        for (let i = 0; i < ruleNode.rules.length; i++) {
            const child = await evaluateRuleNode(ruleNode.rules[i], executions, times, level + 1, isCompanyAverage, log);
            childReports.push(child);
        }

        const result = ruleNode.condition === 'AND'
            ? childReports.every(r => r.result === true)
            : childReports.some(r => r.result === true);

        log.log(`${indent}GROUP END - ${result}`);

        return {
            type: "group",
            condition: ruleNode.condition,
            rules: childReports,
            result
        };
    }

    // ================= LEAF NODE =================
    log.json(`${indent}LEAF START`, {
        monitor: ruleNode.monitor,
        operation: ruleNode.operation,
        expected: ruleNode.value
    });

    const expectedValue = Number(ruleNode.value);
    let matchedCount = 0;
    let latestExecutionMatches = false;
    let latestActualValue = null;

    // company-wide metrics override
    if (isCompanyAverage) {
        if (ruleNode.monitor === '@avg.resTimeMs') {
            const total = executions.reduce((sum, e) => sum + (e.metrics?.totalDuration || 0), 0);
            latestActualValue = total / (executions.length || 1);
        } else if (ruleNode.monitor === '@avg.throughput') {
            latestActualValue = executions.length;
        } else if (ruleNode.monitor === '@avg.errorRate') {
            const errors = executions.filter(e => !e.metrics?.success).length;
            latestActualValue = (errors / (executions.length || 1)) * 100;
        }
        latestExecutionMatches = evaluateCondition(latestActualValue, ruleNode.operation, expectedValue);
        matchedCount = times; // force match count for company-wide
    } else {
        // latest execution (by time)
        const latestExecution = executions[executions.length - 1];

        for (const execution of executions) {
            let actualValue = null;
            if (ruleNode.monitor === '@item.resTimeMs') actualValue = execution.metrics?.totalDuration ?? null;
            else if (ruleNode.monitor === '@item.httpStatusCode') actualValue = execution.metrics?.httpStatusCode ?? null;
            else if (ruleNode.monitor === '@item.totalError') actualValue = execution.metrics?.errorCount ?? null;

            if (evaluateCondition(actualValue, ruleNode.operation, expectedValue)) matchedCount++;
        }

        if (ruleNode.monitor === '@item.resTimeMs') latestActualValue = latestExecution.metrics?.totalDuration ?? null;
        else if (ruleNode.monitor === '@item.httpStatusCode') latestActualValue = latestExecution.metrics?.httpStatusCode ?? null;
        else if (ruleNode.monitor === '@item.totalError') latestActualValue = latestExecution.metrics?.errorCount ?? null;

        latestExecutionMatches = evaluateCondition(latestActualValue, ruleNode.operation, expectedValue);
    }

    const result = (matchedCount >= times) && latestExecutionMatches;

    log.json(`${indent}LEAF END`, {
        actual: latestActualValue,
        matchedCount,
        result
    });

    return {
        type: "rule",
        monitor: ruleNode.monitor,

        actualValue: latestActualValue,
        actualType: typeof latestActualValue,

        expectedRaw: ruleNode.value,
        expectedResolved: expectedValue,
        expectedValue,

        operation: ruleNode.operation,

        conditionMatched: latestExecutionMatches,
        matchedCount,
        requiredTimes: times,
        thresholdMatched: matchedCount >= times,
        result: result
    };

}

function createLogger(scope, meta = {}) {
    const prefix = `[${new Date().toISOString()}][${scope}]`;

    return {
        info: (msg, data) =>
            console.log(prefix, msg, data ?? "", meta),

        warn: (msg, data) =>
            console.warn(prefix, msg, data ?? "", meta),

        error: (msg, err) =>
            console.error(prefix, msg, err ?? "", meta),

        json: (msg, obj) =>
            console.log(prefix, msg, JSON.stringify(obj, null, 2))
    };
}

// -------------------- Main Monitoring Functions --------------------
async function checkItemMonitoring(item, schedulerUniqueId, companyCode) {
    const log = createLogger("CHECK_ITEM_MONITORING", {
        schedulerUniqueId,
        companyCode,
        itemId: item?._id
    });

    log.info("START");

    try {
        const policies_condtions = await loadMonitoringPolicy(companyCode);
        log.info("Policies loaded", { count: policies_condtions.length });

        if (!policies_condtions.length) {
            return { triggeredRules: [], executionMetrics: null };
        }

        const triggeredRules = [];

        for (const policies_condtion of policies_condtions) {
            log.info("Processing policy", {
                policyId: policies_condtion.policyId,
                conditionId: policies_condtion._id
            });

            if (!policies_condtion?.moniterRules?.length) {
                log.warn("No monitor rules found");
                continue;
            }

            for (const rule of policies_condtion.moniterRules) {
                if (!ruleApplies(rule, item)) {
                    log.info("Rule skipped (ruleApplies=false)", rule.name);
                    continue;
                }

                log.json("Rule evaluation started", rule);

                const baseLogData = { companyCode, trigger_by: "Scheduler", securityLevel: rule.securityLevel, ruleName: rule.name, policyId: policies_condtion.policyId, conditionId: policies_condtion._id, policyName: policies_condtion.alertPolicy?.name || "", conditionName: policies_condtion.name, enableAlertDebug: Config.enableAlertDebug };

                try {
                    const vars = await processVariablesAndHeaders(companyCode, rule.variables, {}, {}, {}, {}, [], [], [], [], {}, "POST", schedulerUniqueId, "no", "no", "no", "no", item);

                    const checkCondition = await evaluateRule(rule, item, companyCode);
                    log.json("Rule evaluation result", {
                        matched: checkCondition?.matched,
                        report: checkCondition?.report
                    });

                    const sqlQuery = checkCondition.report ? buildSQLQuery(checkCondition.report) : "";
                    const sqlResult = checkCondition.report ? buildSQLResult(checkCondition.report) : "";
                    log.info("Generated SQL Query", sqlQuery);
                    log.info("Generated SQL Result", sqlResult);

                    for (const notify of rule.notify) {
                        if (notify.status) {
                            const notify_unique_id = uuidv4(); // unique per notify

                            const notifyBaseLogData = {
                                ...baseLogData,
                                unique_id: notify_unique_id,
                                notifyMethod: notify.type,
                                isMatched: !!checkCondition?.matched
                            };

                            const notifyLog = createLogger("NOTIFY", {
                                schedulerUniqueId,
                                ruleName: rule.name,
                                notifyType: notify.type,
                                notifyUniqueId: notify_unique_id
                            });

                            notifyLog.info("Notify execution started");

                            try {
                                // Log start of evaluation per notify
                                addToLogAlertQueue({ ...notifyBaseLogData, action: "Start Alert", description: `Evaluating alert condition for rule: ${rule.name}` });

                                // Log SQL query and result
                                addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Query", description: sqlQuery });
                                addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Query Result", description: sqlResult });

                                if (checkCondition?.matched) {
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Matched", description: sqlQuery, datas: JSON.stringify(checkCondition) });
                                } else {
                                    const startTime = Date.now();
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Not Matched", description: sqlQuery, datas: JSON.stringify(checkCondition) });
                                    const endTime = Date.now();
                                    const timeConsumedMs = endTime - startTime;
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
                                    continue;
                                }

                                const ctx = { companyCode, unique_id: notify_unique_id, notifyMethod: notify.type, checkCondition, sqlQuery, sqlResult, alertCondition: policies_condtion, monitorRule: rule, item, enableAlertDebug: Config.enableAlertDebug, item };

                                // -------------------- Execute Notify --------------------
                                if (notify.type === "Webhook") {
                                    const startTime = Date.now();
                                    await handleWebhookNotify(notify, ctx, vars);
                                    notifyLog.info("Notify executed", {
                                        timeMs: Date.now() - startTime
                                    });
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Webhook", description: "Webhook End" });
                                    const endTime = Date.now();
                                    const timeConsumedMs = endTime - startTime;
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });

                                } else if (notify.type === "Email") {
                                    const startTime = Date.now();
                                    await handleEmailNotify(notify, ctx, vars);
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Email", description: "Email End" });
                                    const endTime = Date.now();
                                    const timeConsumedMs = endTime - startTime;
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
                                    addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
                                }
                            } catch (error) {
                                addToLogAlertQueue({ ...notifyBaseLogData, action: "Notify Error", description: "catch " + error + " - Some error occurred while process notify execution data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process notify execution data.", httpStatus: 500 });
                                notifyLog.error("Notify execution failed", {
                                    message: error.message,
                                    stack: error.stack
                                });
                            }
                        }
                    }
                } catch (error) {
                    addToLogAlertQueue({ ...baseLogData, action: "Monitor Rule Error", description: "catch " + error + " - Some error occurred while process monitor rule data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process monitor rule data.", httpStatus: 500 });
                }
            }
        }
        log.info("END checkItemMonitoring");
        return {
            triggeredRules
        };
    } catch (error) {
        console.error('Error in checkItemMonitoring:', error);
        return { triggeredRules: [], executionMetrics: null };
    }
}

const handleWebhookNotify = async (notify, ctx, vars) => {
    const { companyCode, unique_id, alertCondition, monitorRule, enableAlertDebug, item } = ctx;

    const baseLogData = { companyCode, unique_id, trigger_by: "Scheduler", securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

    try {
        addToLogAlertQueue({ ...baseLogData, action: "Webhook", description: "Webhook Start", notifyMethod: "Webhook" });

        const headers = await processVariablesAndHeaders(companyCode, notify.webhook?.headers, {}, {}, {}, {}, [], [], [], [], {}, "POST", "", "no", "no", "no", "no", item);

        const payload = await processWebhookContent(notify.webhook.content || notify.webhook, companyCode, {}, {}, {}, {}, [], [], [], [], {}, "POST", "", {}, {}, {}, {}, vars, {});

        const url = await buildFinalReturnUrl({ url: notify.webhook.url, OutboundFormatData: {}, inboundFormatData: {}, querystring: {}, header: {}, reqIn: [], reqOut: [], resIn: [], resOut: [], global: {}, request_method: "POST", schedulerUniqueId: "", companyCode, inboundEnableLog: "no", enableLogs: "no", enableFullLogs: "no", enableError: "no", item, request_id: "" });

        if (!url?.trim()) {
            return { success: false, error: "Webhook URL empty" };
        }

        addToLogAlertQueue({ ...baseLogData, action: "Webhook", description: "Webhook EndPoint URL", datas: url.trim(), notifyMethod: "Webhook" });

        const methodType = await formulaGetValue(companyCode, notify.webhook.method || "POST", notify.webhook.method || "POST", "", {}, {}, "@Out{", item, "", "no", "no", "no", "no", {}, {}, [], [], [], [], {}, "POST");

        ctx = { ...ctx, trigger_by: "Scheduler" }

        return await webhook_call_alert({
            upUrl: url.trim(),
            methodType,
            webhook: notify.webhook,
            result: payload,
            actionHeaders: headers,
            ctx
        });
    } catch (error) {
        addToLogAlertQueue({ ...baseLogData, action: "Webhook Notify Error", description: "catch " + error + " - Some error occurred while process webhook notify data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process webhook notify data.", notifyMethod: "Webhook", httpStatus: 500 });
    }
}

const handleEmailNotify = async (notify, ctx, vars) => {
    const { companyCode, schedulerUniqueId, unique_id, alertCondition, monitorRule, enableAlertDebug, item } = ctx;

    const baseLogData = { companyCode, unique_id, log_unique_id: schedulerUniqueId, trigger_by: "Scheduler", securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

    try {
        addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Start", notifyMethod: "Email" });

        const payload = await processWebhookContent(notify.email.content || notify.email, companyCode, {}, {}, {}, {}, [], [], [], [], {}, "POST", schedulerUniqueId, {}, {}, {}, {}, vars, {});

        let subject = notify.email.subject || "";

        subject = replacePlaceholders(subject, {}, {}, {}, {}, [], [], [], [], {}, "POST", schedulerUniqueId);

        subject = await formulaGetValue(companyCode, subject, subject, "", {}, {}, "@Out{", item, schedulerUniqueId, "no", "no", "no", "no", {}, {}, [], [], [], [], {}, "POST");

        addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Subject", datas: subject, notifyMethod: "Email" });
        addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email To", datas: notify.email.to, notifyMethod: "Email" });
        addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Body", datas: typeof payload === "object" ? payloadJSON.stringify(payload) : payload, notifyMethod: "Email" });

        ctx = { ...ctx, trigger_by: "Scheduler" }

        return await emailSend_alert({
            email: notify.email,
            emailSubject: subject,
            result: payload,
            ctx
        });
    } catch (error) {
        addToLogAlertQueue({ ...baseLogData, action: "Email Notify Error", description: "catch " + error + " - Some error occurred while process email notify data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process email notify data.", notifyMethod: "Email", httpStatus: 500 });
    }

}

function durationToMs(value, unit) {
    const map = {
        seconds: 1000,
        minutes: 60 * 1000,
        hours: 60 * 60 * 1000
    };
    return value * (map[unit] || map.minutes);
}

function evaluateCondition(actual, operation, expected) {
    console.log('\n=== evaluateCondition ===');
    console.log({ actual, operation, expected });

    if (actual === null || actual === undefined) return false;

    const normalizedActual = normalizeValue(actual);
    let result = false;

    switch (operation) {
        case '=':
        case '==': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = normalizedActual === exp;
            break;
        }

        case '!=':
        case '<>': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = normalizedActual !== exp;
            break;
        }

        case '>': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = typeof normalizedActual === 'number' && normalizedActual > exp;
            break;
        }

        case '>=': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = typeof normalizedActual === 'number' && normalizedActual >= exp;
            break;
        }

        case '<': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = typeof normalizedActual === 'number' && normalizedActual < exp;
            break;
        }

        case '<=': {
            const exp = castExpectedToActualType(normalizedActual, expected);
            result = typeof normalizedActual === 'number' && normalizedActual <= exp;
            break;
        }

        case 'Contains':
            result = String(normalizedActual).includes(String(expected));
            break;

        case 'Not Contains':
            result = !String(normalizedActual).includes(String(expected));
            break;

        case 'In': {
            const list = normalizeInValues(expected).map(v =>
                castExpectedToActualType(normalizedActual, v)
            );
            result = list.includes(normalizedActual);
            break;
        }

        case 'Not In': {
            const list = normalizeInValues(expected).map(v =>
                castExpectedToActualType(normalizedActual, v)
            );
            result = !list.includes(normalizedActual);
            break;
        }

        default:
            console.error('Unknown operation:', operation);
            result = false;
    }

    return result;
}

function ruleApplies(rule, item) {
    if (rule.companyId !== 'all' && rule.companyId !== item.companyId?.toString()) {
        return false;
    }

    if (rule.projectId !== 'all' && rule.projectId !== item.ProjectId?.toString()) {
        return false;
    }

    if (rule.itemType !== 'all' && rule.itemType !== item.itemType) {
        return false;
    }

    return true;
}

async function loadMonitoringPolicy(companyCode) {
    try {
        const res = await conditionListByCompanyCode(companyCode, "all");
        return res?.data || [];
    } catch (error) {
        console.error('Error loading monitoring policy:', error);
        return [];
    }
}

module.exports = {
    checkItemMonitoring,
    evaluateRule,
    getAllExecutions,
    evaluateAlertCondition,
    webhook_call_alert,
    emailSend_alert
};