const fs = require("fs");
const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const logHistoryModel = require("../models/log_history.model");
const favouriteModel = require("../models/favourite.model");
const usersModel = require("../models/user.model");
const environmentModel = require("../models/environments.model");
const companyModel = require("../models/companies.model");
const projectModel = require("../models/projects.model");
const logQueryModel = require("../models/log_query.model");
const itemModel = require("../models/item.model");
const recentSearchHistoryModel = require("../models/recent_search_history.model");
const emailFailureModel = require("../models/email_failures.model");
const { v4: uuidv4 } = require("uuid");
const { safeJSONStringify } = require("../my_modules/checkSize");
const { logUpdateQueue } = require("../queues/config/queuesConfigartion");
const { default: axios } = require("axios");
const { updateLogDescription } = require("../queues/helper/logHelpers");

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

const validateLogHistoryInput = (body) => {
	if (!body.unique_id) {
		return "Scheduler ID not found!";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const validationError = validateLogHistoryInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const logHistory = new logHistoryModel(req.body);

		const createdLogHistory = await logHistory.save();

		return res.status(200).send({ status: 1, message: "Log history created successfully!", id: createdLogHistory._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const createLog = async (log) => {
	try {
		const validationError = validateLogHistoryInput(log);
		if (validationError) {
			return { status: 0, message: validationError };
		}
		const logHistory = new logHistoryModel(log);
		const createdLogHistory = await logHistory.save();
		return { status: 1, message: "Log history created successfully!", id: createdLogHistory._id };
	} catch (err) {
		return {
			status: 0,
			message: "Error creating log history",
			error: err
		};
	}
};

const updateLog = async (log) => {
	try {
		const { unique_id, companyId, projectId, environmentId, companyName, projectName, environmentName } = log;
		const updateResult = await logHistoryModel.updateMany(
			{ unique_id },
			{
				$set: { companyId, projectId, environmentId, companyName, projectName, environmentName }
			},
			{ timestamps: false }
		);

		return { status: 1, message: "Log history created successfully!", updateResult };
	} catch (err) {
		return {
			status: 0,
			message: "Error updating log history",
			error: err
		};
	}
};

async function blukSave(logs, retries = 3) {
	try {

		const sortedLogs = logs.sort((a, b) => {
			const timeA = new Date(a.createdAt).getTime();
			const timeB = new Date(b.createdAt).getTime();
			return timeA - timeB || (a._id?.toString() || '').localeCompare(b._id?.toString() || '');
		});

		const result = await logHistoryModel.insertMany(sortedLogs , {
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
			return blukSave(logs, retries - 1);
		}
		return { status: 0, error: err };
	}
}

const updateLogByItemId = async (req, res, next) => {
	try {
		const { itemId } = req.params;
		const { action, companyId } = req.query;
		const batchSize = parseInt(req.query.batchSize) || 5000;

		if (!mongoose.Types.ObjectId.isValid(itemId)) {
			return res.status(400).json({ status: 0, message: "Invalid itemId" });
		}

		const objectItemId = new mongoose.Types.ObjectId(itemId);

		const baseFilter = {
			item_id: objectItemId,
			unique_id: { $ne: null }
		};

		let uniqueIdList = [];
		let lastId = null;

		while (true) {
			const batch = await logHistoryModel
				.aggregate([
					{ $match: lastId ? { ...baseFilter, _id: { $gt: lastId } } : baseFilter },
					{ $sort: { _id: 1 } },
					{ $group: { _id: "$unique_id" } },
					{ $limit: batchSize }
				]);

			if (!batch.length) break;

			uniqueIdList.push(...batch.map(b => b._id));
			lastId = batch[batch.length - 1]._id;
			if (batch.length < batchSize) break;
		}

		let totalFilled = 0;

		if (uniqueIdList.length > 0) {
			const bulkOps = uniqueIdList.map(uniqueId => ({
				updateMany: {
					filter: { unique_id: uniqueId, item_id: { $in: [null, undefined] } },
					update: { $set: { item_id: objectItemId } }
				}
			}));

			const result = await logHistoryModel.bulkWrite(bulkOps, { ordered: false });
			totalFilled = Object.values(result.result?.nModified || {}).reduce((a, b) => a + b, 0);
		}

		const referenceLog = await logHistoryModel.findOne({
			item_id: objectItemId,
			companyId: { $ne: null },
			environmentId: { $ne: null },
			companyName: { $ne: null },
			environmentName: { $ne: null }
		}).sort({ createdAt: -1 });

		if (!referenceLog) {
			return res.status(404).json({
				status: 0,
				message: "No complete reference log found after filling item_id"
			});
		}

		const {
			companyId: refCompanyId,
			projectId,
			environmentId,
			companyName,
			projectName,
			environmentName
		} = referenceLog;

		const fieldUpdateFilter = {
			item_id: objectItemId,
			$or: [
				{ companyId: null },
				{ environmentId: null },
				{ companyName: null },
				{ environmentName: null }
			]
		};

		if (action) fieldUpdateFilter.action = action;
		if (companyId === "null") fieldUpdateFilter.companyId = null;
		else if (companyId) fieldUpdateFilter.companyId = companyId;

		const updateResult = await logHistoryModel.updateMany(
			fieldUpdateFilter,
			{
				$set: {
					companyId: refCompanyId,
					projectId,
					environmentId,
					companyName,
					projectName,
					environmentName
				}
			},
			{ timestamps: false }
		);

		return res.status(200).json({
			status: 1,
			message: "item_id filled and logs updated successfully",
			uniqueIdsFilled: uniqueIdList.length,
			itemIdFilledCount: totalFilled,
			fieldUpdateCount: updateResult.modifiedCount,
			filterApplied: { action, companyId },
			batchSizeUsed: batchSize
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateLogByItemIdwithRequestId = async (req, res, next) => {
	try {
		const { itemId } = req.params;

		if (!mongoose.Types.ObjectId.isValid(itemId)) {
			return res.status(400).json({ status: 0, message: "Invalid itemId" });
		}

		const objectItemId = new mongoose.Types.ObjectId(itemId);

		// Step 1: Load all logs for the item, sorted
		const logs = await logHistoryModel
			.find({ item_id: objectItemId })
			.sort({ unique_id: 1, createdAt: 1, _id: 1 })
			.lean()

		if (!logs.length) {
			return res.status(200).json({
				status: 1,
				message: "No logs found for this item_id",
				updateResults: []
			});
		}

		// Step 2: Partition and decide request_ids in-memory
		let allUpdateResults = [];
		let bulkOps = [];

		// Group by unique_id
		const grouped = logs.reduce((acc, log) => {
			if (!acc[log.unique_id]) acc[log.unique_id] = [];
			acc[log.unique_id].push(log);
			return acc;
		}, {});

		for (const [uId, batch] of Object.entries(grouped)) {
			const partitions = await partitionByInboundUserPosting(batch);

			for (let i = 1; i < partitions.length; i++) {
				const itemGroup = partitions[i];

				if (!itemGroup.length) continue;

				const existing = itemGroup.find(l => l.request_id);
				const reqId = existing ? existing.request_id : uuidv4();

				const logIdsToUpdate = itemGroup
					.filter(l => !l.request_id)
					.map(l => l._id);

				if (logIdsToUpdate.length > 0) {
					bulkOps.push({
						updateMany: {
							filter: { _id: { $in: logIdsToUpdate } },
							update: { $set: { request_id: reqId } },
							upsert: false
						}
					});
				}

				allUpdateResults.push({
					unique_id: uId,
					partitionIndex: i,
					request_id: reqId,
					totalLogs: itemGroup.length,
					updated: logIdsToUpdate.length
				});
			}
		}

		// Step 3: Execute all updates in one bulkWrite
		if (bulkOps.length > 0) {
			await logHistoryModel.bulkWrite(bulkOps, { ordered: false });
		}

		return res.status(200).json({
			status: 1,
			message: "item_id filled and logs updated successfully for all unique_ids",
			updateResults: allUpdateResults
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getRequest = async (req, res, next) => {
	try {
		let { companyCode } = extractUserInfoFromToken(req.cookies);
		const { logtriggerstatus, page = 1, limit = 10, itemId, viewFromDate, viewToDate } = req.body;

		const pageNum = Math.max(parseInt(page) || 1, 1);
		const limitNum = Math.max(parseInt(limit) || 10, 1);
		const skipNum = (pageNum - 1) * limitNum;

		const basePipeline = [
			{
				$match: {
					$expr: {
						$or: [
							{
								$in: [
									"$action",
									[
										"Inbound User Posting",
										"Inbound Mapped Data",
										"Outbound Mapped Data",
										"Outbound API Post Data",
										"OutBound Log",
										"Outbound API Response",
										"OutBound Trigger",
										"OutBound Entrypoint",
										"Collection configure",
										"Inbound Validation Apply",
										"Inbound Filter Data",
										"Outbound Filter Data",
										"Outbound Apply"
									]
								]
							},
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Formula Error :" } },
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Additional Validation Error :" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Formula Error :" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Additional Validation Error :" } },
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Additional Rules" } },
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Formula" } },
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Additional Validation" } },
							{ $regexMatch: { input: "$description", regex: "^Inbound Property Additional Visibility" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Additional Rules" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Formula" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Additional Validation" } },
							{ $regexMatch: { input: "$description", regex: "^Outbound Property Additional Visibility" } }
						]
					},
					request_id: { $ne: null },
					...(itemId && itemId !== "all"
						? { item_id: new mongoose.Types.ObjectId(itemId) }
						: {}),
					...(viewFromDate || viewToDate
						? {
							createdAt: {
								...(viewFromDate ? { $gte: new Date(viewFromDate) } : {}),
								...(viewToDate ? { $lte: new Date(viewToDate) } : {})
							}
						}
						: {}),
					CompanyCode: companyCode
				}
			},
			{
				$lookup: {
					from: "items",
					localField: "item_id",
					foreignField: "_id",
					as: "item_details",
					pipeline: [{ $project: { ItemName: 1 } }]
				}
			},
			{
				$addFields: {
					itemName: { $ifNull: [{ $arrayElemAt: ["$item_details.ItemName", 0] }, null] }
				}
			},
			{
				$sort: { request_id: 1, createdAt: 1 }
			},
			{
				$group: {
					_id: "$request_id",
					records: { $push: "$$ROOT" },
					latestRecord: { $first: "$$ROOT" },
					itemName: { $first: "$itemName" },
					firstLogTime: { $first: "$createdAt" },
					lastLogTime: { $last: "$createdAt" }
				}
			},
			{
				$addFields: {
					timeDiffMs: { $subtract: ["$lastLogTime", "$firstLogTime"] }
				}
			},
			{
				$project: {
					_id: 0,
					request_id: "$_id",
					itemName: 1,
					timeDiffMs: 1,
					createdAt: "$latestRecord.createdAt",
					inboundUserPosting: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Inbound User Posting"] } } }, 0] },
							"not_execute"
						]
					},
					request_filter: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Inbound Filter Data"] } } }, 0] },
							"not_execute"
						]
					},
					request_validation: {
						$cond: [
							{ $eq: ["$request_validation", "not_execute"] },
							"not_execute",
							{
								$let: {
									vars: {
										earliestApiResponse: {
											$min: {
												$map: {
													input: {
														$filter: {
															input: "$records",
															as: "r",
															cond: { $eq: ["$$r.action", "Outbound API Response"] }
														}
													},
													as: "resp",
													in: "$$resp.createdAt"
												}
											}
										}
									},
									in: {
										$let: {
											vars: {
												allErrorLogs: {
													$filter: {
														input: "$records",
														as: "r",
														cond: {
															$and: [
																{
																	$or: [
																		{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Formula Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Additional Validation Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Formula Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Validation Error :" } }
																	]
																},
																{
																	$cond: [
																		{ $ifNull: ["$$earliestApiResponse", false] },
																		{ $lt: ["$$r.createdAt", "$$earliestApiResponse"] },
																		true
																	]
																}
															]
														}
													}
												},
												successExists: {
													$anyElementTrue: {
														$map: {
															input: "$records",
															as: "r",
															in: {
																$or: [
																	{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Additional Rules" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Formula" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Additional Validation" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Additional Visibility" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Rules" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Formula" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Validation" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Visibility" } }
																]
															}
														}
													}
												}
											},
											in: {
												message: {
													$cond: [
														{ $gt: [{ $size: "$$allErrorLogs" }, 0] },
														"Fail",
														{
															$cond: [
																"$$successExists",
																"Pass",
																"No"
															]
														}
													]
												},
												errorLog: {
													$arrayElemAt: ["$$allErrorLogs", -1]
												}
											}
										}
									}
								}
							}
						]
					},
					outboundMappedDataRequest: {
						$let: {
							vars: {
								earliestApiResponse: {
									$min: {
										$map: {
											input: {
												$filter: {
													input: "$records",
													as: "r",
													cond: { $eq: ["$$r.action", "Outbound API Response"] }
												}
											},
											as: "resp",
											in: "$$resp.createdAt"
										}
									}
								}
							},
							in: {
								$ifNull: [
									{
										$arrayElemAt: [
											{
												$filter: {
													input: "$records",
													as: "r",
													cond: {
														$and: [
															{ $eq: ["$$r.action", "Inbound Mapped Data"] },
															{
																// only filter by API Response date if it exists
																$cond: [
																	{ $ifNull: ["$$earliestApiResponse", false] },
																	{ $lt: ["$$r.createdAt", "$$earliestApiResponse"] },
																	true
																]
															}
														]
													}
												}
											},
											-1
										]
									},
									"not_execute"
								]
							}
						}
					},
					trigger_rule: {
						$ifNull: ["$records", "not_execute"]
					},
					logDescription: {
						$ifNull: [
							{
								$arrayElemAt: [
									{
										$filter: {
											input: "$records",
											as: "r",
											cond: { $eq: ["$$r.action", "OutBound Log"] }
										}
									},
									-1
								]
							},
							"not_execute"
						]
					},
					outboundMappedDataResponse: {
						$let: {
							vars: {
								lastApiResponse: {
									$last: {
										$filter: {
											input: "$records",
											as: "r",
											cond: { $eq: ["$$r.action", "Outbound API Response"] }
										}
									}
								}
							},
							in: {
								$cond: [
									{ $not: ["$$lastApiResponse"] },
									"not_execute",
									{
										$ifNull: [
											{
												$arrayElemAt: [
													{
														$filter: {
															input: "$records",
															as: "r",
															cond: {
																$and: [
																	{ $eq: ["$$r.action", "Outbound Mapped Data"] },
																	{ $gt: ["$$r.createdAt", "$$lastApiResponse.createdAt"] } // after API Response
																]
															}
														}
													},
													0
												]
											},
											"not_execute"
										]
									}
								]
							}
						}
					},
					response_validation: {
						$let: {
							vars: {
								lastApiResponse: {
									$last: {
										$filter: {
											input: "$records",
											as: "r",
											cond: { $eq: ["$$r.action", "Outbound API Response"] }
										}
									}
								}
							},
							in: {
								$cond: [
									{ $not: ["$$lastApiResponse"] },
									{ message: "No" },
									{
										$let: {
											vars: {
												errorLogs: {
													$filter: {
														input: "$records",
														as: "r",
														cond: {
															$and: [
																{
																	$or: [
																		{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Formula Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Inbound Property Additional Validation Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Formula Error :" } },
																		{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Validation Error :" } }
																	]
																},
																{ $gt: ["$$r.createdAt", "$$lastApiResponse.createdAt"] }
															]
														}
													}
												},
												successExists: {
													$anyElementTrue: {
														$map: {
															input: {
																$filter: {
																	input: "$records",
																	as: "r",
																	cond: { $gt: ["$$r.createdAt", "$$lastApiResponse.createdAt"] }
																}
															},
															as: "r",
															in: {
																$or: [
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Rules" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Formula" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Validation" } },
																	{ $regexMatch: { input: "$$r.description", regex: "^Outbound Property Additional Visibility" } }
																]
															}
														}
													}
												}
											},
											in: {
												message: {
													$cond: [
														{ $gt: [{ $size: "$$errorLogs" }, 0] },
														"Fail",
														{ $cond: ["$$successExists", "Pass", "No"] }
													]
												},
												errorLog: { $arrayElemAt: ["$$errorLogs", -1] }
											}
										}
									}
								]
							}
						}
					},
					outboundApiPostData: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Outbound API Post Data"] } } }, 0] },
							"not_execute"
						]
					},
					outboundApiResponse: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Outbound API Response"] } } }, 0] },
							"not_execute"
						]
					},
					response_filter: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Outbound Filter Data"] } } }, 0] },
							"not_execute"
						]
					},
					outboundEntrypoint: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "OutBound Entrypoint"] } } }, 0] },
							"not_execute"
						]
					},
					outboundTrigger: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $and: [{ $eq: ["$$r.action", "OutBound Trigger"] }, { $eq: ["$$r.isTriggeredOutbound", true] }] } } }, 0] },
							false
						]
					},
					collectionConfigure: {
						$ifNull: [
							{ $arrayElemAt: [{ $filter: { input: "$records", as: "r", cond: { $eq: ["$$r.action", "Collection configure"] } } }, 0] },
							"not_execute"
						]
					}
				}
			}
		];

		// Filter by trigger status if provided
		if (logtriggerstatus === "triggered") {
			basePipeline.push({ $match: { "outboundTrigger._id": { $exists: true } } });
		} else if (logtriggerstatus === "not_triggered") {
			basePipeline.push({ $match: { "outboundTrigger._id": { $exists: false } } });
		}

		// Count total
		const countPipeline = [...basePipeline, { $count: "count" }];
		const [countResult] = await logHistoryModel.aggregate(countPipeline);
		const totalCount = countResult?.count || 0;

		// Pagination
		const dataPipeline = [...basePipeline, { $sort: { createdAt: -1 } }, { $skip: skipNum }, { $limit: limitNum }];
		let result = await logHistoryModel.aggregate(dataPipeline).exec();


		result = await Promise.all(result.map(async (item) => {
			if (item.inboundUserPosting === "not_execute" && item.collectionConfigure !== "not_execute" && item.collectionConfigure.unique_id) {
				const inboundRecord = await logHistoryModel.findOne({ action: "Inbound User Posting", unique_id: item.collectionConfigure.unique_id }); if (inboundRecord) {
					item.inboundUserPosting = inboundRecord
					item.request_id = item.collectionConfigure.request_id;
				}
			}
			if (item.outboundMappedDataRequest === "not_execute" && item.collectionConfigure !== "not_execute" && item.collectionConfigure.unique_id) {
				const outboundRecord = await logHistoryModel.findOne({ action: "Inbound Mapped Data", unique_id: item.collectionConfigure.unique_id }); if (outboundRecord) {
					item.outboundMappedDataRequest = outboundRecord;
					item.request_id = item.collectionConfigure.request_id;
				}
			} return item;
		}));

		return res.json({
			status: 1,
			message: "Request logs retrieved successfully",
			data: result,
			total: totalCount,
			page: pageNum,
			limit: limitNum
		});
	} catch (err) {
		console.error("Error in getRequest:", err);
		err.statusCode = 500;
		next(err);
	}
};

