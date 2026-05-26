const jwtDecode = require("jwt-decode");
const config = require("../config");
const diff_checkerModel = require("../models/diff_history.model");
const { default: axios } = require("axios");

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
        const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

        const baseQuery = process.env.EnableGima === "true" ? { companyCode } : {};

        if (req.body.fromDate && req.body.toDate) {
            const from = new Date(req.body.fromDate);
            const to = new Date(req.body.toDate);
            baseQuery.createdAt = { $gte: from, $lte: to };
        }

        const pipeline = [
            { $match: baseQuery },
            {
                $group: {
                    _id: "$unique_id",

                    item_id: { $first: "$item_id" },
                    ItemName: { $first: "$ItemName" },
                    type: { $first: "$type" },
                    log_request_id: { $first: "$log_request_id" },
                    entrypointURL: { $first: "$path" },
                    companyCode: { $first: "$companyCode" },
                    createdAt: { $min: "$createdAt" },
                    lastUpdated: { $max: "$createdAt" },

                    records: {
                        $push: {
                            type: "$type",
                            action: "$action",
                            description: "$description",
                            httpStatus: "$httpStatus",
                            datas: "$datas"
                        }
                    },

                }
            },
            {
                $addFields: {
                    diffCountEntry: {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: "$records",
                                    as: "r",
                                    cond: { $eq: ["$$r.action", "Diff Row Count"] }
                                }
                            },
                            -1
                        ]
                    }
                }
            },
            {
                $addFields: {
                    totalDiffRow: {
                        $cond: [
                            { $ne: ["$diffCountEntry", null] },
                            {
                                $cond: [
                                    { $isNumber: { $toDouble: "$diffCountEntry.description" } },
                                    { $toInt: "$diffCountEntry.description" },
                                    0
                                ]
                            },
                            0
                        ]
                    }
                }
            },

            { $sort: { createdAt: -1 } },
            { $skip: skipRecord },
            { $limit: limitRecord },
            {
                $project: {
                    _id: 1,
                    item_id: 1,
                    ItemName: 1,
                    unique_id: 1,
                    log_request_id: 1,
                    entrypointURL: 1,
                    type: 1,
                    totalDiffRow: 1,
                    createdAt: 1,
                    companyCode: 1,
                }
            }
        ];

        const records = await diff_checkerModel.aggregate(pipeline);

        // Get total count (for pagination)
        const countPipeline = [
            { $match: baseQuery },
            {
                $group: {
                    _id: "$unique_id"
                }
            },
            { $count: "total" }
        ];

        const countResult = await diff_checkerModel.aggregate(countPipeline);
        const total = countResult.length > 0 ? countResult[0].total : 0;

        return res.status(200).json({
            status: 1,
            message: "Diff records retrieved successfully!",
            data: records,
            total
        });

    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const detail = async (req, res, next) => {
    try {
        const record = await diff_checkerModel.find({ unique_id: req.params.id });
        if (!record) {
            return res.status(404).json({ status: 0, message: "Record not found!" });
        }

        return res.status(200).json({
            status: 1,
            message: "Diff record retrieved successfully!",
            data: record
        });
    } catch (err) {
        err.statusCode = 500;
        next(err);
    }
};

