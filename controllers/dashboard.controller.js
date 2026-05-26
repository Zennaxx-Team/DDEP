const mongoose = require("mongoose");
const moment = require("moment");
const logHistoryModel = require("../models/log_history.model");
const jwtDecode = require("jwt-decode");
const config = require("../config");

// Map durations to bucket & hover intervals
function getTimeSettings(durationMinutes) {
    const oneMin = 60 * 1000;
    const oneHour = 60 * oneMin;
    const oneDay = 24 * oneHour;

    if (durationMinutes <= 30) return { bucket: 5 * oneMin, hover: 1 * oneMin };
    if (durationMinutes <= 60) return { bucket: 5 * oneMin, hover: 1 * oneMin };
    if (durationMinutes <= 180) return { bucket: 15 * oneMin, hover: 1 * oneMin };
    if (durationMinutes <= 360) return { bucket: 30 * oneMin, hover: 2 * oneMin };
    if (durationMinutes <= 720) return { bucket: 3 * oneHour, hover: 5 * oneMin };
    if (durationMinutes <= 1440) return { bucket: 3 * oneHour, hover: 10 * oneMin };
    if (durationMinutes <= 4320) return { bucket: 12 * oneHour, hover: 30 * oneMin };
    if (durationMinutes <= 10080) return { bucket: 24 * oneHour, hover: 1 * oneHour };
    if (durationMinutes <= 43200) return { bucket: 7 * oneDay, hover: 6 * oneHour };   // ~30 days
    if (durationMinutes <= 129600) return { bucket: 14 * oneDay, hover: 4 * oneDay };  // ~90 days
    return { bucket: 4 * oneDay, hover: 4 * oneDay };
}

// Generate full bucket timeline
function generateBuckets(start, end, bucketSizeMs) {
    const buckets = [];
    const alignedStart = Math.floor(start.getTime() / bucketSizeMs) * bucketSizeMs;
    for (let t = alignedStart; t <= end.getTime(); t += bucketSizeMs) {
        buckets.push(new Date(t));
    }
    return buckets;
}

// Convert UTC date to local timezone
function convertToLocal(date, offsetMinutes = 0) {
    return new Date(date.getTime() - offsetMinutes * 60 * 1000);
}