const updateLogByUniqueId = async (req, res, next) => {
	const { unique_id } = req.params;
	const maxRetries = 3;
	const baseDelay = 1000; // Base delay in ms

	// Helper function to find reference log with retries
	const findReferenceLogWithRetry = async (retries = maxRetries, delay = baseDelay) => {
		try {
			const referenceLog = await logHistoryModel.findOne({
				unique_id,
				item_id: { $ne: null },
				companyId: { $ne: null },
				environmentId: { $ne: null },
				companyName: { $ne: null },
				environmentName: { $ne: null },
			}).sort({ createdAt: -1 });

			if (!referenceLog && retries > 0) {
				console.log(`No reference log found for unique_id: ${unique_id}, retries left: ${retries}`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return await findReferenceLogWithRetry(retries - 1, delay * 2);
			}

			return referenceLog;
		} catch (err) {
			console.error(`Error finding reference log for unique_id: ${unique_id}`, err.message);
			if (retries > 0) {
				console.log(`Retrying find for unique_id: ${unique_id}, retries left: ${retries}`);
				await new Promise((resolve) => setTimeout(resolve, delay));
				return await findReferenceLogWithRetry(retries - 1, delay * 2);
			}
			throw err; // No retries left, propagate the error
		}
	};

	try {
		const referenceLog = await findReferenceLogWithRetry();

		if (!referenceLog) {
			// Log to console and return 202 to suggest client retry later
			console.log(`Failed to find reference log for unique_id: ${unique_id} after ${maxRetries} retries`);
			return res.status(202).json({
				status: 0,
				message: 'No reference log found after retries. Please try again later.',
				unique_id,
			});
		}

		const { item_id, companyId, projectId, environmentId, companyName, projectName, environmentName } = referenceLog;

		const updateResult = await logHistoryModel.updateMany(
			{
				unique_id,
				$or: [
					{ item_id: null },
					{ companyId: null },
					{ environmentId: null },
					{ companyName: null },
					{ environmentName: null },
				],
			},
			{
				$set: { item_id, companyId, projectId, environmentId, companyName, projectName, environmentName },
			},
			{ timestamps: false }
		);

		return res.status(200).json({
			status: 1,
			message: 'Logs updated based on unique_id',
			updateResult,
		});
	} catch (err) {
		// Log error to console
		console.error(`Error processing unique_id: ${unique_id}`, err.message);
		err.statusCode = 500;
		next(err);
	}
};

const updateLogsBulkMissingId = async (req, res, next) => {
	const { logs } = req.body;
	const uniqueIds = [...new Set(logs.map(l => l.unique_id))];

	try {
		const referenceLogs = await logHistoryModel.aggregate([
			{
				$match: {
					unique_id: { $in: uniqueIds },
					item_id: { $ne: null },
					companyId: { $ne: null },
					environmentId: { $ne: null },
					companyName: { $ne: null },
					environmentName: { $ne: null }
				}
			},
			{ $sort: { createdAt: -1 } },
			{ $group: { _id: "$unique_id", doc: { $first: "$$ROOT" } } }
		]);

		if (referenceLogs.length === 0) {
			return res.status(200).json({
				status: 1,
				message: "No updates performed. No matching reference logs found."
			});
		}

		let updatedCount = 0;
		let errorCount = 0;

		for (const ref of referenceLogs) {
			const {
				item_id, companyId, projectId, environmentId,
				companyName, projectName, environmentName
			} = ref.doc;

			try {
				const result = await logHistoryModel.updateMany(
					{
						unique_id: ref._id,
						$or: [
							{ item_id: null },
							{ companyId: null },
							{ environmentId: null },
							{ companyName: null },
							{ environmentName: null }
						]
					},
					{
						$set: { 
							item_id, 
							companyId, 
							projectId, 
							environmentId, 
							companyName, 
							projectName, 
							environmentName 
						}
					}
				);

				updatedCount += result.modifiedCount || 0;
				console.log(`[Bulk Update] Updated ${result.modifiedCount || 0} docs for unique_id: ${ref._id}`);

			} catch (updateErr) {
				errorCount++;
				console.error(`[Bulk Update] Failed to update unique_id ${ref._id}: ${updateErr.message}`);
				// Continue with next update
			}
		}

		return res.status(200).json({
			status: 1,
			message: `Bulk update completed`,
			data: {
				processedCount: referenceLogs.length,
				updatedCount,
				errorCount,
				details: `Updated ${updatedCount} documents from ${referenceLogs.length} reference logs`
			}
		});

	} catch (err) {
		console.error(`Bulk update failed: ${err.message}`);
		err.statusCode = 500;
		next(err);
	}
};

const findAll = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		query = { ...query, exception_type: { $exists: req.body.type === "exception" } };

		if (req.body.searchItem && req.body.searchItem !== "") {
			query["item_id"] = mongoose.Types.ObjectId(req.body.searchItem);
		}

		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await logHistoryModel.countDocuments(query);
		const connectionErrorTotal = await logHistoryModel.countDocuments({
			...query,
			exception_type: "Connection Error"
		});
		const formulaErrorTotal = await logHistoryModel.countDocuments({
			...query,
			exception_type: "Formula Error"
		});
		const systemErrorTotal = await logHistoryModel.countDocuments({
			...query,
			exception_type: "System Error"
		});
		const logHistories = await logHistoryModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
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
			}
		]);

		return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistories, total, connectionErrorTotal, formulaErrorTotal, systemErrorTotal });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAllGroup = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { page, limit, type, companyId, projectId, environmentId, searchItem, itemId, logDescription, loghttpstatus, fromDate, toDate, logtriggerstatus, logUniqueId, logPath, reviewed } = req.body;

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};

		if (type === "exception") {
			query.exception_type = { $exists: true };
		} else {
			query.exception_type = { $exists: false };
		}

		query.path = { $exists: true };

		if (companyId && companyId !== 'all' && mongoose.Types.ObjectId.isValid(companyId)) {
			query.companyId = mongoose.Types.ObjectId(companyId);
		}
		if (projectId && projectId !== 'all') {
			query.projectId = projectId === " " ? null : mongoose.Types.ObjectId(projectId);
		}
		if (environmentId && environmentId !== 'all' && mongoose.Types.ObjectId.isValid(environmentId)) {
			query.environmentId = mongoose.Types.ObjectId(environmentId);
		}
		if (searchItem && searchItem !== "") {
			query.item_id = mongoose.Types.ObjectId(searchItem);
		}
		if (itemId && itemId !== 'all' && mongoose.Types.ObjectId.isValid(itemId)) {
			query.item_id = mongoose.Types.ObjectId(itemId);
		}
		if (fromDate && toDate) {
			const from = new Date(fromDate);
			const to = new Date(toDate);
			query.createdAt = { $gte: from, $lte: to };
		}
		if (logPath && logPath.trim() !== "") {
			query.path = { $regex: logPath, $options: "i" };
		} else {
			query.path = { $exists: true };
		}
		if (logUniqueId && logUniqueId.trim() !== "") {
			query.unique_id = logUniqueId.trim();
		}

		const limitRecord = Math.max(parseInt(limit) || 10, 0);
		const skipRecord = Math.max((parseInt(page) - 1) * limitRecord, 0);

		const basePipeline = [
			{ $match: query },
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
			{
				$unwind: { path: "$outbound_api_post_data", preserveNullAndEmptyArrays: true }
			},
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

			// Add flag
			{
				$addFields: {
					isReviewed: {
						$cond: [{ $ifNull: ["$review_logs", false] }, true, false]
					}
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
								action: "Outbound API Response"
							}
						},
						{ $project: { httpStatus: 1 } },
						{ $sort: { createdAt: -1 } },
						{ $limit: 1 },
					],
					as: "all_log_httpstatus"
				}
			},
		];

		// Extra filters
		if (logDescription || loghttpstatus) {
			basePipeline.push({
				$match: {
					...(logDescription && {
						"log_description.datas": { $regex: logDescription, $options: "i" }
					}),
					...(loghttpstatus && {
						"all_log_httpstatus.httpStatus": { $regex: loghttpstatus, $options: "i" }
					})
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
						{
							$or: [
								{ "log_outbound_trigger.isTriggeredOutbound": { $ne: true } },
								{ "log_outbound_trigger": { $exists: false } }
							]
						},
						{ outbound_api_post_data: { $exists: false } }
					]
				}
			});
		}

		// Reviewed filter
		if (reviewed === "reviewed") {
			basePipeline.push({ $match: { isReviewed: true } });
		} else if (reviewed === "not_reviewed") {
			basePipeline.push({ $match: { isReviewed: false } });
		}

		// Count
		const countPipeline = [...basePipeline, { $count: "count" }];
		const [countResult] = await logHistoryModel.aggregate(countPipeline);
		const totalCount = countResult?.count || 0;

		// Data with pagination
		const dataPipeline = [
			...basePipeline,
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$project: {
					unique_id: 1,
					type: 1,
					path: 1,
					item_id: 1,
					createdAt: 1,
					"item_details.ItemName": 1,
					last_log_history: 1,
					last_end_log_history: 1,
					log_description: 1,
					log_outbound_trigger: 1,
					all_log_httpstatus: 1,
					review_logs: 1,
					isReviewed: 1,
					reviewed_logs: 1
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

const findAllView = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		query = { ...query, exception_type: { $exists: req.body.type === "exception" }, unique_id: req.body.uniqueId };

		if (req.body.searchItem && req.body.searchItem !== "") {
			query["item_id"] = mongoose.Types.ObjectId(req.body.searchItem);
		}

		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const [count, logHistory] = await Promise.all([
			logHistoryModel.countDocuments(query),
			logHistoryModel.find(query)
				.sort({ createdAt: 1, updatedAt: 1, _id: 1 })
				.lean()
				.skip(skipRecord)
				.limit(limitRecord)
		])

		return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistory, total: count });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAllNewView = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		query = { ...query, exception_type: { $exists: req.body.type === "exception" }, unique_id: req.body.uniqueId };

		if (req.body.searchItem && req.body.searchItem !== "") {
			query["item_id"] = mongoose.Types.ObjectId(req.body.searchItem);
		}

		const count = await logHistoryModel.countDocuments(query);
		const logHistory = await logHistoryModel.find(query).sort({ createdAt: 1, updatedAt: 1, _id: 1 });

		let finalResponse = [];
		const partitionedData = await partitionByInboundUserPosting(logHistory);

		if (partitionedData.length > 0) {
			for (let i = 1; i < partitionedData.length; i++) {
				const itemGroup = partitionedData[i];
				if (itemGroup.length === 0) continue;

				const inboundPosting = itemGroup.find(log => log.action === "Inbound User Posting");
				const endpointUrls = filterWithIndex(itemGroup, log => log.action === "EndPoint URL");
				const outboundResponses = filterWithIndex(itemGroup, log => log.action === "Outbound API Response" && log.description === "Response Data");

				// If no outbound responses, show inbound result
				if (outboundResponses.length === 0) {
					if (endpointUrls.length > 0) {
						for (const endpointLog of endpointUrls) {
							const beforeLogs = itemGroup.slice(0, endpointLog.index + 1);
							const afterLogs = itemGroup.slice(endpointLog.index + 1);
							const item = await processInboundLogs(beforeLogs);
							let outboundEnd = {};
							const outBoundLastMailSendLog = afterLogs.find(log => log.action === "Outbound Email Send");
							if (outBoundLastMailSendLog) {
								outboundEnd = outBoundLastMailSendLog;
							} else {
								outboundEnd = afterLogs.find(log => log.action === "Outbound End");
							}
							item.outboundMail = afterLogs.filter((x) => (x.type === "Email" && (x.action === "Outbound Email Option" || x.action === "Outbound Email Connect" || x.action === "Outbound Email Send" || (x.action === "Outbound Email Failure" && x.description.startsWith("Return URL")))));
							item.status = "Not Triggered";
							item.status_code = "Not Triggered";
							item.response = { message: "Not Triggered" };
							item.response_filter = { message: "Not Triggered" };
							item.transformed_response = { message: "Not Triggered" };
							item.response_return_url = { message: "Not Triggered" };
							item.response_failure_url = { message: "Not Triggered" };
							item.response_validation = { message: "No" };
							processCommonLogs(item, afterLogs, beforeLogs);
							item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
							finalResponse.push(item);
						}
					} else {
						const item = await processInboundLogs(itemGroup);
						let outboundEnd = {};
						const outBoundLastMailSendLog = itemGroup.find(log => log.action === "Outbound Email Send");
						if (outBoundLastMailSendLog) {
							outboundEnd = outBoundLastMailSendLog;
						} else {
							outboundEnd = itemGroup.find(log => log.action === "Outbound End");
						}
						item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
						// Default outbound response placeholders
						Object.assign(item, {
							status: "Not Triggered",
							status_code: "Not Triggered",
							response: { message: "Not Triggered" },
							response_filter: { message: "Not Triggered" },
							transformed_response: { message: "Not Triggered" },
							response_return_url: { message: "Not Triggered" },
							response_failure_url: { message: "Not Triggered" },
							response_validation: { message: "No" },
							outbound_entrypoint: { message: "No" }
						});
						processCommonLogs(item, itemGroup, []);
						finalResponse.push(item);
						continue;
					}
				}

				// For each outbound response, process separately
				for (const outboundLog of outboundResponses) {
					const beforeLogs = itemGroup.slice(0, outboundLog.index);
					const afterLogs = itemGroup.slice(outboundLog.index + 1);
					const item = await processInboundLogs(beforeLogs);
					let outboundEnd = {};
					const outBoundLastMailSendLog = afterLogs.find(log => log.action === "Outbound Email Send");
					if (outBoundLastMailSendLog) {
						outboundEnd = outBoundLastMailSendLog;
					} else {
						outboundEnd = afterLogs.find(log => log.action === "Outbound End");
					}
					const outboundEntrypoint = beforeLogs.find(log => log.action === "OutBound Entrypoint");
					item.outboundMail = [];
					const currentOutboundIndex = outboundResponses.indexOf(outboundLog);
					const nextOutboundResponse = outboundResponses[currentOutboundIndex + 1];
					let relevantAfterLogs;
					if (nextOutboundResponse) {
						const nextOutboundLogIndex = nextOutboundResponse.index;
						const currentEndIndex = outboundLog.index + 1;
						relevantAfterLogs = itemGroup.slice(currentEndIndex, nextOutboundLogIndex);
					} else {
						relevantAfterLogs = afterLogs;
					}
					const outboundMail = relevantAfterLogs.filter((x) =>
						x.type === "Email" &&
						(x.action === "Outbound Email Option" ||
							x.action === "Outbound Email Connect" ||
							x.action === "Outbound Email Send" || (x.action === "Outbound Email Failure" && x.description.startsWith("Return URL")))
					);
					item.outboundMail = outboundMail;
					item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
					item.status = "Triggered";
					item.status_code = outboundLog._doc.httpStatus;
					item.response = { datas: outboundLog._doc.datas };
					item.outbound_entrypoint = { datas: outboundEntrypoint && outboundEntrypoint?.datas || "" };
					processCommonLogs(item, relevantAfterLogs, beforeLogs);
					finalResponse.push(item);
				}
			}
		}

		return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistory, finalResponse: finalResponse, partitionedData: partitionedData, total: count });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAllNewViewForFtpLogs = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		query = { ...query, exception_type: { $exists: req.body.type === "exception" }, unique_id: req.body.uniqueId };

		if (req.body.searchItem && req.body.searchItem !== "") {
			query["item_id"] = mongoose.Types.ObjectId(req.body.searchItem);
		}

		const count = await logHistoryModel.countDocuments(query);
		const logHistory = await logHistoryModel.find(query).sort({ createdAt: 1 });

		let finalResponse = [];
		const partitionedData = await partitionByInboundUserPosting(logHistory);

		if (partitionedData.length > 0) {
			for (let i = 1; i < partitionedData.length; i++) {
				const itemGroup = partitionedData[i];
				if (itemGroup.length === 0) continue;

				const inboundPosting = itemGroup.find(log => log.action === "Inbound User Posting");
				const endpointUrls = filterWithIndex(itemGroup, log => log.action === "EndPoint URL");
				const outboundResponses = filterWithIndex(itemGroup, log => log.action === "Outbound API Response" && log.description === "Response Data");

				// If no outbound responses, show inbound result
				if (outboundResponses.length === 0) {
					if (endpointUrls.length > 0) {
						for (const endpointLog of endpointUrls) {
							const beforeLogs = itemGroup.slice(0, endpointLog.index + 1);
							const afterLogs = itemGroup.slice(endpointLog.index + 1);
							const item = await processInboundLogs(beforeLogs);
							let outboundEnd = {};
							const outBoundLastMailSendLog = afterLogs.find(log => log.action === "Outbound Email Send");
							if (outBoundLastMailSendLog) {
								outboundEnd = outBoundLastMailSendLog;
							} else {
								outboundEnd = afterLogs.find(log => log.action === "Outbound End");
							}
							item.outboundMail = afterLogs.filter((x) => (x.type === "Email" && (x.action === "Outbound Email Option" || x.action === "Outbound Email Connect" || x.action === "Outbound Email Send" || (x.action === "Outbound Email Failure" && x.description.startsWith("Return URL")))));
							item.status = "Not Triggered";
							item.status_code = "Not Triggered";
							item.response = { message: "Not Triggered" };
							item.response_filter = { message: "Not Triggered" };
							item.transformed_response = { message: "Not Triggered" };
							item.response_return_url = { message: "Not Triggered" };
							item.response_failure_url = { message: "Not Triggered" };
							item.response_validation = { message: "No" };
							processCommonLogs(item, afterLogs, beforeLogs);
							item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
							finalResponse.push(item);
						}
					} else {
						const item = await processInboundLogs(itemGroup);
						let outboundEnd = {};
						const outBoundLastMailSendLog = itemGroup.find(log => log.action === "Outbound Email Send");
						if (outBoundLastMailSendLog) {
							outboundEnd = outBoundLastMailSendLog;
						} else {
							outboundEnd = itemGroup.find(log => log.action === "Outbound End");
						}
						item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
						// Default outbound response placeholders
						Object.assign(item, {
							status: "Not Triggered",
							status_code: "Not Triggered",
							response: { message: "Not Triggered" },
							response_filter: { message: "Not Triggered" },
							transformed_response: { message: "Not Triggered" },
							response_return_url: { message: "Not Triggered" },
							response_failure_url: { message: "Not Triggered" },
							response_validation: { message: "No" },
							outbound_entrypoint: { message: "No" }
						});
						processCommonLogs(item, itemGroup, []);
						finalResponse.push(item);
						continue;
					}
				}

				// For each outbound response, process separately
				for (const outboundLog of outboundResponses) {
					const beforeLogs = itemGroup.slice(0, outboundLog.index);
					const afterLogs = itemGroup.slice(outboundLog.index + 1);
					const item = await processInboundLogs(beforeLogs);
					let outboundEnd = {};
					const outBoundLastMailSendLog = afterLogs.find(log => log.action === "Outbound Email Send");
					if (outBoundLastMailSendLog) {
						outboundEnd = outBoundLastMailSendLog;
					} else {
						outboundEnd = afterLogs.find(log => log.action === "Outbound End");
					}
					const outboundEntrypoint = beforeLogs.find(log => log.action === "OutBound Entrypoint");
					item.outboundMail = [];
					const currentOutboundIndex = outboundResponses.indexOf(outboundLog);
					const nextOutboundResponse = outboundResponses[currentOutboundIndex + 1];
					let relevantAfterLogs;
					if (nextOutboundResponse) {
						const nextOutboundLogIndex = nextOutboundResponse.index;
						const currentEndIndex = outboundLog.index + 1;
						relevantAfterLogs = itemGroup.slice(currentEndIndex, nextOutboundLogIndex);
					} else {
						relevantAfterLogs = afterLogs;
					}
					const outboundMail = relevantAfterLogs.filter((x) =>
						x.type === "Email" &&
						(x.action === "Outbound Email Option" ||
							x.action === "Outbound Email Connect" ||
							x.action === "Outbound Email Send" || (x.action === "Outbound Email Failure" && x.description.startsWith("Return URL")))
					);
					item.outboundMail = outboundMail;
					item.time_consumed_ms = calculateTime(inboundPosting, outboundEnd);
					item.status = "Triggered";
					item.status_code = outboundLog._doc.httpStatus;
					item.response = { datas: outboundLog._doc.datas };
					item.outbound_entrypoint = { datas: outboundEntrypoint && outboundEntrypoint?.datas || "" };
					processCommonLogs(item, relevantAfterLogs, beforeLogs);
					finalResponse.push(item);
				}
			}
		}

		return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistory, finalResponse: finalResponse, partitionedData: partitionedData, total: count });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const isValidationError = (desc) =>
	desc.startsWith("Inbound Property Formula Error : ") ||
	desc.startsWith("Inbound Property Additional Validation Error : ") ||
	desc.startsWith("Outbound Property Formula Error : ") ||
	desc.startsWith("Outbound Property Additional Validation Error : ");