const diff_checker_details = async (req, res, next) => {
  try {
    const uniqueId = req.params.id;
    if (!uniqueId) {
      return res.status(400).json({
        status: 0,
        message: "unique_id is required in the URL"
      });
    }

    const pipeline = [
      { $match: { unique_id: uniqueId } },
      {
        $group: {
          _id: "$unique_id",
          item_id: { $first: "$item_id" },
          ItemName: { $first: "$ItemName" },
          log_request_id: { $first: "$log_request_id" },
          entrypointURL: { $first: "$path" },
          companyCode: { $first: "$companyCode" },
          createdAt: { $min: "$createdAt" },
          lastUpdated: { $max: "$createdAt" },
          details: {
            $push: {
              type: "$type",
              action: "$action",
              description: "$description",
              httpStatus: "$httpStatus",
              datas: "$datas",
              createdAt: "$createdAt"
            }
          },
          types: { $addToSet: "$type" }
        }
      },
      {
        $addFields: {
          unique_id: "$_id",
          type: {
            $cond: {
              if: { $eq: [{ $size: "$types" }, 1] },
              then: { $arrayElemAt: ["$types", 0] },
              else: "Both"
            }
          },
          totalDiffRow: {
            $let: {
              vars: {
                diffEntry: {
                  $arrayElemAt: [
                    {
                      $filter: {
                        input: "$details",
                        cond: { $eq: ["$$this.action", "Diff Row Count"] }
                      }
                    },
                    -1
                  ]
                }
              },
              in: {
                $cond: [
                  { $ne: ["$$diffEntry", null] },
                  { $toInt: { $ifNull: ["$$diffEntry.description", "0"] } },
                  0
                ]
              }
            }
          },
          postDataEntry: {
            $arrayElemAt: [
              {
                $filter: {
                  input: "$details",
                  cond: {
                    $in: [
                      "$$this.action",
                      [
                        "Inbound Diff Checker Return URL Post Data",
                        "Outbound Diff Checker Return URL Post Data"
                      ]
                    ]
                  }
                }
              },
              -1
            ]
          }
        }
      },
      {
        $addFields: {
          parsedDatas: {
            $cond: [
              { $ne: ["$postDataEntry", null] },
              {
                $cond: [
                  { $eq: [{ $type: "$postDataEntry.datas" }, "string"] },
                  {
                    $function: {
                      body: "function(str) { try { return JSON.parse(str); } catch(e) { return {}; } }",
                      args: ["$postDataEntry.datas"],
                      lang: "js"
                    }
                  },
                  "$postDataEntry.datas"
                ]
              },
              {}
            ]
          }
        }
      },
      {
        $addFields: {
          endpointURL: "$parsedDatas.endpointURL",
          template: "$parsedDatas.template",
          body: "$parsedDatas.body"
        }
      },
      {
        $project: {
          _id: 0,
          unique_id: 1,
          item_id: 1,
          ItemName: 1,
          log_request_id: 1,
          entrypointURL: 1,
          endpointURL: 1,
          type: 1,
          totalDiffRow: 1,
          createdAt: 1,
          lastUpdated: 1,
          companyCode: 1,
          details: 1,
          body: 1,
          template: 1
        }
      }
    ];

    const result = await diff_checkerModel.aggregate(pipeline);
    
    if (!result || result.length === 0) {
      return res.status(404).json({
        status: 0,
        message: "No diff records found for this unique_id"
      });
    }

    return res.status(200).json({
      status: 1,
      message: "Diff details retrieved successfully!",
      data: result[0]
    });
  } catch (err) {
    err.statusCode = err.statusCode || 500;
    next(err);
  }
};

const diff_entry_create = async (record) => {
    if (!record) {
        console.error("No record provided to store.");
        return null;
    }

    try {
        const savedRecord = await diff_checkerModel.create(record);
        console.log("Diff record saved successfully:", savedRecord._id);
        return savedRecord;
    } catch (err) {
        console.error("Error saving diff record:", err);
        return null;
    }
};

const diffCheckerReturnUrl = async (infoData, url) => {
    try {
        const response = await axios({
            method: "POST",
            url,
            headers: { "Content-Type": "application/json" },
            data: infoData,
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
        let errorMessage = error.response?.data?.message || error.message || "";
        return {
            success: false,
            error: error,
            errorMessage,
            status: error.response?.status || 500,
            statusText: error.response?.statusText || "Error"
        };
    }
}

const bulkSaveDiffHistory = async (logs, retries = 3, retryDelay = 500) => {
    try {

        const sortedLogs = logs.sort((a, b) => {
            const timeA = new Date(a.createdAt).getTime();
            const timeB = new Date(b.createdAt).getTime();
            return timeA - timeB || (a._id?.toString() || '').localeCompare(b._id?.toString() || '');
        });

        const result = await diff_checkerModel.insertMany(sortedLogs, {
            ordered: true,
            timestamps: false,
            writeConcern: { w: 1 },
        });
        console.log(`[insertMany] Inserted ${result.length} logs`);
        return { status: 1, insertedCount: result.length };
    } catch (err) {
        console.error(`[insertMany Error]`, err.message);
        if (retries > 0) {
            await new Promise(res => setTimeout(res, 500));
            return bulkSaveDiffHistory(logs, retries - 1);
        }
        return { status: 0, error: err };
    }
}


module.exports = { list, detail, diff_checker_details, diff_entry_create, diffCheckerReturnUrl, bulkSaveDiffHistory };