const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const alertconditionsModel = require("../models/alert_conditions.model");

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

const validateAlertConditonInput = (body) => {
	if (!body.name) {
		return "Condition name is required. Please provide a valid condition name.";
	}

	if (!body.policyId) {
		return "Policy is required. Please select a valid policy.";
	}
	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const searchKeyword = req.body.search || "";
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const aggregationPipeline = [
			{
				$addFields: {
					policyId: { $toObjectId: "$policyId" }
				}
			},
			{
				$lookup: {
					from: "alert_policies",
					localField: "policyId",
					foreignField: "_id",
					as: "alertpolicy"
				}
			},
			{ $unwind: { path: "$alertpolicy", preserveNullAndEmptyArrays: true } },
			{
				$match: {
					companyCode,
					$or: [
						{ name: { $regex: searchKeyword, $options: "i" } },
						{ description: { $regex: searchKeyword, $options: "i" } },
						{ createdBy: { $regex: searchKeyword, $options: "i" } },
						{ "alertpolicy.name": { $regex: searchKeyword, $options: "i" } }
					]
				}
			}
		];

		const totalAggregation = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $count: "total" }
		]);

		const total = totalAggregation.length > 0 ? totalAggregation[0].total : 0;

		const alertPolicies = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					"alertpolicy.name": 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Alert Condition retrieved successfully!", data: alertPolicies, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedalertcondition = await alertconditionsModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedalertcondition) {
			return res.status(404).send({ status: 0, message: "Alert Condition not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert Condition status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateAlertConditonInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const alertcondition = new alertconditionsModel({
			name: req.body.name,
			description: req.body.description,
			policyId: req.body.policyId,
			moniterRules: req.body.moniterRules || [],
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdAlertcondition = await alertcondition.save();

		return res.status(200).send({ status: 1, message: "Alert Condition created successfully!", id: createdAlertcondition._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const alertcondition = await alertconditionsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
		]);

		if (!alertcondition || alertcondition.length === 0) {
			return res.status(404).send({ status: 0, message: "Alert Condition not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert Condition retrieved successfully!", data: alertcondition[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateAlertConditonInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedalertcondition = await alertconditionsModel.findByIdAndUpdate(
			req.params.id,
			{
				name: req.body.name,
				description: req.body.description,
				policyId: req.body.policyId,
				moniterRules: req.body.moniterRules || [],
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedalertcondition) {
			return res.status(404).send({ status: 0, message: "Alert Condition not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert Condition updated successfully!", id: updatedalertcondition._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const alertconditions = await alertconditionsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Alert Condition retrieved successfully!", data: alertconditions });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const listByItemId = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		const searchKeyword = req.body.search || "";
		const itemId = req.params.itemId || null;
		const page = Number(req.body.page) > 0 ? Number(req.body.page) : 1;
		const limit = Number(req.body.limit) > 0 ? Number(req.body.limit) : 10;
		const skipRecord = (page - 1) * limit;

		const aggregationPipeline = [
			{
				$addFields: {
					policyId: { $toObjectId: "$policyId" }
				}
			},
			{
				$lookup: {
					from: "alert_policies",
					localField: "policyId",
					foreignField: "_id",
					as: "alertpolicy"
				}
			},
			{
				$unwind: {
					path: "$alertpolicy",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$match: {
					companyCode,
					...(itemId && { "moniterRules.itemType": itemId }),
					$or: [
						{ name: { $regex: searchKeyword, $options: "i" } },
						{ description: { $regex: searchKeyword, $options: "i" } },
						{ createdBy: { $regex: searchKeyword, $options: "i" } },
						{ "alertpolicy.name": { $regex: searchKeyword, $options: "i" } }
					]
				}
			},

			...(itemId
				? [{
					$addFields: {
						moniterRules: {
							$filter: {
								input: "$moniterRules",
								as: "rule",
								cond: { $eq: ["$$rule.itemType", itemId] }
							}
						}
					}
				}]
				: [])
		];

		const totalAggregation = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $count: "total" }
		]);

		const total = totalAggregation[0]?.total || 0;

		const alertConditions = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limit },
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					moniterRules: 1, // filtered if itemId provided
					"alertpolicy.name": 1
				}
			}
		]);

		return res.status(200).json({
			status: 1,
			message: "Alert Condition retrieved successfully!",
			data: alertConditions,
			total
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const listAlertConditionsByItem = async (itemId, companyCode) => {
	try {
		const aggregationPipeline = [
			{
				$addFields: {
					policyId: { $toObjectId: "$policyId" }
				}
			},
			{
				$lookup: {
					from: "alert_policies",
					localField: "policyId",
					foreignField: "_id",
					as: "alertPolicy"
				}
			},
			{
				$unwind: {
					path: "$alertPolicy",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$match: {
					companyCode,
					...(itemId && { "moniterRules.itemType": itemId.toString() })
				}
			},
			...(itemId
				? [{
					$addFields: {
						moniterRules: {
							$filter: {
								input: "$moniterRules",
								as: "rule",
								cond: { $eq: ["$$rule.itemType", itemId.toString()] }
							}
						}
					}
				}]
				: [])
		];

		// Total count
		const totalResult = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $count: "total" }
		]);

		const total = totalResult[0]?.total || 0;

		// Data fetch
		const data = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					policyId: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					moniterRules: 1,
					"alertPolicy.name": 1
				}
			}
		]);

		return { status: 1, message: "Alert Condition retrieved successfully!", data: data, total };
	} catch (err) {
		err.statusCode = 500;
		return { status: 0, message: "Error retrieving alert conditions.", data: [] };
	}
};

const conditionListByCompanyCode = async (companyCode, itemId = "all") => {
	try {
		const aggregationPipeline = [
			{
				$match: { companyCode }
			},
			{
				$addFields: {
					policyId: { $toObjectId: "$policyId" }
				}
			},
			{
				$lookup: {
					from: "alert_policies",
					localField: "policyId",
					foreignField: "_id",
					as: "alertPolicy"
				}
			},
			{
				$unwind: {
					path: "$alertPolicy",
					preserveNullAndEmptyArrays: true
				}
			},

			// Optional rule filtering
			...(itemId
				? [{
					$addFields: {
						moniterRules: {
							$filter: {
								input: "$moniterRules",
								as: "rule",
								cond: { $eq: ["$$rule.itemType", "all"] }
							}
						}
					}
				}]
				: []),

			{
				$match: {
					$expr: {
						$gt: [{ $size: "$moniterRules" }, 0]
					}
				}
			}
		];


		// Total count
		const totalResult = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{ $count: "total" }
		]);

		const total = totalResult[0]?.total || 0;

		// Data fetch
		const data = await alertconditionsModel.aggregate([
			...aggregationPipeline,
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					moniterRules: 1,
					policyId: 1,
					"alertPolicy.name": 1
				}
			}
		]);

		return {
			status: 1,
			message: "Alert Condition retrieved successfully!",
			data,
			total
		};
	} catch (err) {
		console.error(err);
		return {
			status: 0,
			message: "Error retrieving alert conditions.",
			data: []
		};
	}
};


module.exports = { list, statusChange, create, findOne, update, all, listByItemId, listAlertConditionsByItem, conditionListByCompanyCode };