const isValidationRuleApplied = (desc) =>
	desc.startsWith("Inbound Property Additional Rules") ||
	desc.startsWith("Inbound Property Formula") ||
	desc.startsWith("Inbound Property Additional Validation") ||
	desc.startsWith("Inbound Property Additional Visibility") ||
	desc.startsWith("Outbound Property Additional Rules") ||
	desc.startsWith("Outbound Property Formula") ||
	desc.startsWith("Outbound Property Additional Validation") ||
	desc.startsWith("Outbound Property Additional Visibility");

const extractValidationResult = (logs) => {
	const reversedLogs = [...logs].reverse();
	const validationTriggerCheck = reversedLogs.find(
		log => log.action === "Inbound Validation Apply" &&
			(log.description.endsWith("= Fail") || log.description.endsWith("= Pass"))
	);

	if (!validationTriggerCheck) {
		return { message: "No" };
	}

	const originalIndex = logs.indexOf(validationTriggerCheck);
	const logsAfterValidation = logs.slice(originalIndex + 1);

	const matchedLog = logsAfterValidation.find(log =>
		log.description.includes("matched to SKIP") ||
		log.description.includes("matched to STOP")
	);

	if (matchedLog) {
		if (matchedLog.description.includes("matched to SKIP")) {
			return { message: "matched to SKIP", datas: validationTriggerCheck.description };
		}
		if (matchedLog.description.includes("matched to STOP")) {
			return { message: "matched to STOP", datas: validationTriggerCheck.description };
		}
	}

	return { message: "Pass", datas: validationTriggerCheck.description };
};

