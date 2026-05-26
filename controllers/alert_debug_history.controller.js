const jwtDecode = require("jwt-decode");
const config = require("../config");
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

        const totalAggregation = await alert_history_debugModel.aggregate([
            ...basePipeline,
            { $count: "total" }
        ]);

        const total = totalAggregation[0]?.total || 0;

        const data = await alert_history_debugModel.aggregate([
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

        const data = await alert_history_debugModel.aggregate([
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
        const totalAggregation = await alert_history_debugModel.aggregate([
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
        const data = await alert_history_debugModel.aggregate([
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


module.exports = { list, detail, alertDetailsLogs };