const getThroughput = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { companyId, projectId, itemId, startTime, endTime, durationMinutes, logDescription } = req.body;

        // Normalize start & end times in UTC
        const start = startTime
            ? moment(startTime).utc().startOf("minute").toDate()
            : moment().utc().subtract(30, "minutes").startOf("minute").toDate();

        const end = endTime
            ? moment(endTime).utc().startOf("minute").toDate()
            : moment().utc().startOf("minute").toDate();

        // Calculate duration if not given
        const duration = durationMinutes || Math.ceil((end - start) / (60 * 1000));
        const { bucket: bucketSizeMs, hover: hoverIntervalMs } = getTimeSettings(duration);

        // Match stage
        const matchStage = {
            createdAt: { $gte: start, $lte: end }
        };

        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId != "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }
        if (projectId && projectId != "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (projectId == "all") {

        } else {
            matchStage.projectId = null;
        }

        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId != "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        const pipeline = [
            { $match: matchStage },

            ...(logDescription ? [
                {
                    $lookup: {
                        from: "log_histories",
                        let: { unique_id: "$unique_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                    action: "OutBound Log",
                                    description: "Log Description",
                                    datas: { $regex: logDescription, $options: "i" }
                                }
                            },
                            { $project: { _id: 1 } }
                        ],
                        as: "log_description"
                    }
                },
                { $match: { "log_description.0": { $exists: true } } }
            ] : []),

            // Add bucketTime for grouping
            {
                $addFields: {
                    bucketTime: {
                        $toDate: {
                            $subtract: [
                                { $toLong: "$createdAt" },
                                { $mod: [{ $toLong: "$createdAt" }, bucketSizeMs] }
                            ]
                        }
                    }
                }
            },

            // Lookup item name
            {
                $lookup: {
                    from: "items",
                    localField: "item_id",
                    foreignField: "_id",
                    as: "itemData"
                }
            },
            {
                $addFields: {
                    itemName: { $ifNull: [{ $arrayElemAt: ["$itemData.ItemName", 0] }, "Unknown"] },
                    itemId: { $ifNull: [{ $arrayElemAt: ["$itemData._id", 0] }, null] }
                }
            },

            // Group by unique_id to capture both start & response
            {
                $group: {
                    _id: { unique_id: "$unique_id", bucket: "$bucketTime", item: "$itemName", itemId: "$itemId" },
                    startAt: {
                        $min: {
                            $cond: [{ $regexMatch: { input: "$action", regex: /start/i } }, "$createdAt", null]
                        }
                    },
                    endAt: {
                        $max: {
                            $cond: [{ $regexMatch: { input: "$action", regex: /response|end/i } }, "$createdAt", null]
                        }
                    }
                }
            },

            {
                $match: {
                    $or: [
                        { startAt: { $ne: null } },
                        { endAt: { $ne: null } }
                    ]
                }
            },

            // Regroup by bucket + item
            {
                $group: {
                    _id: { bucket: "$_id.bucket", item: "$_id.item", itemId: "$_id.itemId" },
                    details: {
                        $push: {
                            unique_id: "$_id.unique_id",
                            startAt: "$startAt",
                            endAt: "$endAt"
                        }
                    }
                }
            },

            // Add count
            {
                $project: {
                    bucket: "$_id.bucket",
                    item: "$_id.item",
                    itemId: "$_id.itemId",
                    count: { $size: "$details" },
                    details: 1
                }
            },

            // Final regroup: per bucket
            {
                $group: {
                    _id: "$bucket",
                    totalCount: { $sum: "$count" },
                    perItem: {
                        $push: {
                            item: "$item",
                            itemId: "$itemId",
                            count: "$count",
                            details: "$details"
                        }
                    }
                }
            },

            { $sort: { _id: 1 } }
        ];

        const results = await logHistoryModel.aggregate(pipeline);

        // Local timezone offset (minutes)
        const timezoneOffset = new Date().getTimezoneOffset();

        // Fill missing buckets + convert to local
        const allBuckets = generateBuckets(start, end, bucketSizeMs);
        const filledResults = allBuckets.map(bucketStart => {
            const found = results.find(r => new Date(r._id).getTime() === bucketStart.getTime());
            const entry = found || { _id: bucketStart, totalCount: 0, perItem: [] };

            return {
                ...entry,
                _id: convertToLocal(new Date(entry._id), timezoneOffset) // convert bucket to local
            };
        });

        res.json({
            success: true,
            startTime: convertToLocal(start, timezoneOffset).getTime(),
            endTime: convertToLocal(end, timezoneOffset).getTime(),
            bucketSizeMs,
            hoverIntervalMs,
            data: filledResults
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const getExceptionChart = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { companyId, projectId, itemId, startTime, endTime, durationMinutes, searchItem, logDescription } = req.body;

        // Default time range
        const start = startTime
            ? moment(startTime).utc().startOf("minute").toDate()
            : moment().utc().subtract(30, "minutes").startOf("minute").toDate();
        const end = endTime
            ? moment(endTime).utc().startOf("minute").toDate()
            : moment().utc().startOf("minute").toDate();

        const duration = durationMinutes || Math.ceil((end - start) / (60 * 1000));
        const { bucket: bucketSizeMs, hover: hoverIntervalMs } = getTimeSettings(duration);

        // Base match
        let matchStage = {
            createdAt: { $gte: start, $lte: end },
            exception_type: { $exists: true },
            exception_type: { $in: ["System Error", "Connection Error"] }
        };

        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId !== "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }
        if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (projectId === "all") {
            // skip
        } else {
            matchStage.projectId = null;
        }

        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId !== "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        let matchedUniqueIds = null;
        if (logDescription && logDescription.trim() !== "") {
            const regex = new RegExp(logDescription.trim(), "i");

            const uniqueIdsResult = await logHistoryModel.aggregate([
                {
                    $match: {
                        action: "OutBound Log",
                        description: "Log Description",
                        datas: { $regex: regex },
                        ...(companyCode ? { CompanyCode: companyCode } : {})
                    }
                },
                { $group: { _id: "$unique_id" } }
            ]);

            matchedUniqueIds = uniqueIdsResult.map(x => x._id).filter(Boolean);
            matchStage.unique_id = { $in: matchedUniqueIds };
        }

        const pipeline = [
            { $match: matchStage },
            {
                $addFields: {
                    bucketTime: {
                        $toDate: {
                            $subtract: [
                                { $toLong: "$createdAt" },
                                { $mod: [{ $toLong: "$createdAt" }, bucketSizeMs] }
                            ]
                        }
                    }
                }
            },
            {
                $group: {
                    _id: { bucket: "$bucketTime", exception: "$exception_type" },
                    count: { $sum: 1 }
                }
            },
            {
                $group: {
                    _id: "$_id.bucket",
                    exceptions: {
                        $push: { type: "$_id.exception", count: "$count" }
                    },
                    totalCount: { $sum: "$count" }
                }
            },
            { $sort: { _id: 1 } }
        ];

        const results = await logHistoryModel.aggregate(pipeline);

        const timezoneOffset = new Date().getTimezoneOffset();
        const allBuckets = generateBuckets(start, end, bucketSizeMs);

        const filledResults = allBuckets.map(bucketStart => {
            const found = results.find(r => new Date(r._id).getTime() === bucketStart.getTime());
            const entry = found || { _id: bucketStart, totalCount: 0, exceptions: [] };

            return {
                ...entry,
                _id: convertToLocal(new Date(entry._id), timezoneOffset)
            };
        });

        return res.json({
            success: true,
            startTime: convertToLocal(start, timezoneOffset).getTime(),
            endTime: convertToLocal(end, timezoneOffset).getTime(),
            bucketSizeMs,
            hoverIntervalMs,
            data: filledResults
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const getNetworkUsage = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        const { companyId, projectId, itemId, startTime, endTime, durationMinutes, logDescription } = req.body;

        // Parse dates - treat as UTC
        const start = startTime
            ? moment.utc(startTime).startOf('minute').toDate()
            : moment.utc().subtract(30, 'minutes').startOf('minute').toDate();

        const end = endTime
            ? moment.utc(endTime).endOf('minute').toDate()  // FIXED: use endOf
            : moment.utc().endOf('minute').toDate();

        // Build match stage
        const matchStage = {
            createdAt: { $gte: start, $lte: end }
        };

        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId !== "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }

        if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (projectId !== "all") {
            matchStage.projectId = null;
        }

        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId != "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        if (companyCode) {
            matchStage.CompanyCode = companyCode;
        }

        // Calculate duration and bucket settings
        const duration = durationMinutes || Math.ceil((end - start) / (60 * 1000));
        const { bucket: bucketSizeMs, hover: hoverIntervalMs } = getTimeSettings(duration);

        const pipeline = [
            { $match: matchStage },
            { $sort: { unique_id: 1, createdAt: 1 } },

            ...(logDescription ? [
                {
                    $lookup: {
                        from: "log_histories",
                        let: { unique_id: "$unique_id" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                    action: "OutBound Log",
                                    description: "Log Description",
                                    datas: { $regex: logDescription, $options: "i" }
                                }
                            },
                            { $project: { _id: 1 } }
                        ],
                        as: "log_description"
                    }
                },
                { $match: { "log_description.0": { $exists: true } } }
            ] : []),

            // Step 1: Group by unique_id to get session execution times
            {
                $group: {
                    _id: "$unique_id",
                    item: { $first: "$item_id" },
                    firstTime: { $first: "$createdAt" },
                    lastTime: { $last: "$createdAt" }
                }
            },

            // Step 2: Calculate execution time and bucket alignment
            {
                $addFields: {
                    execTimeMs: { $subtract: ["$lastTime", "$firstTime"] },
                    bucketTime: {
                        $toLong: {
                            $subtract: [
                                { $toLong: "$firstTime" },
                                { $mod: [{ $toLong: "$firstTime" }, bucketSizeMs] }
                            ]
                        }
                    }
                }
            },

            // Step 3: Filter out zero-duration sessions
            { $match: { execTimeMs: { $gt: 0 } } },

            // Step 4: Group by bucket + item - STORE SUM AND COUNT
            {
                $group: {
                    _id: {
                        bucketTime: "$bucketTime",
                        item: "$item"
                    },
                    totalExecTime: { $sum: "$execTimeMs" },  // Store sum, not avg
                    sessionCount: { $sum: 1 }                // Track session count
                }
            },

            // Step 5: Lookup item details
            {
                $lookup: {
                    from: "items",
                    localField: "_id.item",
                    foreignField: "_id",
                    as: "item_details",
                    pipeline: [{ $project: { ItemName: 1 } }]
                }
            },

            // Step 6: Unwind (preserve null items)
            {
                $unwind: {
                    path: "$item_details",
                    preserveNullAndEmptyArrays: false
                }
            },

            // Step 7: Group by bucket - WEIGHTED AVERAGE
            {
                $group: {
                    _id: "$_id.bucketTime",
                    totalExecTimeAll: { $sum: "$totalExecTime" },      // Sum across items
                    totalSessionsAll: { $sum: "$sessionCount" },       // Count across items
                    perItem: {
                        $push: {
                            item: "$item_details.ItemName",
                            itemId: "$item_details._id",
                            avg: {
                                $divide: ["$totalExecTime", "$sessionCount"]  // Per-item avg
                            },
                            sessions: "$sessionCount"
                        }
                    }
                }
            },

            // Step 8: Calculate overall weighted average
            {
                $addFields: {
                    avgExecTime: {
                        $divide: ["$totalExecTimeAll", "$totalSessionsAll"]  // Weighted avg
                    }
                }
            },

            // Step 9: Clean up output
            {
                $project: {
                    _id: 1,
                    avgExecTime: 1,
                    totalSessions: "$totalSessionsAll",
                    perItem: 1
                }
            },

            { $sort: { _id: 1 } }
        ];

        // Execute aggregation
        const rawBuckets = await logHistoryModel.aggregate(pipeline);

        // Generate all buckets (including empty ones)
        const allBuckets = generateBuckets(start, end, bucketSizeMs);

        // Get timezone offset for conversion
        const timezoneOffset = new Date().getTimezoneOffset();

        // Fill in empty buckets and convert to local time
        const filledResults = allBuckets.map(bucketStart => {
            const bucketTimestamp = bucketStart.getTime();
            const found = rawBuckets.find(r => Number(r._id) === bucketTimestamp);

            if (found) {
                return {
                    _id: convertToLocal(new Date(found._id), timezoneOffset),
                    avgExecTime: Math.round(found.avgExecTime * 100) / 100,  // Round to 2 decimals
                    totalSessions: found.totalSessions,
                    perItem: found.perItem.map(item => ({
                        item: item.item || '',
                        itemId: item.itemId,
                        avg: Math.round(item.avg * 100) / 100,
                        sessions: item.sessions
                    }))
                };
            }

            // Empty bucket
            return {
                _id: convertToLocal(bucketStart, timezoneOffset),
                avgExecTime: 0,
                totalSessions: 0,
                perItem: []
            };
        });

        return res.status(200).send({
            success: true,
            startTime: convertToLocal(start, timezoneOffset).getTime(),
            endTime: convertToLocal(end, timezoneOffset).getTime(),
            bucketSizeMs,
            hoverIntervalMs,
            data: filledResults
        });

    } catch (err) {
        console.error('Network Usage Error:', err);
        err.statusCode = 500;
        next(err);
    }
};