const processInboundLogs = async (logs) => {
	const item = {
		inboundMail: [],
		outboundMail: [],
		outbound_entrypoint: { message: "No" },
	};
	let errorDatas = [];

	let hasMappedData = false;
	let hasFilterData = false;
	let hasValidation = false;
	let hasReturnUrl = false;
	let hasError = false;
	let hasAppliedRule = false;

	const inboundMail = logs.filter(x =>
		x.type === "Email" &&
		(x.action === "Inbound Email Option" || x.action === "Inbound Email Connect" || x.action === "Inbound Email Send" || (x.action === "Inbound Email Failure" && x.description.startsWith("Return URL")))
	);

	for (const log of logs) {
		const { action, description, datas } = log;

		switch (action) {
			case "EndPoint URL":
				item.outbound_endpoint = description;
				break;
			case "Inbound User Posting":
				item.request = { datas };
				break;
			case "Inbound Filter Data":
				item.request_filter = { message: "Yes", datas };
				hasFilterData = true;
				break;
			case "Inbound Apply":
			case "Outbound Apply":
				if (isValidationError(description)) {
					hasError = true;
					errorDatas.push(datas);
				}
				if (isValidationRuleApplied(description)) {
					hasAppliedRule = true;
				}
				hasValidation = true;
				break;
			case "Inbound Mapped Data":
				item.transformed_request = { message: "Triggered", datas };
				hasMappedData = true;
				break;
			case "Collection Configure":
				item.request = { datas };
				item.transformed_request = { datas };
				break;
			case "Return Url":
				item.request_return_url = { message: "Triggered", datas };
				hasReturnUrl = true;
				break;
		}
	}

	if (hasValidation) {
		item.validation = hasError
			? { message: "Fail", datas: errorDatas.length === 1 ? errorDatas[0] : errorDatas }
			: hasAppliedRule ? { message: "Pass" } : { message: "No" };
	} else {
		item.validation = { message: "No" };
	}

	item.trigger_rule = extractValidationResult(logs);

	if (!hasMappedData) item.transformed_request = { message: "No Mapping" };
	if (!hasFilterData) item.request_filter = { message: "No" };
	if (!hasReturnUrl) item.request_return_url = { message: "Not Triggered" };
	if (!hasValidation) item.validation = { message: "No" };

	item.inboundMail = inboundMail;
	return item;
};

function processCommonLogs(item, relevantAfterLogs, beforeLogs) {
	let hasValidation = false;
	let hasMappedData = false;
	let hasFilterData = false;
	let hasReturnUrl = false;
	let hasResponseFailureUrl = false;
	let errorDatas = [];
	let hasError = false;
	let hasAppliedRule = false;

	for (let i = 0; i < relevantAfterLogs.length; i++) {
		const log = relevantAfterLogs[i];

		const { type, action, datas, description } = log;

		if (action === "Outbound Filter Data") {
			item.response_filter = { message: "Yes", datas };
			hasFilterData = true;
		}

		if (action === "Outbound Apply") {
			const isError =
				description.startsWith("Outbound Property Formula Error : ") ||
				description.startsWith("Outbound Property Additional Validation Error : ");

			const isAppliedRule =
				description.startsWith("Outbound Property Additional Rules") ||
				description.startsWith("Outbound Property Formula") ||
				description.startsWith("Outbound Property Additional Validation") ||
				description.startsWith("Outbound Property Additional Visibility");

			if (isError) {
				hasError = true;
				errorDatas.push(datas);
			}
			if (isAppliedRule) hasAppliedRule = true;
			hasValidation = true;
		}

		if (action === "Outbound Mapped Data") {
			// check the NEXT log if exists
			const nextLog = relevantAfterLogs[i + 1];
			if (nextLog?.action !== "Collection configure") {
				item.transformed_response = { datas };
				hasMappedData = true;
			} else {
				console.log("Skipped Outbound Mapped Data because next is Collection configure");
			}
		}

		if (action === "Return Url") {
			item.response_return_url = { message: "Triggered", datas };
			hasReturnUrl = true;
		}

		if (action === "Outbound API Failure Response") {
			item.response_failure_url = { message: "Triggered", datas };
			hasResponseFailureUrl = true;
		}
	}

	if (hasValidation) {
		item.response_validation = hasError
			? { message: "Fail", datas: errorDatas.length === 1 ? errorDatas[0] : errorDatas }
			: hasAppliedRule ? { message: "Pass" } : { message: "No" };
	} else {
		item.response_validation = { message: "No" };
	}

	const validationFail = [...beforeLogs]
		.reverse()
		.find(log => log.action === "Inbound Validation Apply" && log.description.endsWith("= Fail"));
	if (!hasMappedData) {
		item.transformed_response = validationFail
			? { message: "Not Triggered" }
			: { message: "No Mapping" };
	}
	if (!hasFilterData) item.response_filter = { message: "Not Triggered" };
	if (!hasReturnUrl) item.response_return_url = { message: "Not Triggered" };
	if (!hasResponseFailureUrl) item.response_failure_url = { message: "Not Triggered" };
}

function filterWithIndex(arr, predicate) {
	return arr.reduce((acc, item, index) => {
		if (predicate(item)) acc.push({ ...item, index });
		return acc;
	}, []);
}

const calculateTime = (start, end) => {
	if (!start || !end) return "Not Triggered";
	return new Date(end.createdAt) - new Date(start.createdAt);
};

async function partitionByInboundUserPosting(data) {
	const partitions = [];
	let currentPartition = [];

	for (const item of data) {
		if (item.action === "Inbound User Posting" && currentPartition.length > 0) {
			partitions.push(currentPartition);
			currentPartition = [];
		}
		currentPartition.push(item);
	}

	// Push the last partition if it has items
	if (currentPartition.length > 0) {
		partitions.push(currentPartition);
	}

	return partitions;
}