const getThroughputHistoryByPickPoint = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { page = 1, limit = 50, companyId, projectId, environmentId, searchItem, itemId, logDescription, loghttpstatus, startTime, endTime, logtriggerstatus, logUniqueId, logPath, reviewed } = req.body;

        let matchStage = { exception_type: { $exists: false }, path: { $exists: true } };

        // Apply date filter only if provided
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            matchStage.createdAt = { $gte: start, $lte: end };
        }

        // Company filter
        if (companyId && companyId !== "all" && mongoose.Types.ObjectId.isValid(companyId)) {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }

        // Project filter
        if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        }
        // If projectId not provided, do not filter (matches all projects)

        // Environment filter
        if (environmentId && environmentId !== "all" && mongoose.Types.ObjectId.isValid(environmentId)) {
            matchStage.environmentId = mongoose.Types.ObjectId(environmentId);
        }

        // Item filters
        if (searchItem && searchItem !== "") matchStage.item_id = mongoose.Types.ObjectId(searchItem);
        if (itemId && itemId !== "all" && mongoose.Types.ObjectId.isValid(itemId)) matchStage.item_id = mongoose.Types.ObjectId(itemId);

        // Unique ID filter
        if (logUniqueId && logUniqueId.trim() !== "") matchStage.unique_id = logUniqueId.trim();

        // Path filter
        if (logPath && logPath.trim() !== "") {
            matchStage.path = { $regex: logPath, $options: "i" };
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        const limitRecord = Math.max(parseInt(limit) || 10, 0);
        const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

        const basePipeline = [
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "items",
                    localField: "item_id",
                    foreignField: "_id",
                    as: "item_details",
                    pipeline: [{ $project: { ItemName: 1 } }]
                }
            },
            { $unwind: { path: "$item_details", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$unique_id", "$$unique_id"] }, action: "Last End" } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { description: 1, httpStatus: 1, createdAt: 1 } },
                    ],
                    as: "last_end_log_history"
                }
            },
            { $unwind: { path: "$last_end_log_history", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$unique_id", "$$unique_id"] } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { description: 1, createdAt: 1 } },
                    ],
                    as: "last_log_history"
                }
            },
            { $unwind: { path: "$last_log_history", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "OutBound Log",
                                description: "Log Description"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1 } },
                    ],
                    as: "log_description"
                }
            },
            { $unwind: { path: "$log_description", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "OutBound Trigger",
                                description: "OutBound Trigger"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { isTriggeredOutbound: 1 } },
                    ],
                    as: "log_outbound_trigger"
                }
            },
            { $unwind: { path: "$log_outbound_trigger", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "Outbound API Post Data"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { _id: 1 } }
                    ],
                    as: "outbound_api_post_data"
                }
            },
            { $unwind: { path: "$outbound_api_post_data", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "Review"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1, createdAt: 1 } }
                    ],
                    as: "review_logs"
                }
            },
            { $unwind: { path: "$review_logs", preserveNullAndEmptyArrays: true } },
            { $addFields: { isReviewed: { $cond: [{ $ifNull: ["$review_logs", false] }, true, false] } } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$unique_id", "$$unique_id"] }, action: "Outbound API Response" } },
                        { $project: { httpStatus: 1 } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: "all_log_httpstatus"
                }
            },
        ];

        // Extra filters same as findAllGroup
        if (logDescription || loghttpstatus) {
            basePipeline.push({
                $match: {
                    ...(logDescription && { "log_description.datas": { $regex: logDescription, $options: "i" } }),
                    ...(loghttpstatus && { "all_log_httpstatus.httpStatus": { $regex: loghttpstatus, $options: "i" } })
                }
            });
        }

        if (logtriggerstatus === "triggered") {
            basePipeline.push({
                $match: {
                    $or: [
                        { "log_outbound_trigger.isTriggeredOutbound": true },
                        { outbound_api_post_data: { $exists: true } }
                    ]
                }
            });
        } else if (logtriggerstatus === "not_triggered") {
            basePipeline.push({
                $match: {
                    $and: [
                        { $or: [{ "log_outbound_trigger.isTriggeredOutbound": { $ne: true } }, { log_outbound_trigger: { $exists: false } }] },
                        { outbound_api_post_data: { $exists: false } }
                    ]
                }
            });
        }

        if (reviewed === "reviewed") basePipeline.push({ $match: { isReviewed: true } });
        else if (reviewed === "not_reviewed") basePipeline.push({ $match: { isReviewed: false } });

        // Count
        const countPipeline = [...basePipeline, { $count: "count" }];
        const [countResult] = await logHistoryModel.aggregate(countPipeline);
        const totalCount = countResult?.count || 0;

        // Pagination & projection
        const dataPipeline = [
            ...basePipeline,
            { $skip: skipRecord },
            { $limit: limitRecord },
            {
                $project: {
                    unique_id: 1, type: 1, path: 1, item_id: 1, createdAt: 1,
                    "item_details.ItemName": 1,
                    last_log_history: 1, last_end_log_history: 1,
                    log_description: 1, log_outbound_trigger: 1,
                    all_log_httpstatus: 1, review_logs: 1,
                    isReviewed: 1, reviewed_logs: 1
                }
            }
        ];

        const logHistory = await logHistoryModel.aggregate(dataPipeline);

        return res.status(200).send({
            status: 1,
            message: "Log history retrieved successfully!",
            data: logHistory,
            total: totalCount
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const getExceptionHistoryByPickPoint = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { page = 1, limit = 50, companyId, projectId, startTime, endTime, exe_type, type = "exception", logDescription } = req.body;

        let matchStage = {};

        // Exception type logic
        if (type === "exception") {
            matchStage.exception_type = { $exists: true };
            matchStage.exception_type = { $in: ["System Error", "Connection Error"] }
        }


        // Time filter
        const start = startTime ? moment(startTime).utc().toDate() : moment().utc().subtract(30, "minutes").toDate();
        const end = endTime ? moment(endTime).utc().toDate() : moment().utc().toDate();
        matchStage.createdAt = { $gte: start, $lte: end };

        // Company filter
        if (companyId && companyId !== "all" && mongoose.Types.ObjectId.isValid(companyId)) {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }

        // Project filter
        if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        const limitRecord = Math.max(parseInt(limit) || 10, 0);
        const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

        // Base pipeline
        const basePipeline = [
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                path: { $exists: true, $ne: "" }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: "last_end_log_history"
                }
            },
            {
                $unwind: {
                    path: "$last_end_log_history",
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "OutBound Log",
                                description: "Log Description"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1 } }
                    ],
                    as: "log_description"
                }
            },
            { $unwind: { path: "$log_description", preserveNullAndEmptyArrays: true } }
        ];

        if (logDescription && logDescription.trim() !== "") {
            basePipeline.push({
                $match: {
                    "log_description.datas": { $regex: logDescription.trim(), $options: "i" }
                }
            });
        }

        // Count total
        const countPipeline = [...basePipeline, { $count: "count" }];
        const [countResult] = await logHistoryModel.aggregate(countPipeline);
        const total = countResult?.count || 0;

        // Additional totals by exception type
        const connectionErrorTotal = await logHistoryModel.countDocuments({
            ...matchStage,
            exception_type: "Connection Error"
        });
        const systemErrorTotal = await logHistoryModel.countDocuments({
            ...matchStage,
            exception_type: "System Error"
        });

        // Paginated data
        const dataPipeline = [
            ...basePipeline,
            { $skip: skipRecord },
            { $limit: limitRecord }
        ];

        const logHistories = await logHistoryModel.aggregate(dataPipeline);

        return res.status(200).send({
            status: 1,
            message: "Log history retrieved successfully!",
            data: logHistories,
            total,
            connectionErrorTotal,
            formulaErrorTotal: 0,
            systemErrorTotal
        });
    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const getTransactionsList = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { page = 1, limit = 10, companyId, projectId, itemId, startTime, endTime, logDescription } = req.body;

        let matchStage = { exception_type: { $exists: false }, path: { $exists: true } };

        // Apply date filter only if provided
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            matchStage.createdAt = { $gte: start, $lte: end };
        }

        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId != "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }
        if (projectId && projectId != "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (projectId == "all") {

        } else {
            matchStage.projectId = null;
        }

        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId != "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        const limitRecord = Math.max(parseInt(limit) || 10, 0);
        const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

        const basePipeline = [
            { $match: matchStage },
            { $sort: { createdAt: -1 } },
            {
                $lookup: {
                    from: "items",
                    localField: "item_id",
                    foreignField: "_id",
                    as: "item_details",
                    pipeline: [{ $project: { ItemName: 1 } }]
                }
            },
            { $unwind: { path: "$item_details", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$unique_id", "$$unique_id"] }, action: "Last End" } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { description: 1, httpStatus: 1, createdAt: 1 } },
                    ],
                    as: "last_end_log_history"
                }
            },
            { $unwind: { path: "$last_end_log_history", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        { $match: { $expr: { $eq: ["$unique_id", "$$unique_id"] } } },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { description: 1, createdAt: 1 } },
                    ],
                    as: "last_log_history"
                }
            },
            { $unwind: { path: "$last_log_history", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "OutBound Log",
                                description: "Log Description"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1 } },
                    ],
                    as: "log_description"
                }
            },
            { $unwind: { path: "$log_description", preserveNullAndEmptyArrays: true } },
        ];

        if (logDescription) {
            basePipeline.push({
                $match: {
                    ...(logDescription && {
                        "log_description.datas": { $regex: logDescription, $options: "i" }
                    })
                }
            });
        }

        // Count
        const countPipeline = [...basePipeline, { $count: "count" }];
        const [countResult] = await logHistoryModel.aggregate(countPipeline);
        const totalCount = countResult?.count || 0;

        // Pagination & projection
        const dataPipeline = [
            ...basePipeline,
            { $skip: skipRecord },
            { $limit: limitRecord },
            {
                $project: {
                    unique_id: 1, type: 1, path: 1, item_id: 1, createdAt: 1,
                    "item_details.ItemName": 1,
                    last_log_history: 1, last_end_log_history: 1,
                    log_description: 1, log_outbound_trigger: 1,
                    all_log_httpstatus: 1, review_logs: 1,
                    isReviewed: 1, reviewed_logs: 1
                }
            }
        ];

        const logHistory = await logHistoryModel.aggregate(dataPipeline);

        return res.status(200).send({
            status: 1,
            message: "Log history retrieved successfully!",
            data: logHistory,
            total: totalCount
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
}

const getSlowestTransactions = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { companyId, projectId, itemId, startTime, endTime, logDescription } = req.body;

        let matchStage = { exception_type: { $exists: false } };

        // Apply date filter
        if (startTime && endTime) {
            const start = new Date(startTime);
            const end = new Date(endTime);
            matchStage.createdAt = { $gte: start, $lte: end };
        }

        // Filter by companyId
        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId !== "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }

        // Filter by projectId
        if (projectId && projectId !== "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (!projectId || projectId === "all") {
            // include all projects
        } else {
            matchStage.projectId = null;
        }

        // Filter by itemId
        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId != "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        if (companyCode) matchStage.CompanyCode = companyCode;

        const pipeline = [
            { $match: matchStage },

            // Include item details
            {
                $lookup: {
                    from: "items",
                    localField: "item_id",
                    foreignField: "_id",
                    as: "item_details",
                    pipeline: [{ $project: { ItemName: 1 } }]
                }
            },
            { $unwind: { path: "$item_details", preserveNullAndEmptyArrays: true } },

            // Group by unique_id
            {
                $group: {
                    _id: "$unique_id",
                    transactionId: { $first: "$unique_id" },
                    companyId: { $first: "$companyId" },
                    projectId: { $first: "$projectId" },
                    item_id: { $first: "$item_id" },
                    type: { $first: "$type" },
                    createdAt: { $first: "$createdAt" },
                    startTime: { $min: "$createdAt" },
                    endTime: { $max: "$createdAt" },
                    item_details: { $first: "$item_details" },
                    paths: { $push: "$path" }
                }
            },

            // Add path & duration fields
            {
                $addFields: {
                    path: {
                        $let: {
                            vars: { validPaths: { $filter: { input: "$paths", cond: { $ne: ["$$this", null] } } } },
                            in: { $arrayElemAt: ["$$validPaths", -1] }
                        }
                    },
                    durationMs: { $subtract: ["$endTime", "$startTime"] }
                }
            },

            // Lookup last_end_log
            {
                $lookup: {
                    from: "log_histories",
                    let: { transactionId: "$transactionId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ["$unique_id", "$$transactionId"] },
                                        { $eq: ["$action", "Last End"] }
                                    ]
                                }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { httpStatus: 1, createdAt: 1 } }
                    ],
                    as: "last_end_log"
                }
            },
            { $unwind: { path: "$last_end_log", preserveNullAndEmptyArrays: true } },
            {
                $lookup: {
                    from: "log_histories",
                    let: { transactionId: "$transactionId" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$transactionId"] },
                                action: "OutBound Log",
                                description: "Log Description"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1 } }
                    ],
                    as: "log_description"
                }
            },
            { $unwind: { path: "$log_description", preserveNullAndEmptyArrays: true } },
        ];

        if (logDescription) {
            pipeline.push({
                $match: {
                    "log_description.datas": { $regex: logDescription, $options: "i" }
                }
            });
        }

        // Sort and limit (Top 10 slowest)
        pipeline.push(
            { $sort: { durationMs: -1 } },
            { $limit: 10 },
            {
                $project: {
                    unique_id: "$transactionId",
                    type: 1,
                    path: 1,
                    createdAt: 1,
                    "item_details.ItemName": 1,
                    startTime: 1,
                    endTime: 1,
                    durationMs: 1,
                    httpStatus: "$last_end_log.httpStatus",
                    log_description: 1
                }
            }
        );

        const slowestTransactions = await logHistoryModel.aggregate(pipeline);

        return res.status(200).send({
            status: 1,
            message: "Top 10 slowest transactions retrieved successfully!",
            data: slowestTransactions
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const getExceptionList = async (req, res, next) => {
    try {
        const { companyCode } = extractUserInfoFromToken(req.cookies);
        let { page = 1, limit = 10, companyId, projectId, itemId, startTime, endTime, type = "exception", logDescription } = req.body;

        let matchStage = {};

        // Exception type logic
        if (type === "exception") {
            matchStage.exception_type = { $exists: true };
            matchStage.exception_type = { $in: ["System Error", "Connection Error"] }
        }

        // Time filter
        const start = startTime ? moment(startTime).utc().toDate() : moment().utc().subtract(30, "minutes").toDate();
        const end = endTime ? moment(endTime).utc().toDate() : moment().utc().toDate();
        matchStage.createdAt = { $gte: start, $lte: end };

        if (companyId && mongoose.Types.ObjectId.isValid(companyId) && companyId != "all") {
            matchStage.companyId = mongoose.Types.ObjectId(companyId);
        }
        if (projectId && projectId != "all" && mongoose.Types.ObjectId.isValid(projectId)) {
            matchStage.projectId = mongoose.Types.ObjectId(projectId);
        } else if (projectId == "all") {

        } else {
            matchStage.projectId = null;
        }

        if (itemId && mongoose.Types.ObjectId.isValid(itemId) && itemId != "all") {
            matchStage.item_id = mongoose.Types.ObjectId(itemId);
        }

        const limitRecord = Math.max(parseInt(limit) || 10, 0);
        const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

        const total = await logHistoryModel.countDocuments(matchStage);

        if (companyCode) matchStage.CompanyCode = companyCode;

        let basePipeline = [
            { $match: matchStage },
            { $sort: { createdAt: 1 } },
            { $skip: skipRecord },
            { $limit: limitRecord },
            {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                path: { $exists: true, $ne: "" }
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 }
                    ],
                    as: "last_end_log_history"
                }
            },
            {
                $unwind: {
                    path: "$last_end_log_history",
                    preserveNullAndEmptyArrays: true
                }
            }, {
                $lookup: {
                    from: "log_histories",
                    let: { unique_id: "$unique_id" },
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ["$unique_id", "$$unique_id"] },
                                action: "OutBound Log",
                                description: "Log Description"
                            }
                        },
                        { $sort: { createdAt: -1 } },
                        { $limit: 1 },
                        { $project: { datas: 1 } },
                    ],
                    as: "log_description"
                }
            },
            { $unwind: { path: "$log_description", preserveNullAndEmptyArrays: true } },
        ]

        if (logDescription) {
            basePipeline.push({
                $match: {
                    ...(logDescription && {
                        "log_description.datas": { $regex: logDescription, $options: "i" }
                    })
                }
            });
        }

        const logHistories = await logHistoryModel.aggregate(basePipeline);

        return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistories, total });
    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

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

module.exports = { getThroughput, getExceptionChart, getNetworkUsage, getThroughputHistoryByPickPoint, getExceptionHistoryByPickPoint, getTransactionsList, getSlowestTransactions, getExceptionList };