const findByUniqueIdLog = async (req, res, next) => {
	try {
		let query = {};

		if (req.body.uniqueId && req.body.uniqueId !== "") {
			query = {
				...query,
				unique_id: req.body.uniqueId,
				action: "Start",
				type: { $in: ["FTP", "SFTP", "DAPI"] } // Match either ftp or dapi
			};
		}

		const logHistory = await logHistoryModel.findOne(query);

		return res.status(200).send({ status: 1, message: "Log history retrieved successfully!", data: logHistory });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const exportAll = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		let query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		query = { ...query, exception_type: { $exists: false } };

		const logHistory = await logHistoryModel.find(query).sort({ createdAt: -1 });

		const todaydate = new Date();
		const logdatefilename = `export_log_histories_${todaydate.getDate()}_${todaydate.getMonth() + 1}_${todaydate.getFullYear()}.json`;
		const file = `output/uploads/${logdatefilename}`;

		fs.writeFileSync(file, JSON.stringify(logHistory, null, 4));

		res.download(file, function (error) {
			if (error) {
				return next(error);
			}
			try {
				fs.unlinkSync(file);
			} catch (err) {
				console.error("Error deleting the file after download:", err);
			}
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const importAll = async (req, res, next) => {
	try {
		const file = `output/uploads/${req.body.filename}`;
		const logData = fs.readFileSync(file);
		const logsData = JSON.parse(logData);
		const options = { ordered: true };

		const result = await logHistoryModel.insertMany(logsData, options);

		try {
			fs.unlinkSync(file);
		} catch (err) {
			console.error("Error deleting file after import:", err);
		}

		return res.status(200).send({ status: 1, message: "Logs imported successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAllLogFullListUniqueId = async (req, res, next) => {
	try {
		const { schedulerUniqueId } = req.body;

		let query = {};

		query = { ...query, unique_id: schedulerUniqueId };

		logHistoryModel.aggregate(
			[
				{ $match: query },
				{ $sort: { createdAt: 1 } },
				{
					$lookup: {
						from: 'log_histories',
						let: { unique_id: '$unique_id' },
						pipeline: [
							{
								$match: {
									$expr: { $eq: ['$unique_id', '$$unique_id'] }, $or: [
										{ action: "Last End" },
										{ action: "Outbound End" }
									]
								}
							},
							{ $sort: { createdAt: -1 } },
							{ $limit: 1 }
						],
						as: 'last_end_log_history'
					}
				},
				{
					$unwind: {
						path: '$last_end_log_history',
						preserveNullAndEmptyArrays: true
					}
				},
				{
					$project: {
						unique_id: 1,
						type: 1,
						path: 1,
						action: 1,
						datas: 1,
						httpStatus: 1,
						description: 1,
						item_id: 1,
						createdAt: 1,
						last_end_log_history: 1
					}
				}
			],
			function (error, LogHistory) {
				if (error) {
					return res.status(500).send({ message: error.message || "Some error occurred while retrieving logs." });
				}
				return res.status(200).send({ status: 1, message: "Logs retrieved successfully.", data: LogHistory });
			}
		);
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAllLogFullListForLogHistory = async (item_id, schedulerUniqueId, type) => {
	try {
		if (!schedulerUniqueId) {
			return { status: 0, message: "schedulerUniqueId is required." };
		}

		const query = { unique_id: schedulerUniqueId };

		const logs = await logHistoryModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } },
			{
				$lookup: {
					from: 'log_histories',
					let: { unique_id: '$unique_id' },
					pipeline: [
						{
							$match: {
								$expr: { $eq: ['$unique_id', '$$unique_id'] },
								$or: [
									{ action: "Last End" },
									{ action: "Outbound End" }
								]
							}
						},
						{ $sort: { createdAt: -1 } },
						{ $limit: 1 }
					],
					as: 'last_end_log_history'
				}
			},
			{
				$unwind: {
					path: '$last_end_log_history',
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$project: {
					unique_id: 1,
					type: 1,
					path: 1,
					action: 1,
					datas: 1,
					httpStatus: 1,
					description: 1,
					item_id: 1,
					createdAt: 1,
					last_end_log_history: 1
				}
			}
		]);

		return {
			status: 1,
			message: "Logs retrieved successfully.",
			data: logs
		};
	} catch (err) {
		console.error("findAllLogFullListUniqueId error:", err.message || err);
		return {
			status: 0,
			message: "Error retrieving logs",
			error: err
		};
	}
};

const findAllLogFullListUniqueIdForFTPlogs = async (req, res, next) => {
	try {
		const { schedulerUniqueId, type } = req.body;

		let query = {};
		query = { ...query, unique_id: schedulerUniqueId };

		if (type === "Outbound") {
			query["type"] = type;
		} else if (type === "DDEP Inbound") {
			query["action"] = new RegExp("Inbound .*");
		} else if (type === "DDEP Outbound") {
			query["action"] = new RegExp("Outbound .*");
		}

		const logs = await logHistoryModel.find(query);

		return res.status(200).send({ status: 1, message: "Logs retrieved successfully.", data: logs });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

async function findAllLogFullListUniqueIdForFTPlogsFn(item_id, schedulerUniqueId, type) {
	try {
		let query = { unique_id: schedulerUniqueId };

		if (type === "Outbound") {
			query["type"] = type;
		} else if (type === "DDEP Inbound") {
			query["action"] = new RegExp("Inbound .*");
		} else if (type === "DDEP Outbound") {
			query["action"] = new RegExp("Outbound .*");
		}

		const logs = await logHistoryModel.find(query);

		return {
			status: 1,
			message: "Logs retrieved successfully.",
			data: logs
		};
	} catch (err) {
		return {
			status: 0,
			message: "Internal server error",
			error: err.message || err.toString()
		};
	}
}

const deleteAll = async (req, res, next) => {
	try {
		let day = parseInt(req.params.day);
		let newDate = new Date(new Date().getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days keeps

		if (!isNaN(day) && day > 0) {
			newDate.setDate(newDate.getDate() - day);
		}

		const result = await logHistoryModel.deleteMany({ createdAt: { "$lte": newDate } });

		return res.status(200).json({ status: 1, message: "Deleted successfully" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const validateFavouriteInput = (body) => {
	if (!body.favouriteName) {
		return "favourite Name is required!";
	}
	return null;
};

const saveFavourite = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateFavouriteInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const user_details = await usersModel.findOne({ user_name: userName, companyCode: companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: 'User not found' });
		}

		const favourite_query = await new favouriteModel({
			user_id: user_details?._id,
			isActive: req.body.isActive,
			name: req.body.favouriteName,
			sequence: req.body.sequence,
			description: req.body.favouriteDescription,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const favourite_result = await favourite_query.save();

		const logQueryData = {
			favourite_id: favourite_result._id,
			company: req.body.company === 'all' ? 'ALL' : req.body.company, // ID
			company_name: req.body.company === 'all' ? 'ALL' : await getCompanyName(req.body.company),
			project: req.body.project === 'all' ? 'ALL' : req.body.project, // ID
			project_name: req.body.project === 'all' ? 'ALL' : await getProjectName(req.body.project),
			environment: req.body.environment === 'all' ? 'ALL' : req.body.environment, // ID
			environment_name: req.body.environment === 'all' ? 'ALL' : await getEnvironmentName(req.body.environment),
			item: req.body.item === 'all' ? 'ALL' : req.body.item,
			item_name: req.body.item === 'all' ? 'ALL' : await getItemName(req.body.item),
			logtriggerstatus: req.body.logtriggerstatus || '',
			uniqueId: req.body.uniqueId || '',
			path: req.body.path || '',
			descr: req.body.descr || '',
			time: req.body.time || '',
			httpStatus: req.body.httpStatus || '',
			fromDate: req.body.viewFromDate || '',
			toDate: req.body.viewToDate || '',
			companyCode,
			createdBy: userName,
			updatedBy: userName
		};

		await new logQueryModel(logQueryData).save();

		return res.status(200).send({
			status: 1,
			message: "Favourite & log query saved successfully!",
			id: favourite_result._id
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const saveRecentHistory = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const user_details = await usersModel.findOne({ user_name: userName, companyCode: companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: 'User not found' });
		}

		const logQueryData = {
			user_id: user_details?._id,
			company: req.body.company === 'all' ? 'ALL' : req.body.company, // ID
			company_name: req.body.company === 'all' ? 'ALL' : await getCompanyName(req.body.company),
			project: req.body.project === 'all' ? 'ALL' : req.body.project, // ID
			project_name: req.body.project === 'all' ? 'ALL' : await getProjectName(req.body.project),
			environment: req.body.environment === 'all' ? 'ALL' : req.body.environment, // ID
			environment_name: req.body.environment === 'all' ? 'ALL' : await getEnvironmentName(req.body.environment),
			item: req.body.item === 'all' ? 'ALL' : req.body.item,
			item_name: req.body.item === 'all' ? 'ALL' : await getItemName(req.body.item),
			logtriggerstatus: req.body.logtriggerstatus || '',
			uniqueId: req.body.uniqueId || '',
			path: req.body.path || '',
			descr: req.body.descr || '',
			time: req.body.time || '',
			httpStatus: req.body.httpStatus || '',
			fromDate: req.body.viewFromDate || '',
			toDate: req.body.viewToDate || '',
			companyCode,
			createdBy: userName,
			updatedBy: userName
		};

		let recent_search_history = await new recentSearchHistoryModel(logQueryData).save();

		const cutoffDate = new Date();
		cutoffDate.setDate(cutoffDate.getDate() - 60);

		await recentSearchHistoryModel.deleteMany({
			user_id: user_details._id,
			createdAt: { $lt: cutoffDate }
		});

		return res.status(200).send({
			status: 1,
			message: "recent search history saved successfully!",
			id: recent_search_history._id
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

async function getCompanyName(companyId) {
	try {
		if (!companyId || companyId === 'all' || !mongoose.Types.ObjectId.isValid(companyId)) {
			return '';
		}

		// Fetch only the "name" field
		const company = await companyModel.findById(companyId, { name: 1 }).lean();

		return company?.name || '';
	} catch (error) {
		console.error(`Error fetching company name for ID ${companyId}:`, error);
		return '';
	}
}

async function getProjectName(projectId) {
	try {
		if (!projectId || projectId === 'all' || !mongoose.Types.ObjectId.isValid(projectId)) {
			return '';
		}
		const project = await projectModel.findById(projectId, { name: 1 }).lean();
		return project?.name || '';
	} catch (error) {
		console.error(`Error fetching project name for ID ${projectId}:`, error);
		return '';
	}
}

async function getEnvironmentName(envId) {
	try {
		if (!envId || envId === 'all' || !mongoose.Types.ObjectId.isValid(envId)) {
			return '';
		}
		const env = await environmentModel.findById(envId, { name: 1 }).lean();
		return env?.name || '';
	} catch (error) {
		console.error(`Error fetching environment name for ID ${envId}:`, error);
		return '';
	}
}

async function getItemName(itemId) {
	try {
		if (!itemId || itemId === 'all' || !mongoose.Types.ObjectId.isValid(itemId)) {
			return '';
		}
		const item = await itemModel.findById(itemId, { ItemName: 1 }).lean();
		return item?.ItemName || '';
	} catch (error) {
		console.error(`Error fetching item name for ID ${itemId}:`, error);
		return '';
	}
}

const updateFavourite = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateFavouriteInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const user_details = await usersModel.findOne({ user_name: userName, companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: "User not found" });
		}

		const favouriteId = req.params.id;
		if (!favouriteId) {
			return res.status(400).send({ status: 0, message: "Favourite id is required!" });
		}

		// Check if favourite exists
		const existingFavourite = await favouriteModel.findOne({ _id: favouriteId, user_id: user_details._id });
		if (!existingFavourite) {
			return res.status(404).send({ status: 0, message: "Favourite not found" });
		}

		// Update favourite fields
		existingFavourite.isActive = req.body.isActive;
		existingFavourite.name = req.body.favouriteName;
		existingFavourite.sequence = req.body.sequence;
		existingFavourite.description = req.body.favouriteDescription;
		existingFavourite.updatedBy = userName;
		await existingFavourite.save();

		// Update related logQuery (if exists)
		// const logQueryUpdate = {
		// 	company: req.body.company === "all" ? "ALL" : req.body.company,
		// 	company_name: req.body.company === "all" ? "ALL" : await getCompanyName(req.body.company),
		// 	project: req.body.project === "all" ? "ALL" : req.body.project,
		// 	project_name: req.body.project === "all" ? "ALL" : await getProjectName(req.body.project),
		// 	environment: req.body.environment === "all" ? "ALL" : req.body.environment,
		// 	environment_name: req.body.environment === "all" ? "ALL" : await getEnvironmentName(req.body.environment),
		// 	item: req.body.item === "all" ? "ALL" : req.body.item,
		// 	item_name: req.body.item === "all" ? "ALL" : await getItemName(req.body.item),
		// 	logtriggerstatus: req.body.logtriggerstatus || "",
		// 	uniqueId: req.body.uniqueId || "",
		// 	path: req.body.path || "",
		// 	descr: req.body.descr || "",
		// 	time: req.body.time || "",
		// 	httpStatus: req.body.httpStatus || "",
		// 	fromDate: req.body.viewFromDate || "",
		// 	toDate: req.body.viewToDate || "",
		// 	companyCode,
		// 	updatedBy: userName
		// };

		// await logQueryModel.findOneAndUpdate(
		// 	{ favourite_id: favouriteId },
		// 	{ $set: logQueryUpdate },
		// 	{ new: true, upsert: false }
		// );

		return res.status(200).send({
			status: 1,
			message: "Favourite updated successfully!"
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getMyFavourites = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const user_details = await usersModel.findOne({ user_name: userName, companyCode: companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: 'User not found' });
		}

		let query = {};
		query.user_id = user_details._id;
		query.companyCode = companyCode;

		const limitRecord = Math.max(parseInt(req.query.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.query.page) - 1) * limitRecord, 0);

		const total = await favouriteModel.countDocuments(query);
		const logFavourites = await favouriteModel.aggregate([
			{ $match: query },
			{ $sort: { sequence: 1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "log_queries",
					localField: "_id",
					foreignField: "favourite_id",
					as: "log_query_details"
				}
			},
			{ $unwind: { path: "$log_query_details", preserveNullAndEmptyArrays: true } }
		]);

		return res.status(200).send({ status: 1, message: "Log Favourite retrieved successfully!", data: logFavourites, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const getFavouriteById = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);
		const favId = req.params.id;

		const user_details = await usersModel.findOne({ user_name: userName, companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: 'User not found' });
		}

		const favourite = await favouriteModel.findOne({
			_id: favId,
			companyCode: companyCode,
			user_id: user_details._id
		});

		if (!favourite) {
			return res.status(404).send({ status: 0, message: 'Favourite not found' });
		}

		return res.status(200).send({
			status: 1,
			message: "Favourite retrieved successfully!",
			data: favourite
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getLogQueries = async (req, res, next) => {
	try {
		// Validate token and extract user info
		let companyCode, userName;
		try {
			({ companyCode, userName } = extractUserInfoFromToken(req.cookies));
		} catch (tokenErr) {
			return res.status(401).send({ status: 0, message: "Invalid or missing token", data: null });
		}

		// Find user
		const user_details = await usersModel.findOne({ user_name: userName, companyCode: companyCode });
		if (!user_details) {
			console.warn(`User not found: ${userName}, companyCode: ${companyCode}`);
			return res.status(400).send({ status: 0, message: "User not found", data: null });
		}

		// Validate query parameters
		const limitRecord = Math.max(Number(req.query.limit) || 10, 1);
		const page = Number(req.query.page) || 1;
		if (isNaN(limitRecord) || isNaN(page)) {
			return res.status(400).send({ status: 0, message: "Invalid limit or page parameter", data: null });
		}
		const skipRecord = Math.max((page - 1) * limitRecord, 0);

		// Calculate date range
		const daysAgo = parseInt(process.env.LOG_QUERY_DAYS || 60);
		const sixtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - daysAgo));

		const query = {
			createdAt: { $gte: sixtyDaysAgo },
			companyCode: companyCode,
		};

		// Aggregation pipeline
		const [result] = await logQueryModel.aggregate([
			{ $match: query },
			{
				$lookup: {
					from: "favourites",
					localField: "favourite_id",
					foreignField: "_id",
					as: "favouriteDetails"
				}
			},
			{ $unwind: { path: "$favouriteDetails", preserveNullAndEmptyArrays: true } },
			// Add filter for favouriteDetails.user_id
			{ $match: { "favouriteDetails.user_id": user_details._id } },
			{
				$facet: {
					data: [
						{ $sort: { sequence: 1 } },
						{ $skip: skipRecord },
						{ $limit: limitRecord }
					],
					total: [{ $count: "count" }]
				}
			}
		]);

		const logQueries = result.data;
		const total = result.total[0]?.count || 0;

		return res.status(200).send({
			status: 1,
			message: "Log Queries (last 60 days) retrieved successfully!",
			data: logQueries,
			total
		});
	} catch (err) {
		console.error("Error in getLogQueries:", err);
		return res.status(500).send({ status: 0, message: "An error occurred while retrieving log queries", data: null });
	}
};

const getRecentSearchHistory = async (req, res, next) => {
	try {
		// Validate token and extract user info
		let companyCode, userName;
		try {
			({ companyCode, userName } = extractUserInfoFromToken(req.cookies));
		} catch (tokenErr) {
			return res.status(401).send({ status: 0, message: "Invalid or missing token", data: null });
		}

		// Find user
		const user_details = await usersModel.findOne({ user_name: userName, companyCode: companyCode });
		if (!user_details) {
			console.warn(`User not found: ${userName}, companyCode: ${companyCode}`);
			return res.status(400).send({ status: 0, message: "User not found", data: null });
		}

		// Validate query parameters
		const limitRecord = Math.max(Number(req.query.limit) || 10, 1);
		const page = Number(req.query.page) || 1;
		if (isNaN(limitRecord) || isNaN(page)) {
			return res.status(400).send({ status: 0, message: "Invalid limit or page parameter", data: null });
		}
		const skipRecord = Math.max((page - 1) * limitRecord, 0);

		// Calculate date range
		const daysAgo = parseInt(process.env.LOG_QUERY_DAYS || 60);
		const sixtyDaysAgo = new Date(new Date().setDate(new Date().getDate() - daysAgo));

		const query = {
			createdAt: { $gte: sixtyDaysAgo },
			companyCode: companyCode,
		};

		// Aggregation pipeline
		const [result] = await recentSearchHistoryModel.aggregate([
			{ $match: query },
			{
				$facet: {
					data: [
						{ $sort: { createdAt: -1 } },
						{ $skip: skipRecord },
						{ $limit: limitRecord }
					],
					total: [{ $count: "count" }]
				}
			}
		]);

		const logQueries = result.data;
		const total = result.total[0]?.count || 0;

		return res.status(200).send({
			status: 1,
			message: "Log recent history (last 60 days) retrieved successfully!",
			data: logQueries,
			total
		});
	} catch (err) {
		console.error("Error in getRecentSearchHistory:", err);
		return res.status(500).send({ status: 0, message: "An error occurred while retrieving log recent history", data: null });
	}
};

const getLogQuery = async (req, res, next) => {
	try {
		const queryId = req.params.id;

		if (!queryId) {
			return res.status(400).send({ status: 0, message: 'Query ID is required' });
		}

		const query = await logQueryModel.findOne({
			_id: queryId,
		});

		if (!query) {
			return res.status(404).send({ status: 0, message: 'Query not found' });
		}

		return res.status(200).send({
			status: 1,
			message: "Query retrieved successfully!",
			data: query
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const getRecentSearchHistoryById = async (req, res, next) => {
	try {
		const recent_search_id = req.params.id;

		if (!recent_search_id) {
			return res.status(400).send({ status: 0, message: 'Recent Search ID is required' });
		}

		const query = await recentSearchHistoryModel.findOne({
			_id: recent_search_id,
		});

		if (!query) {
			return res.status(404).send({ status: 0, message: 'Recent Search not found' });
		}

		return res.status(200).send({
			status: 1,
			message: "Recent Search retrieved successfully!",
			data: query
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

// controller
const deleteFavourite = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);
		const favouriteId = req.params.id;

		// Check user exists
		const user_details = await usersModel.findOne({ user_name: userName, companyCode });
		if (!user_details) {
			return res.status(400).send({ status: 0, message: "User not found" });
		}

		// Check favourite exists
		const favourite = await favouriteModel.findOne({ _id: favouriteId, user_id: user_details._id });
		if (!favourite) {
			return res.status(404).send({ status: 0, message: "Favourite not found" });
		}

		// Delete favourite
		await favouriteModel.deleteOne({ _id: favouriteId });

		// Delete logQuery entry linked with this favourite
		await logQueryModel.deleteMany({ favourite_id: favouriteId });

		return res.status(200).send({
			status: 1,
			message: "Favourite deleted successfully!"
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateLogHistory = async (req, res, next) => {
	try {
		const { uniqueId, log_description } = req.body;

		if (!uniqueId) {
			return res.status(200).json({
				status: 0,
				message: "uniqueId are required"
			});
		}

		// find and update
		const updatedLog = await logHistoryModel.findOneAndUpdate(
			{
				unique_id: uniqueId,
				action: "OutBound Log",
				description: "Log Description"
			},
			{
				$set: { datas: log_description }
			},
			{
				new: true,
				sort: { createdAt: -1 }
			}
		);

		if (!updatedLog) {
			const recrod_url = await logHistoryModel.findOne({
				unique_id: uniqueId,
				action: "EndPoint URL",
			})

			const newLog = await new logHistoryModel({
				item_id: recrod_url.item_id,
				unique_id: recrod_url.unique_id,
				type: recrod_url.type,
				action: "OutBound Log",
				description: "Log Description",
				datas: log_description,
				environmentId: recrod_url.environmentId,
				projectId: recrod_url.projectId,
				companyId: recrod_url.companyId,
				companyName: recrod_url.companyName,
				projectName: recrod_url.projectName,
				environmentName: recrod_url.environmentName,
				CompanyCode: recrod_url.CompanyCode,
				createdAt: recrod_url.createdAt,
				updatedAt: recrod_url.updatedAt,
				__v: 0
			});

			await newLog.save();

			return res.status(200).json({
				status: 1,
				message: "No base record found (EndPoint URL) to create new log"
			});
		}

		return res.status(200).json({
			status: 1,
			message: "Log history updated successfully",
			data: updatedLog
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const addReview = async (req, res, next) => {
	try {
		const { uniqueIds, comment } = req.body;

		if (!uniqueIds || !Array.isArray(uniqueIds) || uniqueIds.length === 0) {
			return res.status(200).json({
				status: 0,
				message: "At least one uniqueId is required to save review"
			});
		}

		if (!comment || comment.trim() === "") {
			return res.status(200).json({
				status: 0,
				message: "Comment is required"
			});
		}

		let reviewLogs = [];

		for (const uniqueId of uniqueIds) {
			// Just check unique_id only (latest record for that uniqueId)
			const baseLog = await logHistoryModel.findOne({
				unique_id: uniqueId
			}).sort({ createdAt: -1 });

			if (!baseLog) {
				continue; // skip if no record exists
			}

			// Create new Review log
			const reviewLog = new logHistoryModel({
				item_id: baseLog.item_id,
				unique_id: baseLog.unique_id,
				type: baseLog.type,
				action: "Review",
				description: "Review Comments",
				datas: comment,
				environmentId: baseLog.environmentId,
				projectId: baseLog.projectId,
				companyId: baseLog.companyId,
				companyName: baseLog.companyName,
				projectName: baseLog.projectName,
				environmentName: baseLog.environmentName,
				CompanyCode: baseLog.CompanyCode,
				createdAt: new Date(),
				updatedAt: new Date(),
				__v: 0
			});

			const savedLog = await reviewLog.save();
			reviewLogs.push(savedLog);
		}


		if (reviewLogs.length === 0) {
			return res.status(200).json({
				status: 0,
				message: "No record found for provided uniqueIds"
			});
		}

		return res.status(200).json({
			status: 1,
			message: "Review logs created successfully",
			data: reviewLogs
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const getReviewed = async (req, res, next) => {
	try {
		const uniqueId = req.params.uniqueId;

		if (!uniqueId) {
			return res.status(400).send({ status: 0, message: 'Unique ID is required.' });
		}

		// Parse pagination values
		const limit = parseInt(req.body.limit);
		const page = parseInt(req.body.page);

		const filter = { unique_id: uniqueId, action: "Review" };

		// Get total count first
		const total = await logHistoryModel.countDocuments(filter);

		let query = logHistoryModel.find(filter).sort({ createdAt: -1 });

		// Apply pagination only if valid
		if (!isNaN(limit) && limit > 0 && !isNaN(page) && page > 0) {
			const skip = (page - 1) * limit;
			query = query.skip(skip).limit(limit);
		}

		const logHistories = await query;

		if (!logHistories || logHistories.length === 0) {
			return res.status(200).send({ status: 1, message: 'No review logs found for the given Unique ID.', total: 0, data: [] });
		}

		return res.status(200).send({
			status: 1,
			message: "Review logs retrieved successfully.",
			total,
			data: logHistories
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateAllOutboundToInbound = async (req, res) => {
	try {
		const result = await logHistoryModel.updateMany(
			{ action: "Outbound Mapped Data" },
			{ $set: { action: "Inbound Mapped Data" } },
			{ timestamps: false }
		);

		console.log(result, "result");

		return res.status(200).json({
			status: 1,
			message: "All 'Outbound Mapped Data' updated to 'Inbound Mapped Data'",
			modifiedCount: result.modifiedCount
		});

	} catch (error) {
		console.error("Error updating Outbound → Inbound:", error);
		return res.status(500).json({ success: 0, error: error.message });
	}
};

const updateInboundAfterOutboundResponse = async (req, res) => {
	try {
		const { itemIds } = req.body;

		if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
			return res.status(400).json({ status: 0, message: "itemIds array required" });
		}

		// Validate itemIds are valid ObjectIds
		const validItemIds = itemIds
			.filter(id => mongoose.Types.ObjectId.isValid(id))
			.map(id => new mongoose.Types.ObjectId(id));

		if (validItemIds.length === 0) {
			return res.status(400).json({ status: 0, message: "No valid itemIds provided" });
		}

		let totalOutboundFound = 0;
		let totalUpdated = 0;
		const BATCH_SIZE = 5000; // Increased batch size
		const UPDATE_FLUSH_SIZE = 10000; // Increased flush size

		// Get all outbound logs at once
		const outboundLogs = await logHistoryModel.find(
			{
				item_id: { $in: validItemIds },
				action: "Outbound API Response"
			},
			{ _id: 1, request_id: 1, createdAt: 1 }
		)
			.sort({ createdAt: 1 })
			.lean();

		totalOutboundFound = outboundLogs.length;

		if (totalOutboundFound === 0) {
			return res.status(200).json({
				status: 1,
				totalOutboundFound: 0,
				totalUpdated: 0,
				message: "No outbound logs found"
			});
		}

		const idsToUpdate = new Set(); // Use Set to avoid duplicates

		// Process in batches
		for (let i = 0; i < outboundLogs.length; i += BATCH_SIZE) {
			const batch = outboundLogs.slice(i, i + BATCH_SIZE);
			await processBatchOptimized(batch, idsToUpdate);
		}

		// Bulk update all at once
		if (idsToUpdate.size > 0) {
			const updateIds = Array.from(idsToUpdate);

			// Process updates in chunks to avoid max query size
			for (let i = 0; i < updateIds.length; i += UPDATE_FLUSH_SIZE) {
				const chunk = updateIds.slice(i, i + UPDATE_FLUSH_SIZE);
				const result = await logHistoryModel.updateMany(
					{ _id: { $in: chunk } },
					{ $set: { action: "Outbound Mapped Data", description: "Mapped Data" } },
					{ timestamps: false }
				);
				totalUpdated += result.modifiedCount;
			}
		}

		return res.status(200).json({
			status: 1,
			totalOutboundFound,
			totalUpdated,
			message: `Success! Updated ${totalUpdated} logs (Inbound → Outbound Mapped Data)`
		});

	} catch (error) {
		console.error("Error in updateInboundAfterOutboundResponse:", error);
		return res.status(500).json({ status: 0, error: error.message });
	}
};

async function processBatchOptimized(outboundBatch, idsToUpdate) {
	// Build request_id map and collect unique request_ids
	const requestIdMap = new Map();
	const validObjectIdRequests = [];
	const nonObjectIdRequests = [];

	for (const log of outboundBatch) {
		const rawId = log.request_id;
		const key = rawId?._id?.toString() || rawId?.toString() || String(rawId);

		if (!requestIdMap.has(key)) {
			requestIdMap.set(key, []);

			// Collect unique request_ids for query
			if (mongoose.Types.ObjectId.isValid(key)) {
				validObjectIdRequests.push(new mongoose.Types.ObjectId(key));
			} else {
				nonObjectIdRequests.push(key);
			}
		}
		requestIdMap.get(key).push(log);
	}

	// Get earliest time in this batch
	const earliestTime = outboundBatch[0].createdAt;

	// Single optimized query for all inbound logs
	const matchQuery = {
		action: "Inbound Mapped Data",
		createdAt: { $gt: earliestTime },
		$or: []
	};

	if (validObjectIdRequests.length > 0) {
		matchQuery.$or.push({ request_id: { $in: validObjectIdRequests } });
	}
	if (nonObjectIdRequests.length > 0) {
		matchQuery.$or.push({ request_id: { $in: nonObjectIdRequests } });
	}

	// Skip query if no valid request_ids
	if (matchQuery.$or.length === 0) return;

	const allInbounds = await logHistoryModel.find(matchQuery)
		.select('_id request_id createdAt')
		.sort({ request_id: 1, createdAt: 1 }) // Sort for efficient grouping
		.lean();

	// Group inbounds by request_id
	const inboundByRequest = new Map();
	for (const log of allInbounds) {
		const rawId = log.request_id;
		const key = rawId?._id?.toString() || rawId?.toString() || String(rawId);
		if (!inboundByRequest.has(key)) {
			inboundByRequest.set(key, []);
		}
		inboundByRequest.get(key).push(log);
	}

	// Match each outbound with next inbound (optimized)
	for (const log of outboundBatch) {
		const rawId = log.request_id;
		const key = rawId?._id?.toString() || rawId?.toString() || String(rawId);
		const candidates = inboundByRequest.get(key);

		if (!candidates || candidates.length === 0) continue;

		// Binary search for first inbound after outbound (since sorted)
		let left = 0;
		let right = candidates.length - 1;
		let nextInbound = null;

		while (left <= right) {
			const mid = Math.floor((left + right) / 2);
			if (candidates[mid].createdAt > log.createdAt) {
				nextInbound = candidates[mid];
				right = mid - 1;
			} else {
				left = mid + 1;
			}
		}

		if (nextInbound && mongoose.Types.ObjectId.isValid(nextInbound._id)) {
			idsToUpdate.add(nextInbound._id.toString());
		}
	}
}

const createFailedMail = async ({ mailInfo, failedReason }) => {
	try {
		if (!mailInfo) {
			console.error("Invalid mailInfo or failedReason provided");
			return;
		}

		// Fetch the related log record
		const logRecord = await logHistoryModel.findOne({ queueId: mailInfo.queueId });
		if (!logRecord) {
			console.error(`No log record found for queueId: ${mailInfo.queueId}`);
			return;
		}

		// Prepare data for the email failure record
		const emailData = {
			unique_id: logRecord.unique_id || null,
			companyId: logRecord.companyId.toString() || null,
			projectId: logRecord.projectId.toString() || null,
			environmentId: logRecord.environmentId.toString() || null,
			itemId: logRecord.item_id.toString() || null,
			companyName: logRecord.companyName || "",
			projectName: logRecord.projectName || "",
			environmentName: logRecord.environmentName || "",
			emailTo: mailInfo.mailConfig?.to || "",
			subject: mailInfo.mailConfig?.subject || "",
			content: mailInfo.mailConfig?.html || "",
			dateTime: new Date(),
			resendTime: 0,
			resendMessage: "",
			failureReason: failedReason || "Unknown Error",
			latestStatus: "Fail",
			mail_type: "log_type",
			companyCode: logRecord.CompanyCode || ""
		};

		// Create the email failure record
		const emailFailureRecord = await emailFailureModel.create(emailData);

		console.log("Email failure record created with ID:", emailFailureRecord._id);
	} catch (err) {
		console.error("Error in createFailedMail:", err);
	}
};

function convertIfJSON(content) {
	if (typeof content === 'object' && content !== null) {
		try {
			return JSON.stringify(content);
		} catch (e) {
			return String(content); // fallback
		}
	}

	if (typeof content === 'string') {
		try {
			const parsed = JSON.parse(content);
			return JSON.stringify(parsed);
		} catch (e) {
			return content;
		}
	}

	return String(content);
}

const excuteEmailReturnUrl = async (infoData) => {
	try {
		const {
			itemId, uniqueId, itemName, entrypointURL, endpointURL,
			emailTo, emailSubject, body, transformedBody, responseBody,
			transformedResponseBody, emailHtml, dateTime, queueId,
			email_failures_return_url, action
		} = infoData;

		if (!email_failures_return_url) return;

		// Update log to indicate return URL will be called
		await updateLogDescription({
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
			await updateLogDescription({
				queueId,
				action,
				description: "Return URL Success"
			});
		} else {
			console.error(`[Return URL Failed] ${email_failures_return_url}`, returnUrlResponse.error);
			await updateLogDescription({
				queueId,
				action,
				description: `Return URL Failed: ${returnUrlResponse.errorMessage}`
			});
		}

	} catch (err) {
		console.error("Error in excuteEmailReturnUrl:", err);
		await updateLogDescription({
			queueId: infoData.queueId,
			action: infoData.action,
			description: `Exception: ${err.message}`
		});
	}
};

const excuteResponseReturnUrl = async (infoData, url) => {
	try {
		const { itemId, uniqueId, itemName, entrypointURL, endpointURL, body, transformedBody, responseBody, transformedResponseBody, dateTime, httpStatus } = infoData;

		const payload = { itemId, uniqueId, dateTime, itemName, entrypointURL, endpointURL, body: convertIfJSON(body), transformedBody: convertIfJSON(transformedBody), responseBody: convertIfJSON(responseBody), transformedResponseBody: convertIfJSON(transformedResponseBody), httpStatus };

		const response = await axios({
			method: "POST",
			url,
			headers: { "Content-Type": "application/json" },
			data: payload,
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

module.exports = { create, findAll, findAllGroup, findAllView, exportAll, importAll, deleteAll, findAllLogFullListUniqueId, findAllNewView, findByUniqueIdLog, findAllLogFullListUniqueIdForFTPlogs, findAllNewViewForFtpLogs, blukSave, updateLog, createLog, findAllLogFullListForLogHistory, findAllLogFullListUniqueIdForFTPlogsFn, updateLogByItemId, updateLogByUniqueId, updateLogsBulkMissingId, saveFavourite, updateFavourite, getMyFavourites, getLogQueries, deleteFavourite, getFavouriteById, getLogQuery, saveRecentHistory, getRecentSearchHistory, getRecentSearchHistoryById, updateLogHistory, addReview, getReviewed, updateLogByItemIdwithRequestId, getRequest, createFailedMail, excuteEmailReturnUrl, excuteResponseReturnUrl, convertIfJSON, updateAllOutboundToInbound, updateInboundAfterOutboundResponse };