const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const itemsModel = require("../models/item.model");
const inboundSettingModel = require("../models/inbound_setting.model");
const outboundSettingModel = require("../models/outbound_setting.model");
const scheduleSettingsModel = require("../models/schedule_setting.model");
const companyModel = require("../models/companies.model");
const projectModel = require("../models/projects.model");
const partyModel = require("../models/parties.model");
const environmentModel = require("../models/environments.model");
const partyEnvironmentModel = require("../models/parties_environments.model");
const mappingProfileModel = require("../models/mapping_profiles.model");
const mappingProfileHistoryModel = require("../models/mapping_profiles_histories.model");
const { findProjectByCode } = require("./projects.controller");
const { findEnvByCompanyCodeWithddepApiPrefix } = require("./environments.controller");
const { findSetting } = require("./settings.controller");
const { chcekDdepPathWithUrlPrefix } = require("./items-inbounds.controller");
const { ObjectId } = mongoose.Types;

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

const validateItemInput = (body) => {
	if (!body.itemCode) {
		return "Item code not found";
	}

	if (!body.itemName) {
		return "Item name not found";
	}

	if (!body.companyId) {
		return "Company is required";
	}

	if (!body.projectId && !body.projectId === null) {
		return "Project is required";
	}

	if (!body.environmentId) {
		return "Environment is required";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max(((parseInt(req.body.page) || 1) - 1) * limitRecord, 0);

		if (req.cookies && req.cookies.selectedProject) {
			query["ProjectId"] = mongoose.Types.ObjectId(req.cookies.selectedProject);
		} else if (req.cookies && req.cookies.selectedCompany) {
			query["companyId"] = mongoose.Types.ObjectId(req.cookies.selectedCompany);
			query["$or"] = [
				{ ProjectId: { $exists: false } },
				{ ProjectId: null }
			];
		} else {
			query["$or"] = [
				{ ProjectId: { $exists: false } },
				{ ProjectId: null }
			];
		}

		const total = await itemsModel.countDocuments(query);
		const projects = await itemsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "companies",
					localField: "companyId",
					foreignField: "_id",
					as: "companies"
				}
			},
			{
				$unwind: {
					path: "$companies",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$lookup: {
					from: "inboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_setting"
				}
			},
			{
				$lookup: {
					from: "outboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_setting"
				}
			},
			{
				$lookup: {
					from: "schedulesettings",
					localField: "_id",
					foreignField: "item_id",
					as: "schedule_setting"
				}
			},
			{
				$lookup: {
					from: "inboundhistories",
					localField: "_id",
					foreignField: "item_id",
					pipeline: [
						{ $sort: { createdAt: -1 } },
						{ $limit: 1 }
					],
					as: "inbound_history"
				}
			},
			{
				$lookup: {
					from: "outboundhistories",
					localField: "_id",
					foreignField: "item_id",
					pipeline: [
						{ $sort: { createdAt: -1 } },
						{ $limit: 1 }
					],
					as: "outbound_history"
				}
			},
			{
				$unwind: {
					path: "$inbound_setting",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$unwind: {
					path: "$outbound_setting",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$unwind: {
					path: "$schedule_setting",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$unwind: {
					path: "$inbound_history",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$unwind: {
					path: "$outbound_history",
					preserveNullAndEmptyArrays: true,
				},
			},
			{
				$project: {
					_id: 1,
					ItemCode: 1,
					ItemName: 1,
					CompanyName: 1,
					companyId: 1,
					isActive: 1,
					createdAt: 1,
					"companies.name": 1,
					"inbound_setting.sync_type": 1,
					"inbound_setting.api_type": 1,
					"inbound_setting.is_active": 1,
					"outbound_setting.is_active": 1,
					"schedule_setting.Schedule_configure_inbound": 1,
					"schedule_setting.Schedule_configure_outbound": 1,
					"inbound_history.status": 1,
					"inbound_history.createdAt": 1,
					"outbound_history.status": 1,
					"outbound_history.createdAt": 1
				}
			},
			{
				$addFields: {
					inbound_history: {
						$cond: {
							if: { $and: [{ $eq: ["$inbound_history.status", null] }, { $eq: ["$inbound_history.createdAt", null] }] },
							then: "$$REMOVE",
							else: "$inbound_history"
						}
					},
					outbound_history: {
						$cond: {
							if: { $and: [{ $eq: ["$outbound_history.status", null] }, { $eq: ["$outbound_history.createdAt", null] }] },
							then: "$$REMOVE",
							else: "$outbound_history"
						}
					}
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Projects retrieved successfully!", data: projects, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedItem = await itemsModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive ? "1" : "0" },
			{ new: true }
		);

		if (!updatedItem) {
			return res.status(404).send({ status: 0, message: "Item not found!" });
		}

		return res.status(200).send({ status: 1, message: "Item status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateItemInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const item = new itemsModel({
			ItemCode: req.body.itemCode,
			ItemName: req.body.itemName,
			description: req.body.itemDescription,
			companyId: req.body.companyId,
			ProjectId: req.body.projectId,
			environmentId: req.body.environmentId,
			isActive: "1",
			CompanyCode: companyCode,
			createdBy: userName,
			updateBy: userName
		});

		const createdItem = await item.save();

		return res.status(200).send({ status: 1, message: "Item created successfully!", id: createdItem._id, companyCode });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const item = await itemsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!item || item.length === 0) {
			return res.status(404).send({ status: 0, message: "Item not found!" });
		}

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data: item[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateItemInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedItem = await itemsModel.findByIdAndUpdate(
			req.params.id,
			{
				ItemCode: req.body.itemCode,
				ItemName: req.body.itemName,
				description: req.body.itemDescription,
				companyId: req.body.companyId,
				ProjectId: req.body.projectId,
				environmentId: req.body.environmentId,
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedItem) {
			return res.status(404).send({ status: 0, message: "Item not found!" });
		}

		return res.status(200).send({ status: 1, message: "Item updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkCodeExist = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const items = await itemsModel.find({ ItemCode: req.body.itemCode, CompanyCode: companyCode });

		if (items.length > 0) {
			const isExist = items.some(item => item._id.toString() !== req.body.itemId);

			if (isExist) {
				return res.status(200).send({ status: 0, message: "Item code already exists!" });
			} else {
				return res.status(200).send({ status: 1, message: "Item code does not exist!" });
			}
		} else {
			return res.status(200).send({ status: 1, message: "Item code does not exist!" });
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const fulllistItem = async (req, res, next) => {
	try {
		const data = await itemsModel.aggregate([
			{
				$match: { "_id": mongoose.Types.ObjectId(req.params.id) }
			},
			{
				$lookup: {
					from: "inboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_setting"
				}
			},
			{
				$lookup: {
					from: "items_props",
					localField: "_id",
					foreignField: "item_id",
					as: "items_props"
				}
			},
			{
				$lookup: {
					from: "mappings",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_setting"
				}
			},
			{
				$lookup: {
					from: "items_prop_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "items_prop_outbounds"
				}
			},
			{
				$lookup: {
					from: "mapping_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_outbound_setting"
				}
			},
			{
				$lookup: {
					from: "outbound_validations",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_validation"
				}
			},
			{
				$lookup: {
					from: "outboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_setting"
				}
			},
			{
				$lookup: {
					from: "schedulesettings",
					localField: "_id",
					foreignField: "item_id",
					as: "schedule_setting"
				}
			},
			{
				$lookup: {
					from: "inbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_filter"
				}
			},
			{
				$lookup: {
					from: "outbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_filter"
				}
			},
			{
				$lookup: {
					from: "itemrunningsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "item_running_setting"
				}
			},
			{
				$lookup: {
					from: "companies",
					localField: "companyId",
					foreignField: "_id",
					as: "company"
				}
			},
			{
				$lookup: {
					from: "projects",
					localField: "ProjectId",
					foreignField: "_id",
					as: "project"
				}
			},
			{
				$lookup: {
					from: "environments",
					localField: "environmentId",
					foreignField: "_id",
					as: "environment"
				}
			},
			{
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] },
					// Handle cases where data might not exist with $ifNull
					companyName: {
						$ifNull: [
							{ $arrayElemAt: ["$company.name", 0] },
							""
						]
					},
					projectName: {
						$ifNull: [
							{ $arrayElemAt: ["$project.name", 0] },
							""
						]
					},
					environmentName: {
						$ifNull: [
							{ $arrayElemAt: ["$environment.name", 0] },
							""
						]
					}
				}
			},
			{
				$unwind: { path: "$inbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$items_props", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$mapping_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$items_prop_outbounds", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$mapping_outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_validation", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$inbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$project: {
					company: 0,
					project: 0,
					environment: 0
				}
			},
		]);

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getFullItemDetails = async (itemId) => {
	try {
		const data = await itemsModel.aggregate([
			{ $match: { _id: mongoose.Types.ObjectId(itemId) } },
			{ $lookup: { from: "inboundsettings", localField: "_id", foreignField: "item_id", as: "inbound_setting" } },
			{ $lookup: { from: "items_props", localField: "_id", foreignField: "item_id", as: "items_props" } },
			{ $lookup: { from: "mappings", localField: "_id", foreignField: "item_id", as: "mapping_setting" } },
			{ $lookup: { from: "items_prop_outbounds", localField: "_id", foreignField: "item_id", as: "items_prop_outbounds" } },
			{ $lookup: { from: "mapping_outbounds", localField: "_id", foreignField: "item_id", as: "mapping_outbound_setting" } },
			{ $lookup: { from: "outbound_validations", localField: "_id", foreignField: "item_id", as: "outbound_validation" } },
			{ $lookup: { from: "outboundsettings", localField: "_id", foreignField: "item_id", as: "outbound_setting" } },
			{ $lookup: { from: "schedulesettings", localField: "_id", foreignField: "item_id", as: "schedule_setting" } },
			{ $lookup: { from: "inbound_filters", localField: "_id", foreignField: "item_id", as: "inbound_filter" } },
			{ $lookup: { from: "outbound_filters", localField: "_id", foreignField: "item_id", as: "outbound_filter" } },
			{ $lookup: { from: "itemrunningsettings", localField: "_id", foreignField: "item_id", as: "item_running_setting" } },
			{ $lookup: { from: "companies", localField: "companyId", foreignField: "_id", as: "company" } },
			{ $lookup: { from: "projects", localField: "ProjectId", foreignField: "_id", as: "project" } },
			{ $lookup: { from: "environments", localField: "environmentId", foreignField: "_id", as: "environment" } },
			{
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] },
					companyName: { $ifNull: [{ $arrayElemAt: ["$company.name", 0] }, ""] },
					projectName: { $ifNull: [{ $arrayElemAt: ["$project.name", 0] }, ""] },
					environmentName: { $ifNull: [{ $arrayElemAt: ["$environment.name", 0] }, ""] }
				}
			},
			{ $unwind: { path: "$inbound_setting", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$items_props", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$mapping_setting", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$items_prop_outbounds", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$mapping_outbound_setting", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$outbound_validation", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$inbound_filter", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$outbound_filter", preserveNullAndEmptyArrays: true } },
			{ $unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true } },
			{ $project: { company: 0, project: 0, environment: 0 } }
		]);

		return {
			status: 1,
			message: "Item retrieved successfully!",
			data
		};
	} catch (err) {
		return {
			status: 0,
			message: err.message,
			error: true
		};
	}
};

const fullItem = async (req, res, next) => {
	try {
		const data = await itemsModel.aggregate([
			{
				$match: { isActive: "1" }
			},
			{
				$lookup: {
					from: "inboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_setting"
				}
			},
			{
				$unwind: { path: "$inbound_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$match: {
					$or: [
						{ "inbound_setting.sync_type": "FTP" },
						{ "inbound_setting.sync_type": "SFTP" },
						{ "inbound_setting.sync_type": "API", "inbound_setting.api_type": "User_API" }
					]
				}
			},
			{
				$lookup: {
					from: "items_props",
					localField: "_id",
					foreignField: "item_id",
					as: "items_props"
				}
			},
			{
				$unwind: { path: "$items_props", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "mappings",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_setting"
				}
			},
			{
				$unwind: { path: "$mapping_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "items_prop_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "items_prop_outbounds"
				}
			},
			{
				$unwind: { path: "$items_prop_outbounds", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "mapping_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_outbound_setting"
				}
			},
			{
				$unwind: { path: "$mapping_outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outbound_validations",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_validation"
				}
			},
			{
				$unwind: { path: "$outbound_validation", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_setting"
				}
			},
			{
				$unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$lookup: {
					from: "schedulesettings",
					localField: "_id",
					foreignField: "item_id",
					as: "schedule_setting"
				}
			},
			{
				$unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$lookup: {
					from: "inbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_filter"
				}
			},
			{
				$unwind: { path: "$inbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_filter"
				}
			},
			{
				$unwind: { path: "$outbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "itemrunningsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "item_running_setting"
				}
			},
			{
				$lookup: {
					from: "companies",
					localField: "companyId",
					foreignField: "_id",
					as: "company"
				}
			},
			{
				$lookup: {
					from: "projects",
					localField: "ProjectId",
					foreignField: "_id",
					as: "project"
				}
			},
			{
				$lookup: {
					from: "environments",
					localField: "environmentId",
					foreignField: "_id",
					as: "environment"
				}
			},
			{
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] },
					// Handle cases where data might not exist with $ifNull
					companyName: {
						$ifNull: [
							{ $arrayElemAt: ["$company.name", 0] },
							""
						]
					},
					projectName: {
						$ifNull: [
							{ $arrayElemAt: ["$project.name", 0] },
							""
						]
					},
					environmentName: {
						$ifNull: [
							{ $arrayElemAt: ["$environment.name", 0] },
							""
						]
					}
				}
			},
			{
				$unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$project: {
					company: 0,
					project: 0,
					environment: 0
				}
			},
		]);

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const fullItemGet = async () => {
	try {
		const data = await itemsModel.aggregate([
			{
				$match: { isActive: "1" }
			},
			{
				$lookup: {
					from: "inboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_setting"
				}
			},
			{
				$unwind: { path: "$inbound_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$match: {
					$or: [
						{ "inbound_setting.sync_type": "FTP" },
						{ "inbound_setting.sync_type": "SFTP" },
						{ "inbound_setting.sync_type": "API", "inbound_setting.api_type": "User_API" }
					]
				}
			},
			{
				$lookup: {
					from: "items_props",
					localField: "_id",
					foreignField: "item_id",
					as: "items_props"
				}
			},
			{
				$unwind: { path: "$items_props", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "mappings",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_setting"
				}
			},
			{
				$unwind: { path: "$mapping_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "items_prop_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "items_prop_outbounds"
				}
			},
			{
				$unwind: { path: "$items_prop_outbounds", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "mapping_outbounds",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping_outbound_setting"
				}
			},
			{
				$unwind: { path: "$mapping_outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outbound_validations",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_validation"
				}
			},
			{
				$unwind: { path: "$outbound_validation", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outboundsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_setting"
				}
			},
			{
				$unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$lookup: {
					from: "schedulesettings",
					localField: "_id",
					foreignField: "item_id",
					as: "schedule_setting"
				}
			},
			{
				$unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: false }
			},
			{
				$lookup: {
					from: "inbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "inbound_filter"
				}
			},
			{
				$unwind: { path: "$inbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "outbound_filters",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_filter"
				}
			},
			{
				$unwind: { path: "$outbound_filter", preserveNullAndEmptyArrays: true }
			},
			{
				$lookup: {
					from: "itemrunningsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "item_running_setting"
				}
			},
			{
				$lookup: {
					from: "companies",
					localField: "companyId",
					foreignField: "_id",
					as: "company"
				}
			},
			{
				$lookup: {
					from: "projects",
					localField: "ProjectId",
					foreignField: "_id",
					as: "project"
				}
			},
			{
				$lookup: {
					from: "environments",
					localField: "environmentId",
					foreignField: "_id",
					as: "environment"
				}
			},
			{
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] },
					// Handle cases where data might not exist with $ifNull
					companyName: {
						$ifNull: [
							{ $arrayElemAt: ["$company.name", 0] },
							""
						]
					},
					projectName: {
						$ifNull: [
							{ $arrayElemAt: ["$project.name", 0] },
							""
						]
					},
					environmentName: {
						$ifNull: [
							{ $arrayElemAt: ["$environment.name", 0] },
							""
						]
					}
				}
			},
			{
				$unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$project: {
					company: 0,
					project: 0,
					environment: 0
				}
			},
		]);

		if (!data || data.length === 0) {
			return { status: 0, message: "Item not found!" };
		}

		return { status: 1, message: "Item retrieved successfully!", data };
	} catch (err) {
		return { status: 0, message: "Item not found!" };
	}
}

const listItem = async (req, res, next) => {
	try {
		const { itemIds } = req.body;

		if (!Array.isArray(itemIds) || itemIds.length === 0) {
			return res.status(400).json({ message: "itemIds must be a non-empty array" });
		}

		const validObjectIds = itemIds
			.map(id => ObjectId.isValid(id) ? ObjectId(id) : null)
			.filter(Boolean);

		const results = [];

		for (const id of validObjectIds) {
			try {
				const item = await itemsModel.findById(id);
				if (!item) continue;

				const [
					inboundSetting,
					outboundSetting,
					scheduleSettings,
					company,
					project,
					environment
				] = await Promise.all([
					inboundSettingModel.findOne({ item_id: id }),
					outboundSettingModel.findOne({ item_id: id }),
					scheduleSettingsModel.findOne({ item_id: id }),
					companyModel.findById(item.companyId),
					projectModel.findById(item.ProjectId),
					environmentModel.findById(item.environmentId)
				]);

				let party = [];
				if (outboundSetting?.endpoints?.length > 0) {
					const validPartyIds = outboundSetting.endpoints
						.map(ep => ObjectId.isValid(ep.party) ? ObjectId(ep.party) : null)
						.filter(Boolean);

					if (validPartyIds.length > 0) {
						party = await partyModel.find({ _id: { $in: validPartyIds } });
					}
				}

				let partyEnvironment = [];
				if (party.length > 0 && item.environmentId) {
					const promises = party.map(p =>
						partyEnvironmentModel.find({ partyId: p._id })
					);
					const allEnvs = await Promise.all(promises);
					partyEnvironment = allEnvs.flat();
				}

				let mappingProfile = [];
				let defaultMappingProfiles = [];

				if (outboundSetting?.endpoints?.length > 0) {
					const mappingProfileIds = [];

					// 1. From endpoints (inbound + outbound)
					if (Array.isArray(outboundSetting.endpoints)) {
						outboundSetting.endpoints.forEach(ep => {
							if (ObjectId.isValid(ep.inboundMapping)) {
								mappingProfileIds.push(ObjectId(ep.inboundMapping));
							}
							if (ObjectId.isValid(ep.outboundMapping)) {
								mappingProfileIds.push(ObjectId(ep.outboundMapping));
							}
						});
					}

					const uniqueMappingIds = [...new Set(mappingProfileIds.map(id => id.toString()))].map(id => ObjectId(id));

					if (uniqueMappingIds.length > 0) {
						mappingProfile = await mappingProfileModel.find({ _id: { $in: uniqueMappingIds } }).lean();
					}

					// FIX: Export default mapping profiles separately
					const defaultMappingIds = [];
					if (ObjectId.isValid(outboundSetting.defaultInboundMapping)) {
						defaultMappingIds.push(ObjectId(outboundSetting.defaultInboundMapping));
					}
					if (ObjectId.isValid(outboundSetting.defaultOutboundMapping)) {
						defaultMappingIds.push(ObjectId(outboundSetting.defaultOutboundMapping));
					}

					if (defaultMappingIds.length > 0) {
						defaultMappingProfiles = await mappingProfileModel.find({ _id: { $in: defaultMappingIds } }).lean();
					}
				}

				let mappingProfileHistory = [];
				const allMappingProfiles = [...mappingProfile, ...defaultMappingProfiles];

				if (allMappingProfiles.length > 0) {
					const mappingProfileIds = allMappingProfiles.map(mp => mp._id);
					mappingProfileHistory = await mappingProfileHistoryModel.find({ mappingProfileId: { $in: mappingProfileIds } }).lean();

					for (let mph of mappingProfileHistory) {
						if (!mph.companyId && mph.projectId) {
							const project = await projectModel.findById(mph.projectId).lean();
							if (project && project.companyId) {
								mph.companyId = project.companyId;
							}
						}
					}
				}

				results.push({
					item,
					inboundSetting,
					outboundSetting,
					scheduleSettings,
					company,
					project,
					mappingProfile,
					defaultMappingProfiles,
					mappingProfileHistory,
					environment,
					party,
					partyEnvironment
				});

			} catch (itemError) {
				console.error(`Error processing ID: ${id}`, itemError);
			}
		}

		return res.status(200).json({ status: 1, message: "Export Item successfully!", data: results });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const itemImport = async (req, res, next) => {
	try {
		const { company, project, item, items: rawItems } = req.body;

		// Validate request structure
		if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
			return res.status(400).json({ status: 0, message: "Invalid or empty items data." });
		}

		const results = [];
		const now = new Date();
		const timestamp = Date.now();
		const idMap = {
			company: { old: null, new: null },
			project: { old: null, new: null },
			environment: {},
			item: {},
			mappingProfile: {},
			party: {},
			partyEnvironment: {}
		};

		// STEP 1: PROCESS COMPANY

		let targetCompany = null;

		if (company.type === 'existing' && company.id) {
			targetCompany = await companyModel.findById(company.id);
			if (!targetCompany) {
				return res.status(404).json({ status: 0, message: "Selected company not found." });
			}
			idMap.company.old = rawItems[0]?.company?._id;
			idMap.company.new = targetCompany._id;
			results.push({ type: 'company', id: targetCompany._id, status: 'existing' });

		} else if (company.type === 'new') {
			const sourceCompany = rawItems[0]?.company;
			if (!sourceCompany) {
				return res.status(400).json({ status: 0, message: "Company data missing in JSON file." });
			}

			let companyData = { ...sourceCompany };
			delete companyData._id; // Safe removal

			const existingCompany = await companyModel.findOne({ code: company.code, name: company.name });

			if (existingCompany) {
				// Safe update without _id
				await companyModel.updateOne(
					{ _id: existingCompany._id },
					{
						$set: {
							...companyData,
							updatedAt: now
						}
					}
				);
				targetCompany = await companyModel.findById(existingCompany._id);
				idMap.company.new = targetCompany._id;
				results.push({ type: 'company', id: targetCompany._id, status: 'updated' });
			} else {
				companyData.code = company.code;
				companyData.name = company.name;
				companyData.createdAt = now;
				companyData.updatedAt = now;

				const newCompany = new companyModel(companyData);
				await newCompany.save();
				targetCompany = newCompany;
				idMap.company.new = newCompany._id;
				results.push({ type: 'company', id: newCompany._id, status: 'created' });
			}
		} else {
			return res.status(400).json({ status: 0, message: "Invalid company configuration." });
		}

		// STEP 2: PROCESS PROJECT

		let targetProject = null;

		if (project.type === 'existing' && project.id) {
			targetProject = await projectModel.findOne({ _id: project.id, companyId: targetCompany._id });
			if (!targetProject) {
				return res.status(404).json({ status: 0, message: "Selected project not found." });
			}
			idMap.project.old = rawItems[0]?.project?._id;
			idMap.project.new = targetProject._id;
			results.push({ type: 'project', id: targetProject._id, status: 'existing' });

		} else if (project.type === 'new') {
			const sourceProject = rawItems[0]?.project;
			if (!sourceProject) {
				return res.status(400).json({ status: 0, message: "Project data missing in JSON file." });
			}

			let projectData = { ...sourceProject, companyId: targetCompany._id };
			delete projectData._id; // Safe removal

			const existingProject = await projectModel.findOne({ companyId: targetCompany._id, code: project.code, name: project.name });

			if (existingProject) {
				// Safe update without _id
				await projectModel.updateOne(
					{ _id: existingProject._id },
					{
						$set: {
							...projectData,
							updatedAt: now
						}
					}
				);
				targetProject = await projectModel.findById(existingProject._id);
				idMap.project.new = targetProject._id;
				results.push({ type: 'project', id: targetProject._id, status: 'updated' });
			} else {
				projectData.code = project.code
				projectData.name = project.name;
				projectData.createdAt = now;
				projectData.updatedAt = now;

				const newProject = new projectModel(projectData);
				await newProject.save();
				targetProject = newProject;
				idMap.project.new = newProject._id;
				results.push({ type: 'project', id: newProject._id, status: 'created' });
			}
		}

		const finalProjectId = targetProject ? targetProject._id : null;

		// STEP 3: PROCESS EACH ITEM FROM JSON

		for (const rawItemData of rawItems) {
			const {
				item: rawItemDetails,
				inboundSetting,
				outboundSetting,
				scheduleSettings,
				mappingProfile: mappingProfileList = [],
				defaultMappingProfiles: defaultMappingProfilesList = [],
				mappingProfileHistory: mappingProfileHistoryList = [],
				environment: rawEnvironmentData,
				party: partyList = [],
				partyEnvironment: partyEnvironmentList = []
			} = rawItemData;

			const finalMappingProfiles = [
				...mappingProfileList,
				...defaultMappingProfilesList
			].filter((v, i, self) =>
				i === self.findIndex(t => String(t._id) === String(v._id))
			);

			// STEP 3.1: PROCESS ENVIRONMENT

			if (!rawEnvironmentData) {
				results.push({ status: 'skipped', reason: 'Missing environment data' });
				continue;
			}

			const targetEnvironment = await resolveOrCreateEnvironment(rawEnvironmentData, targetCompany, finalProjectId, timestamp, now, idMap);
			const targetEnvironmentId = targetEnvironment._id;
			results.push({ type: 'environment', id: targetEnvironmentId, status: idMap.environment[rawEnvironmentData._id?.toString()] ? 'created' : 'updated/existing' });

			// STEP 3.2: PROCESS ITEM

			if (!rawItemDetails) {
				results.push({ status: 'skipped', reason: 'Missing item data' });
				continue;
			}

			let targetItemId;
			if (item.type === 'existing' && item.id) {
				const existingItem = await itemsModel.findOne({
					_id: item.id,
					companyId: targetCompany._id,
					ProjectId: finalProjectId,
					environmentId: targetEnvironmentId
				});
				if (!existingItem) {
					return res.status(404).json({ status: 0, message: "Selected item not found." });
				}
				targetItemId = existingItem._id;
				results.push({ type: 'item', id: targetItemId, status: 'existing' });
			} else if (item.type === 'new') {
				const { _id, createdAt, updatedAt, __v, ...cleanItemData } = rawItemDetails;

				const newItemData = {
					...cleanItemData,
					companyId: targetCompany._id,
					ProjectId: finalProjectId,
					environmentId: targetEnvironmentId,
					ItemCode: item.code,
					ItemName: item.name,
					createdAt: now,
					updatedAt: now
				};

				const newItem = new itemsModel(newItemData);
				await newItem.save();

				targetItemId = newItem._id;

				results.push({
					type: 'item',
					id: targetItemId,
					code: newItemData.ItemCode,
					name: newItemData.ItemName,
					status: 'created'
				});
			}

			// STEP 3.3: GENERATE URL PREFIX

			const urlPrefix = await generateUrlPrefix(targetCompany, targetProject, targetEnvironment);

			// STEP 3.4: PROCESS INBOUND SETTING

			if (inboundSetting) {
				await processInboundSetting(inboundSetting, targetItemId, targetCompany.companyCode, urlPrefix, timestamp, now, results);
			}

			// STEP 3.5: PROCESS SCHEDULE SETTINGS

			if (scheduleSettings) {
				await processScheduleSetting(scheduleSettings, targetItemId, now, results);
			}

			// STEP 3.6: PROCESS OUTBOUND SETTING WITH MAPPINGS & PARTIES

			if (outboundSetting) {
				await processOutboundSetting(
					outboundSetting,
					targetItemId,
					targetCompany.companyCode,
					finalProjectId,
					targetCompany._id,
					targetEnvironmentId,
					finalMappingProfiles,
					mappingProfileHistoryList,
					partyList,
					partyEnvironmentList,
					timestamp,
					now,
					idMap,
					results
				);
			}
		}

		return res.status(200).json({
			status: 1,
			message: "Import completed successfully.",
			results
		});

	} catch (err) {
		console.error("Item import failed:", err);
		return res.status(500).json({
			status: 0,
			message: err.message || "Import failed"
		});
	}
};

async function resolveOrCreateEnvironment(rawEnv, company, projectId, timestamp, now, idMap) {
	const envCode = rawEnv.ddepApiPrefix;
	let existing = await environmentModel.findOne({
		companyId: company._id,
		projectId: projectId,
		ddepApiPrefix: envCode
	});

	if (!existing) {
		existing = await environmentModel.findOne({
			companyId: company._id,
			projectId: projectId,
			name: rawEnv.name
		});
	}

	if (existing) {
		idMap.environment[rawEnv._id?.toString()] = existing._id;
		return existing;
	}

	// Check for prefix conflict
	let newPrefix = rawEnv.ddepApiPrefix;
	// const prefixConflict = await findEnvByCompanyCodeWithddepApiPrefix(company.companyCode, projectId, newPrefix);
	// if (prefixConflict) {
	// 	newPrefix = `${newPrefix}-${timestamp}`;
	// }

	const { _id, createdAt, updatedAt, ...cleanEnvData } = rawEnv;
	const newEnv = new environmentModel({
		...cleanEnvData,
		companyId: company._id,
		projectId: projectId,
		name: `${rawEnv.name}`,
		ddepApiPrefix: newPrefix,
		createdAt: now,
		updatedAt: now
	});
	await newEnv.save();
	idMap.environment[rawEnv._id?.toString()] = newEnv._id;
	return newEnv;
}

async function generateUrlPrefix(company, project, env) {
	let urlPrefix = '';

	if (!company) return urlPrefix;

	const isSystemCompany = company?.isSystemCompany;

	if (!isSystemCompany) {
		const companyPrefix = company?.isUrlPerfix ? null : company?.code;
		const projectPrefix = !project
			? (company?.isDisableDefaultProjectPrefix ? null : company?.defaultProjectPrefix)
			: (project?.isUrlPerfix ? null : project?.code);
		const envPrefix = env?.isUrlPerfix ? null : env?.ddepApiPrefix?.replace(/^\/+/, '');

		const parts = [companyPrefix, projectPrefix, envPrefix].filter(Boolean);
		urlPrefix = parts.join("/");
	} else {
		// For system company, fetch global settings if needed
		try {
			const responseGlobalSetting = await findSetting(company.companyCode, 'general-settings');
			const globalSettingsData = responseGlobalSetting?.data || {};
			const disableDefaultProjectPrefix = globalSettingsData?.disableDefaultProjectPrefix === "off";

			const projectPrefix = !project
				? (disableDefaultProjectPrefix ? globalSettingsData?.defaultProjectPrefix : null)
				: (project?.isUrlPerfix ? null : project?.code);

			const envPrefix = env?.isUrlPerfix ? null : env?.ddepApiPrefix?.replace(/^\/+/, '');

			const parts = [projectPrefix, envPrefix].filter(Boolean);
			urlPrefix = parts.join("/");
		} catch (err) {
			console.warn("Failed to fetch global settings for system company, using fallback prefix", err);
			urlPrefix = env?.ddepApiPrefix?.replace(/^\/+/, '') || '';
		}
	}

	return urlPrefix || ''; // Always return string
}

async function processInboundSetting(inboundData, itemId, companyCode, urlPrefix, timestamp, now, results) {
	const { _id, createdAt, updatedAt, __v, ...cleanInboundData } = inboundData;

	// Try to find existing inbound setting for this item
	let existing = await inboundSettingModel.findOne({ item_id: itemId });

	const updateData = {
		...cleanInboundData,
		item_id: itemId,
		companyCode: companyCode,
		CompanyCode: companyCode,
		urlPrefix: urlPrefix || '',
		updatedAt: now
	};

	// Handle endpoint conflict
	let endpoint = updateData.api_ddep_api || '';
	const conflict = await chcekDdepPathWithUrlPrefix(companyCode, urlPrefix, endpoint);
	// if (conflict && (!existing || conflict._id.toString() !== existing._id.toString())) {
	// 	updateData.api_ddep_api = `/${timestamp}${endpoint}`;
	// }
	if (
		conflict.status === 1 &&
		conflict.data.length > 0 &&
		(!existing || !conflict.data.some(x => x._id.toString() === existing._id.toString()))
	) {
		updateData.api_ddep_api = `/${timestamp}${endpoint}`;
	}

	if (existing) {
		// UPDATE existing
		Object.assign(existing, updateData);
		await existing.save();

		results.push({
			type: 'inboundSetting',
			id: existing._id,
			endpoint: existing.api_ddep_api,
			status: 'updated'
		});
	} else {
		// CREATE new
		updateData.createdAt = now;
		const newInbound = new inboundSettingModel(updateData);
		await newInbound.save();

		results.push({
			type: 'inboundSetting',
			id: newInbound._id,
			endpoint: newInbound.api_ddep_api,
			status: 'created'
		});
	}
}

async function processScheduleSetting(scheduleData, itemId, now, results) {
	// Remove MongoDB fields that shouldn't be copied
	const { _id, createdAt, updatedAt, __v, ...cleanScheduleData } = scheduleData;

	// Prepare clean data
	const updateData = {
		...cleanScheduleData,
		item_id: itemId,
		updatedAt: now
	};

	// Try to find existing schedule setting for this item
	let existing = await scheduleSettingsModel.findOne({ item_id: itemId });

	if (existing) {
		// UPDATE existing
		Object.assign(existing, updateData);
		await existing.save();

		results.push({
			type: 'scheduleSetting',
			id: existing._id,
			status: 'updated'
		});
	} else {
		// CREATE new
		updateData.createdAt = now;
		const newSchedule = new scheduleSettingsModel(updateData);
		await newSchedule.save();

		results.push({
			type: 'scheduleSetting',
			id: newSchedule._id,
			status: 'created'
		});
	}
}

async function processOutboundSetting(outboundData, itemId, companyCode, projectId, companyId, envId, mappingProfileList, mappingProfileHistoryList, partyList, partyEnvironmentList, timestamp, now, idMap, results) {

	let existingOutbound = await outboundSettingModel.findOne({ item_id: itemId });

	const mappingProfileCloneCache = {};
	const partyCloneCache = {};
	const processedPartyIds = new Set(); // Track processed parties to avoid duplicates

	// Process endpoints: remap mappings and parties
	if (outboundData.endpoints && outboundData.endpoints.length > 0) {
		for (let i = 0; i < outboundData.endpoints.length; i++) {
			const endpoint = outboundData.endpoints[i];

			const mappings = [
				{ key: 'inboundMapping', versionKey: 'inboundMappingVersion', defaultKey: 'defaultInboundMapping', defaultVersionKey: 'defaultInboundMappingVersion' },
				{ key: 'outboundMapping', versionKey: 'outboundMappingVersion', defaultKey: 'defaultOutboundMapping', defaultVersionKey: 'defaultOutboundMappingVersion' }
			];

			for (const map of mappings) {
				let mappingId = endpoint[map.key];
				let mappingVersion = endpoint[map.versionKey];

				if (mappingId && mappingVersion) {
					const findMapping = mappingProfileList.find(mp => mp._id?.toString() === mappingId.toString());
					if (findMapping) {
						const newMappingId = await processMappingProfile(
							findMapping,
							companyCode,
							projectId,
							companyId,
							mappingProfileHistoryList,
							findMapping._id,
							mappingVersion,
							mappingProfileCloneCache,
							now,
							idMap
						);
						endpoint[map.key] = newMappingId;
						outboundData.endpoints[i][map.key] = newMappingId;

						if (newMappingId) {
							endpoint[map.key] = newMappingId;
							outboundData.endpoints[i][map.key] = newMappingId;

							// Step 2: Create history records
							await processMappingHistory(
								mappingProfileHistoryList,
								findMapping._id,
								mappingVersion,
								newMappingId,
								projectId,
								companyId,
								companyCode,
								now,
								idMap
							);
						}
					}
				} else {
					// Default mappings
					const defaultMappingId = outboundData[map.defaultKey];
					const defaultVersion = outboundData[map.defaultVersionKey];
					if (defaultMappingId && defaultVersion) {
						const findMapping = mappingProfileList.find(mp => mp._id?.toString() === defaultMappingId.toString());
						if (findMapping) {
							const newMappingId = await processMappingProfile(
								findMapping,
								companyCode,
								projectId,
								companyId,
								mappingProfileHistoryList,
								findMapping._id,
								defaultVersion,
								mappingProfileCloneCache,
								now,
								idMap
							);

							if (newMappingId) {
								outboundData[map.defaultKey] = newMappingId;

								await processMappingHistory(
									mappingProfileHistoryList,
									findMapping._id,
									defaultVersion,
									newMappingId,
									projectId,
									companyId,
									companyCode,
									now,
									idMap
								);
							}
						}
					}
				}
			}

			// Process party - but only once per unique party
			if (endpoint.party) {
				const oldPartyIdStr = endpoint.party.toString();
				if (!processedPartyIds.has(oldPartyIdStr)) {
					const findParty = partyList.find(pa => pa._id?.toString() === oldPartyIdStr);
					if (findParty) {
						const newPartyId = await processParty(findParty, projectId, companyId, companyCode, partyCloneCache, now, idMap);
						endpoint.party = newPartyId;
						outboundData.endpoints[i].party = newPartyId;

						await processPartyEnvironments(
							partyEnvironmentList,
							findParty._id,
							newPartyId,
							envId,
							now,
							idMap
						);

						processedPartyIds.add(oldPartyIdStr);
					}
				} else {
					// For subsequent endpoints, use the already cloned ID
					const cachedNewId = idMap.party[oldPartyIdStr];
					if (cachedNewId) {
						endpoint.party = cachedNewId;
						outboundData.endpoints[i].party = cachedNewId;
					}
				}
			}
		}
	}

	// Save outbound
	const { _id, createdAt, updatedAt, ...cleanOutboundData } = outboundData;
	const updateData = {
		...cleanOutboundData,
		item_id: itemId,
		CompanyCode: companyCode,
		createdAt: now,
		updatedAt: now
	};

	if (existingOutbound) {
		// Update existing
		await outboundSettingModel.updateOne(
			{ _id: existingOutbound._id },
			{ $set: updateData }
		);
		const updatedOutbound = await outboundSettingModel.findById(existingOutbound._id);
		results.push({ type: 'outboundSetting', id: updatedOutbound._id, status: 'updated' });
	} else {
		// Create new
		updateData.createdAt = now;
		const newOutbound = new outboundSettingModel(updateData);
		await newOutbound.save();
		results.push({ type: 'outboundSetting', id: newOutbound._id, status: 'created' });
	}
}

async function processMappingProfile(mappingProfileRecord, companyCode, projectId, companyId, mappingProfileHistoryList, oldProfileId, mappingVersion, cache, now, idMap) {
	// Cache key: Unique identifier for this (company + project + old profile)
	const cacheKey = `${companyCode}_${companyId}_${projectId}_${oldProfileId}`;

	// Step 1: Check cache to avoid re-processing in same import
	if (cache[cacheKey]) {
		console.log(`Cache hit: ${cacheKey}`);
		return cache[cacheKey];
	}

	// Check if mapping profile history already exists
	// This is the KEY check - history determines if profile exists
	const historyRecords = mappingProfileHistoryList.filter(h =>
		h.mappingProfileId?.toString() === oldProfileId.toString() && h.version === mappingVersion
	);

	if (historyRecords.length === 0) {
		console.log(`No history found for profile ${oldProfileId}, version ${mappingVersion}`);
		return null;
	}

	const firstHistoryRecord = historyRecords[0];

	// Check if this EXACT history record exists in DB
	// Unique key: (companyId + projectId + version + name)
	const existingHistory = await mappingProfileHistoryModel.findOne({
		companyId: companyId,
		projectId: projectId,
		version: firstHistoryRecord.version,
		name: firstHistoryRecord.name
	});

	if (existingHistory) {
		// History exists - Profile exists - Reuse it
		const existingProfileId = existingHistory.mappingProfileId;
		cache[cacheKey] = existingProfileId;
		idMap.mappingProfile[cacheKey] = existingProfileId;
		console.log(`REUSE: Found existing profile ${existingProfileId} for ${companyCode}/${companyId}/${projectId}`);
		return existingProfileId;
	}

	// History doesn't exist - Create NEW profile & bind to history
	// This profile is NEW and specific to this company + project
	const { _id, createdAt, updatedAt, __v, ...cleanProfileData } = mappingProfileRecord;

	const newProfile = new mappingProfileModel({
		...cleanProfileData,
		companyCode: companyCode,
		isActive: true,
		createdBy: mappingProfileRecord.createdBy,
		updatedBy: mappingProfileRecord.updatedBy,
		createdAt: now,
		updatedAt: now
	});

	const savedProfile = await newProfile.save();
	cache[cacheKey] = savedProfile._id;
	idMap.mappingProfile[cacheKey] = savedProfile._id;
	console.log(`CREATE: New profile ${savedProfile._id} for ${companyCode}/${companyId}/${projectId}`);

	return savedProfile._id;
}

async function processMappingHistory(historyList, oldProfileId, version, newProfileId, projectId, companyId, companyCode, now, idMap) {
	if (!historyList || historyList.length === 0) {
		return;
	}

	if (!idMap.mappingProfileHistory) {
		idMap.mappingProfileHistory = {};
	}

	// Get all history records for this profile and version
	const historyRecords = historyList.filter(h =>
		h.mappingProfileId?.toString() === oldProfileId.toString() && h.version === version
	);

	console.log(`Processing ${historyRecords.length} history records for profile ${oldProfileId}, version ${version}`);

	for (const historyRecord of historyRecords) {
		const oldHistoryId = historyRecord._id?.toString();

		// Step 1: Skip if already processed in THIS import
		if (idMap.mappingProfileHistory[oldHistoryId]) {
			console.log(`Already mapped: ${oldHistoryId} → ${idMap.mappingProfileHistory[oldHistoryId]}`);
			continue;
		}

		// Unique key: (companyId + projectId + version + name)
		const existingHistory = await mappingProfileHistoryModel.findOne({
			_id: historyRecord._id,
			companyId: companyId,
			projectId: projectId,
			version: historyRecord.version,
			name: historyRecord.name,
			mappingProfileId: newProfileId
		});

		if (existingHistory) {
			// History already exists - NO DUPLICATE CREATION
			console.log(`SKIP DUPLICATE: History exists - ${companyCode}/${projectId}/${historyRecord.name}/${version}`);
			idMap.mappingProfileHistory[oldHistoryId] = existingHistory._id;
			continue;
		}

		// History doesn't exist - Create NEW history
		// Bind to profile via mappingProfileId
		const { _id, createdAt, updatedAt, __v, mappingProfileId, ...cleanHistoryData } = historyRecord;

		const newHistory = new mappingProfileHistoryModel({
			...cleanHistoryData,
			mappingProfileId: newProfileId,
			companyId: companyId,
			projectId: projectId,
			createdAt: now,
			updatedAt: now,
			isCurrentVersion: false
		});

		const savedHistory = await newHistory.save();
		idMap.mappingProfileHistory[oldHistoryId] = savedHistory._id;
		console.log(`CREATE: New history ${savedHistory._id} - ${companyCode}/${projectId}/${historyRecord.name}/${version}`);

		// Update isCurrentVersion flag
		// Set all to false, then set latest to true
		await mappingProfileHistoryModel.updateMany(
			{
				mappingProfileId: newProfileId,
				companyId: companyId,
				projectId: projectId
			},
			{ $set: { isCurrentVersion: false } }
		);

		await mappingProfileHistoryModel.updateOne(
			{ _id: savedHistory._id },
			{ $set: { isCurrentVersion: true } }
		);
	}
}

async function processParty(party, projectId, companyId, companyCode, cache, now, idMap) {
	const oldId = party._id.toString();
	if (cache[oldId]) {
		return cache[oldId];
	}

	const existing = await partyModel.findOne({
		projectId: projectId,
		companyId: companyId,
		companyCode: companyCode,
		name: party.name
	});

	if (existing) {
		// Safe update without _id
		const { _id, createdAt, updatedAt, ...cleanPartyData } = party;
		await partyModel.updateOne(
			{ _id: existing._id },
			{
				$set: {
					name: party.name,
					updatedAt: now
				}
			}
		);
		const updatedParty = await partyModel.findById(existing._id);
		cache[oldId] = updatedParty._id;
		idMap.party[oldId] = updatedParty._id;
		return updatedParty._id;
	}

	const { _id, createdAt, updatedAt, ...cleanPartyData } = party;
	const cleaned = {
		...cleanPartyData,
		projectId: projectId,
		companyId: companyId,
		companyCode: companyCode,
		createdAt: now,
		updatedAt: now
	};

	const newParty = new partyModel(cleaned);
	await newParty.save();
	cache[oldId] = newParty._id;
	idMap.party[oldId] = newParty._id;
	return newParty._id;
}

async function processPartyEnvironments(envList, oldPartyId, newPartyId, environmentId, now, idMap) {
	const oldPartyIdStr = oldPartyId.toString();

	const partyEnvRecords = envList.filter(pe =>
		pe.partyId?.toString() === oldPartyIdStr
	);

	for (const record of partyEnvRecords) {
		const oldRecordId = record._id?.toString();

		const alreadyExists = await partyEnvironmentModel.findOne({
			partyId: newPartyId,
			environmentId: environmentId
		});

		if (alreadyExists) {
			idMap.partyEnvironment[oldRecordId] = alreadyExists._id;
			continue;
		}

		const { _id, createdAt, updatedAt, ...cleanRecord } = record;
		const cleaned = {
			...cleanRecord,
			partyId: newPartyId,
			environmentId: environmentId,
			createdAt: now,
			updatedAt: now
		};

		const newPartyEnv = new partyEnvironmentModel(cleaned);
		await newPartyEnv.save();

		idMap.partyEnvironment[oldRecordId] = newPartyEnv._id;
	}
}

const ddepApiEndpointExist = async (companyCode, ddepApiPrefix) => {
	try {
		const inboundSetting = await inboundSettingModel.aggregate([
			{ $match: { companyCode, api_ddep_api: ddepApiPrefix } },
			{ $limit: 1 }
		]);

		return inboundSetting.length > 0 ? inboundSetting[0] : null;
	} catch (error) {
		console.error("Error in ddepApiEndpointExist:", error);
		throw error;
	}
};

const itemNameList = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { companyId, projectId, environmentId } = req.body;
		const query = { CompanyCode: companyCode };
		if (companyId && companyId !== 'all' && mongoose.Types.ObjectId.isValid(companyId)) {
			query.companyId = new mongoose.Types.ObjectId(companyId);
		}

		if (projectId && projectId !== 'all') {
			query.ProjectId = projectId === " " ? null : new mongoose.Types.ObjectId(projectId);
		}

		if (environmentId && environmentId !== 'all' && mongoose.Types.ObjectId.isValid(environmentId)) {
			query.environmentId = new mongoose.Types.ObjectId(environmentId);
		}

		const items = await itemsModel.aggregate([
			{ $match: query },
			{ $sort: { name: 1 } } // optional
		]);

		return res.status(200).send({
			status: 1,
			message: 'Items retrieved successfully!',
			data: items
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const cloneItem = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		const { item, inbound, schedule } = req.body;

		if (!item.itemId || !item.companyId || !item.projectId || !item.environmentId || !item.itemCode || !item.itemName) {
			return res.status(400).json({
				status: 0,
				message: "Missing required fields: itemId, itemCode, itemName, companyId, projectId, environmentId"
			});
		}

		// Step 1: Get source item
		const sourceItem = await itemsModel.findById(item.itemId);
		if (!sourceItem) {
			return res.status(404).json({
				status: 0,
				message: "Source item not found"
			});
		}

		const sourceInbound = await inboundSettingModel.findOne({ item_id: item.itemId });
		const sourceOutbound = await outboundSettingModel.findOne({ item_id: item.itemId });
		const sourceSchedule = await scheduleSettingsModel.findOne({ item_id: item.itemId });

		// Step 2: Create NEW ITEM (no session)
		const newItem = await cloneItemDocument(
			sourceItem,
			{
				companyId: item.companyId,
				ProjectId: item.projectId,
				environmentId: item.environmentId,
				CompanyCode: companyCode,
				newItemCode: item.itemCode || sourceItem.ItemCode,
				newItemName: item.itemName || sourceItem.ItemName
			}
		);

		// Step 3: Clone inbound settings
		const newInbound = await cloneInboundSetting(
			sourceInbound,
			newItem._id,
			{
				companyCode: inbound?.companyCode || sourceInbound?.CompanyCode,
				urlPrefix: inbound?.urlPrefix || sourceInbound?.urlPrefix,
				platform: inbound?.platform || sourceInbound?.sync_type,
				platformApiType: inbound?.platformApiType || sourceInbound?.api_type,
				ddepApiEndpoint: inbound?.ddepApiEndpoint || sourceInbound?.api_ddep_api,
				userApi: inbound?.userApi || sourceInbound?.api_user_api,
				mimeType: inbound?.mimeType || sourceInbound?.inbound_format,
				ddepApiAuthType: inbound?.ddepApiAuthType || sourceInbound?.ddep_api_auth_type,
				ddepApiAuthorizationApiKeys: inbound?.ddepApiAuthorizationApiKeys || sourceInbound?.ddep_api_authorization_api_keys,
				ftpServerLink: inbound?.ftpServerLink || sourceInbound?.ftp_server_link,
				port: inbound?.port || sourceInbound?.ftp_port,
				loginName: inbound?.loginName || sourceInbound?.ftp_login_name,
				password: inbound?.password || sourceInbound?.ftp_password,
				folder: inbound?.folder || sourceInbound?.ftp_folder,
				backupFolder: inbound?.backupFolder || sourceInbound?.ftp_backup_folder,
				maxFileDownload: inbound?.maxFileDownload || sourceInbound?.max_file_download
			}
		);

		// Step 4: Clone Outbound Settings (with mapping profile logic)
		const newOutbound = await cloneOutboundSetting(
			sourceOutbound,
			newItem._id,
			{
				companyId: item.companyId,
				projectId: item.projectId,
				environmentId: item.environmentId,
				companyCode: companyCode
			}
		);

		// Step 5: Clone Outbound Settings (with mapping profile logic)
		const newScheduleSettings = await cloneScheduleSettings(
			sourceSchedule,
			newItem._id,
			{
				Schedule_configure_inbound: schedule.Schedule_configure_inbound,
				schedule_type_inbound: schedule.schedule_type_inbound,
				Schedule_configure_outbound: schedule.Schedule_configure_outbound,
				schedule_type_outbound: schedule.schedule_type_outbound,
				occurs_inbound: schedule.occurs_inbound,
				occurs_outbound: schedule.occurs_outbound,
				day_frequency_inbound_count: schedule.day_frequency_inbound_count,
				day_frequency_outbound_count: schedule.day_frequency_outbound_count,
				weekly_frequency_inbound_count: schedule.weekly_frequency_inbound_count,
				weekly_frequency_outbound_count: schedule.weekly_frequency_outbound_count,
				monthly_frequency_day_inbound: schedule.monthly_frequency_day_inbound,
				monthly_frequency_day_inbound_count: schedule.monthly_frequency_day_inbound_count,
				monthly_frequency_the_inbound: schedule.monthly_frequency_the_inbound,
				monthly_frequency_the_inbound_count: schedule.monthly_frequency_the_inbound_count,
				monthly_frequency_day_outbound: schedule.monthly_frequency_day_outbound,
				monthly_frequency_day_outbound_count: schedule.monthly_frequency_day_outbound_count,
				monthly_frequency_the_outbound: schedule.monthly_frequency_the_outbound,
				monthly_frequency_the_outbound_count: schedule.monthly_frequency_the_outbound_count,
				daily_frequency_type_inbound: schedule.daily_frequency_type_inbound,
				daily_frequency_type_outbound: schedule.daily_frequency_type_outbound,
				daily_frequency_once_time_inbound: schedule.daily_frequency_once_time_inbound,
				daily_frequency_every_time_unit_inbound: schedule.daily_frequency_every_time_unit_inbound,
				daily_frequency_every_time_count_inbound: schedule.daily_frequency_every_time_count_inbound,
				daily_frequency_every_time_count_start_inbound: schedule.daily_frequency_every_time_count_start_inbound,
				daily_frequency_every_time_count_end_inbound: schedule.daily_frequency_every_time_count_end_inbound,
				daily_frequency_every_time_count_start_outbound: schedule.daily_frequency_every_time_count_start_outbound,
				daily_frequency_every_time_count_end_outbound: schedule.daily_frequency_every_time_count_end_outbound,
				daily_frequency_once_time_outbound: schedule.daily_frequency_once_time_outbound,
				daily_frequency_every_time_unit_outbound: schedule.daily_frequency_every_time_unit_outbound,
				daily_frequency_every_time_count_outbound: schedule.daily_frequency_every_time_count_outbound,
				occurs_weekly_fields_inbound: schedule.occurs_weekly_fields_inbound,
				monthly_field_setting_inbound: schedule.monthly_field_setting_inbound,
				recurs_count_inbound: schedule.recurs_count_inbound,
				recurs_time_inbound: schedule.recurs_time_inbound,
				recurs_count_outbound: schedule.recurs_count_outbound,
				recurs_time_outbound: schedule.recurs_time_outbound,
				occurs_weekly_fields_outbound: schedule.occurs_weekly_fields_outbound,
				monthly_field_setting_outbound: schedule.monthly_field_setting_outbound,
				next_date_inbound: schedule.next_date_inbound,
				next_date_outbound: schedule.next_date_outbound,
				next_date_time_inbound: schedule.next_date_time_inbound,
				next_date_time_outbound: schedule.next_date_time_outbound,
				duration_inbound_start_date: schedule.duration_inbound_start_date,
				duration_inbound_is_end_date: schedule.duration_inbound_is_end_date,
				duration_inbound_end_date: schedule.duration_inbound_end_date,
				duration_outbound_start_date: schedule.duration_outbound_start_date,
				duration_outbound_is_end_date: schedule.duration_outbound_is_end_date,
				duration_outbound_end_date: schedule.duration_outbound_end_date,
				one_time_occurrence_inbound_date: schedule.one_time_occurrence_inbound_date,
				one_time_occurrence_inbound_time: schedule.one_time_occurrence_inbound_time,
				one_time_occurrence_outbound_date: schedule.one_time_occurrence_outbound_date,
				one_time_occurrence_outbound_time: schedule.one_time_occurrence_outbound_time,
				enableLog: schedule.enableLog,
			}
		);

		return res.status(200).json({
			status: 1,
			message: "Item cloned successfully",
			// newItemId: newItem._id
		});

	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const cloneItemDocument = async (sourceItem, targetInfo) => {
	const now = new Date();

	const newItemData = {
		ItemCode: targetInfo.newItemCode,
		ItemName: targetInfo.newItemName,
		description: sourceItem.description,

		ProjectId: targetInfo.ProjectId,
		companyId: targetInfo.companyId,
		environmentId: targetInfo.environmentId,
		CompanyCode: targetInfo.CompanyCode,

		isActive: sourceItem.is_active,
		createdBy: sourceItem.createdBy,
		updateBy: sourceItem.updateBy,
		createdAt: now,
		updatedAt: now
	};

	return await itemsModel.create(newItemData);
};

const cloneInboundSetting = async (sourceInbound, newItemId, payload) => {
	if (!sourceInbound) return null;

	const now = new Date();

	let processedEndpoint = payload.ddepApiEndpoint || sourceInbound.api_ddep_api;
	let processedUserApi = payload.userApi || sourceInbound.api_user_api;

	// handle FTP/SFTP
	const processedFtpSettings = {
		serverLink: payload.ftpServerLink || sourceInbound.ftp_server_link,
		port: payload.port || sourceInbound.ftp_port,
		loginName: payload.loginName || sourceInbound.ftp_login_name,
		password: payload.password || sourceInbound.ftp_password,
		folder: payload.folder || sourceInbound.ftp_folder,
		backupFolder: payload.backupFolder || sourceInbound.ftp_backup_folder,
		maxFileDownload: payload.maxFileDownload || sourceInbound.max_file_download
	};

	const newInboundData = {
		item_id: newItemId,
		inbound_format: payload.mimeType || sourceInbound.inbound_format,
		urlPrefix: payload.urlPrefix || sourceInbound.urlPrefix,
		api_type: payload.platformApiType || sourceInbound.api_type,
		sync_type: payload.platform || sourceInbound.sync_type,

		api_ddep_api: processedEndpoint,
		api_user_api: processedUserApi,

		ddep_api_auth_type: payload.ddepApiAuthType || sourceInbound.ddep_api_auth_type,
		ddep_api_authorization_api_keys:
			JSON.parse(payload.ddepApiAuthorizationApiKeys || "[]") || sourceInbound.ddep_api_authorization_api_keys,

		ftp_server_link: processedFtpSettings.serverLink,
		ftp_port: processedFtpSettings.port,
		ftp_login_name: processedFtpSettings.loginName,
		ftp_password: processedFtpSettings.password,
		ftp_folder: processedFtpSettings.folder,
		ftp_backup_folder: processedFtpSettings.backupFolder,
		max_file_download: processedFtpSettings.maxFileDownload,

		enableLog: sourceInbound?.enableLog,
		enableEmail: sourceInbound?.enableEmail,
		email_endpoint_url: sourceInbound?.email_endpoint_url,
		email_log_url: sourceInbound?.email_endpoint_url,
		email_request_header: sourceInbound?.email_request_header,
		email_query_params: sourceInbound?.email_query_params,
		email_body: sourceInbound?.email_body,
		email_body_html: sourceInbound?.email_body_html,
		email_validation_message: sourceInbound?.email_validation_message,
		email_logs: sourceInbound?.email_logs,

		is_active: sourceInbound.is_active,
		CompanyCode: payload.companyCode,

		createdBy: sourceInbound.createdBy,
		updateBy: sourceInbound.updateBy,
		createdAt: now,
		updatedAt: now
	};

	return await inboundSettingModel.create(newInboundData);
}

const cloneOutboundSetting = async (sourceOutbound, newItemId, targetInfo) => {
	if (!sourceOutbound) {
		return null;
	}
	const { companyId, projectId, environmentId, companyCode } = targetInfo;
	const now = new Date();

	const clonedEndpoints = await Promise.all(
		(sourceOutbound.endpoints || []).map(async (endpoint) => {
			// Handle Party Binding
			const targetParty = await findOrCreateParty(
				endpoint.party,
				{ companyId, projectId, environmentId, companyCode }
			);

			// Handle Inbound Mapping Profile
			let newInboundMappingId = "";
			let newInboundMappingVersion = endpoint.inboundMappingVersion;

			if (endpoint.inboundMapping) {
				const inboundMappingResult = await handleMappingProfile(
					endpoint.inboundMapping,
					endpoint.inboundMappingVersion,
					{ companyId, projectId, environmentId, companyCode }
				);
				newInboundMappingId = inboundMappingResult?.mappingId;
				newInboundMappingVersion = inboundMappingResult?.version;
			}

			// Handle Outbound Mapping Profile
			let newOutboundMappingId = "";
			let newOutboundMappingVersion = endpoint.outboundMappingVersion;

			if (endpoint.outboundMapping) {
				const outboundMappingResult = await handleMappingProfile(
					endpoint.outboundMapping,
					endpoint.outboundMappingVersion,
					{ companyId, projectId, environmentId, companyCode }
				);
				newOutboundMappingId = outboundMappingResult?.mappingId;
				newOutboundMappingVersion = outboundMappingResult?.version;
			}

			return {
				...endpoint,
				party: targetParty._id.toString(),
				inboundMapping: newInboundMappingId.toString(),
				inboundMappingVersion: newInboundMappingVersion,
				outboundMapping: newOutboundMappingId.toString(),
				outboundMappingVersion: newOutboundMappingVersion
			};
		})
	)

	// Handle Default Mapping Profiles
	let defaultInboundMapping = null;
	let defaultOutboundMapping = null;

	if (sourceOutbound.defaultInboundMapping) {
		defaultInboundMapping = await handleMappingProfile(
			sourceOutbound.defaultInboundMapping,
			sourceOutbound.defaultInboundMappingVersion,
			{ companyId, projectId, environmentId, companyCode },
		);
	}

	if (sourceOutbound.defaultOutboundMapping) {
		defaultOutboundMapping = await handleMappingProfile(
			sourceOutbound.defaultOutboundMapping,
			sourceOutbound.defaultOutboundMappingVersion,
			{ companyId, projectId, environmentId, companyCode },
		);
	}

	const newOutboundData = {
		item_id: newItemId,
		outbound_format: sourceOutbound.outbound_format || [],
		sync_type_out: sourceOutbound.sync_type_out,
		flowType: sourceOutbound.flowType,
		api_url: sourceOutbound.api_url,
		defaultInboundMapping: defaultInboundMapping?.mappingId || null,
		defaultOutboundMapping: defaultOutboundMapping?.mappingId || null,
		defaultInboundMappingVersion: sourceOutbound.defaultInboundMappingVersion,
		defaultOutboundMappingVersion: sourceOutbound.defaultOutboundMappingVersion,
		endpoints: clonedEndpoints,
		globalHeaders: sourceOutbound.globalHeaders || [],
		specifyHeaders: sourceOutbound.specifyHeaders || {},
		max_file_post: sourceOutbound.max_file_post,
		sendCollectionOnebyOne: sourceOutbound.sendCollectionOnebyOne,
		collections_name: sourceOutbound.collections_name,
		enableLog: sourceOutbound.enableLog,
		enableEmail: sourceOutbound.enableEmail,
		email_endpoint_url: sourceOutbound.email_endpoint_url,
		email_log_url: sourceOutbound.email_log_url,
		email_request_header: sourceOutbound.email_request_header,
		email_transformed_header: sourceOutbound.email_transformed_header,
		email_query_params: sourceOutbound.email_query_params,
		email_body: sourceOutbound.email_body,
		email_body_html: sourceOutbound.email_body_html,
		email_transformed_body: sourceOutbound.email_transformed_body,
		email_transformed_body_html: sourceOutbound.email_transformed_body_html,
		email_request_endpoint_url_information: sourceOutbound.email_request_endpoint_url_information,
		email_response: sourceOutbound.email_response,
		email_response_html: sourceOutbound.email_response_html,
		email_transformed_response: sourceOutbound.email_transformed_response,
		email_transformed_response_html: sourceOutbound.email_transformed_response_html,
		email_validation_message: sourceOutbound.email_validation_message,
		email_logs: sourceOutbound.email_logs,
		is_active: sourceOutbound.is_active,
		CompanyCode: companyCode,
		createdBy: sourceOutbound.createdBy,
		updateBy: sourceOutbound.updateBy,
		createdAt: now,
		updatedAt: now
	};

	const newOutbound = new outboundSettingModel(newOutboundData);
	await newOutbound.save();
	return newOutbound;
}

const cloneScheduleSettings = async (sourceSchedule, newItemId, payload) => {
	if (!sourceSchedule) return null;
	const now = new Date();

	const newScheduleSettings = {
		item_id: newItemId,
		Schedule_configure_inbound: payload.Schedule_configure_inbound || "",
		schedule_type_inbound: payload.schedule_type_inbound || "",
		one_time_occurrence_inbound_date: payload.one_time_occurrence_inbound_date || "",
		one_time_occurrence_inbound_time: payload.one_time_occurrence_inbound_time || "",
		occurs_inbound: payload.occurs_inbound || "",
		day_frequency_inbound_count: payload.day_frequency_inbound_count || "",
		day_frequency_outbound_count: payload.day_frequency_outbound_count || "",
		weekly_frequency_inbound_count: payload.weekly_frequency_inbound_count || "",
		weekly_frequency_outbound_count: payload.weekly_frequency_outbound_count || "",
		monthly_frequency_day_inbound: payload.monthly_frequency_day_inbound || "",
		monthly_frequency_day_inbound_count: payload.monthly_frequency_day_inbound_count || "",
		monthly_frequency_the_inbound_count: payload.monthly_frequency_the_inbound_count || "",
		monthly_frequency_the_outbound_count: payload.monthly_frequency_the_outbound_count || "",
		monthly_frequency_day_outbound: payload.monthly_frequency_day_outbound || "",
		monthly_frequency_day_outbound_count: payload.monthly_frequency_day_outbound_count || "",
		daily_frequency_type_inbound: payload.daily_frequency_type_inbound || "",
		daily_frequency_type_outbound: payload.daily_frequency_type_outbound || "",
		daily_frequency_once_time_inbound: payload.daily_frequency_once_time_inbound || "",
		daily_frequency_once_time_outbound: payload.daily_frequency_once_time_outbound || "",
		daily_frequency_every_time_unit_inbound: payload.daily_frequency_every_time_unit_inbound || "",
		daily_frequency_every_time_unit_outbound: payload.daily_frequency_every_time_unit_outbound || "",
		daily_frequency_every_time_count_inbound: payload.daily_frequency_every_time_count_inbound || "",
		daily_frequency_every_time_count_outbound: payload.daily_frequency_every_time_count_outbound || "",
		daily_frequency_every_time_count_start_inbound: payload.daily_frequency_every_time_count_start_inbound || "",
		daily_frequency_every_time_count_start_outbound: payload.daily_frequency_every_time_count_start_outbound || "",
		daily_frequency_every_time_count_end_inbound: payload.daily_frequency_every_time_count_end_inbound || "",
		daily_frequency_every_time_count_end_outbound: payload.daily_frequency_every_time_count_end_outbound || "",
		occurs_weekly_fields_inbound: payload.occurs_weekly_fields_inbound || "",
		monthly_field_setting_inbound: payload.monthly_field_setting_inbound || "",
		Schedule_configure_outbound: payload.Schedule_configure_outbound || "",
		schedule_type_outbound: payload.schedule_type_outbound || "",
		one_time_occurrence_outbound_date: payload.one_time_occurrence_outbound_date || "",
		one_time_occurrence_outbound_time: payload.one_time_occurrence_outbound_time || "",
		occurs_outbound: payload.occurs_outbound || "",
		recurs_count_outbound: payload.recurs_count_outbound || "",
		recurs_time_outbound: payload.recurs_time_outbound || "",
		occurs_weekly_fields_outbound: payload.occurs_weekly_fields_outbound || "",
		monthly_field_setting_outbound: payload.monthly_field_setting_outbound || "",
		duration_inbound_start_date: payload.duration_inbound_start_date || "",
		duration_inbound_is_end_date: payload.duration_inbound_is_end_date || "",
		duration_inbound_end_date: payload.duration_inbound_end_date || "",
		duration_outbound_start_date: payload.duration_outbound_start_date || "",
		duration_outbound_is_end_date: payload.duration_outbound_is_end_date || "",
		duration_outbound_end_date: payload.duration_outbound_end_date || "",
		next_date_inbound: payload.next_date_inbound || "",
		next_date_outbound: payload.next_date_outbound || "",
		enableLog: payload.enableLog || "off",
		createdBy: sourceSchedule.createdBy,
		updateBy: sourceSchedule.updateBy,
		CompanyCode: sourceSchedule.CompanyCode,
		createdAt: now,
		updatedAt: now
	};

	return await scheduleSettingsModel.create(newScheduleSettings);
}

const handleMappingProfile = async (sourceMappingProfileId, version, targetInfo) => {
	const { companyId, projectId, environmentId, companyCode } = targetInfo;

	// Step 1: Get source mapping profile
	const sourceMappingProfile = await mappingProfileModel.findById(sourceMappingProfileId);
	if (!sourceMappingProfile) {
		return null;
	}

	// Step 2: Get the current version history of source mapping profile
	const sourceCurrentHistory = await mappingProfileHistoryModel.findOne({
		mappingProfileId: sourceMappingProfileId,
		isCurrentVersion: true
	});
	if (!sourceCurrentHistory) {
		return null;
	}

	const targetVersion = version || sourceCurrentHistory.version;

	// Step 3: Check if mapping profile with same name exists in target project
	// First, check in history table for mapping with same name in target project
	const existingMappingHistory = await mappingProfileHistoryModel.findOne({
		name: sourceCurrentHistory.name,
		companyId: companyId,
		projectId: projectId
	});

	let targetMappingProfile = null;
	if (existingMappingHistory) {
		targetMappingProfile = await mappingProfileModel.findById(existingMappingHistory.mappingProfileId);
	}

	// Step 4: If mapping profile doesn't exist, create new one
	if (!targetMappingProfile) {
		const now = new Date();
		targetMappingProfile = await mappingProfileModel.create({
			isActive: sourceMappingProfile.isActive,
			companyCode: companyCode,
			createdBy: sourceMappingProfile.createdBy,
			updatedBy: sourceMappingProfile.updatedBy,
			createdAt: now,
			updatedAt: now
		});
	}

	// Step 5: Check if mapping profile history with same name and version exists
	let existingHistory = await mappingProfileHistoryModel.findOne({
		mappingProfileId: targetMappingProfile._id,
		name: sourceCurrentHistory.name,
		version: targetVersion,
		isCurrentVersion: true
	});

	// Step 6: If history exists, mark it as old version and create new one
	if (existingHistory) {
		// Mark existing as old version
		await mappingProfileHistoryModel.findByIdAndUpdate(
			existingHistory._id,
			{ isCurrentVersion: false },
			{ new: true }
		);
	}

	// Step 7: Create new mapping profile history with isCurrentVersion = true
	const now = new Date();
	const newMappingHistory = await mappingProfileHistoryModel.create({
		mappingProfileId: targetMappingProfile._id,
		companyId: companyId,
		projectId: projectId,
		name: sourceCurrentHistory.name,
		version: targetVersion,
		description: sourceCurrentHistory.description,
		returnUrl: sourceCurrentHistory.returnUrl,
		sendCollectionOnebyOne: sourceCurrentHistory.sendCollectionOnebyOne,
		collectionsName: sourceCurrentHistory.collectionsName,
		filters: sourceCurrentHistory.filters || [],
		inboundFormat: sourceCurrentHistory.inboundFormat || "json",
		outboundFormat: sourceCurrentHistory.outboundFormat || "json",
		inboundFormatData: sourceCurrentHistory.inboundFormatData,
		outboundFormatData: sourceCurrentHistory.outboundFormatData,
		mappingData: sourceCurrentHistory.mappingData,
		properties: sourceCurrentHistory.properties || [],
		isCurrentVersion: true,
		isActive: sourceCurrentHistory.isActive,
		createdBy: sourceCurrentHistory.createdBy,
		updatedBy: sourceCurrentHistory.updatedBy,
		createdAt: now,
		updatedAt: now
	});

	return {
		mappingId: targetMappingProfile._id,
		version: targetVersion
	};
}

const findOrCreateParty = async (sourcePartyId, targetInfo) => {
	const { companyId, projectId, environmentId, companyCode } = targetInfo;

	// Get source party details
	const sourceParty = await partyModel.findById(sourcePartyId)
	if (!sourceParty) {
		throw new Error(`Source party ${sourcePartyId} not found`);
	}

	// Check if party with same name exists in target project
	let targetParty = await partyModel.findOne({
		name: sourceParty.name,
		description: sourceParty.description,
		companyId: companyId,
		projectId: projectId,
		companyCode
	});

	// If party doesn't exist, create new one
	if (!targetParty) {
		const now = new Date();
		targetParty = new partyModel({
			companyId: companyId,
			projectId: projectId,
			name: sourceParty.name,
			description: sourceParty.description,
			sequence: sourceParty.sequence,
			isActive: sourceParty.isActive,
			companyCode: companyCode,
			createdBy: sourceParty.createdBy,
			updatedBy: sourceParty.updatedBy,
			createdAt: now,
			updatedAt: now
		});
		await targetParty.save();
	}

	// Check if party-environment binding exists
	const existingBinding = await partyEnvironmentModel.findOne({
		partyId: targetParty._id,
		environmentId: environmentId
	});

	// Create party-environment binding if doesn't exist
	if (!existingBinding) {
		const sourceBinding = await partyEnvironmentModel.findOne({
			partyId: sourcePartyId
		})

		const now = new Date();
		const newBinding = new partyEnvironmentModel({
			partyId: targetParty._id,
			environmentId: environmentId,
			domainPrefix: sourceBinding?.domainPrefix || "",
			domain: sourceBinding?.domain || "",
			createdBy: sourceBinding?.createdBy,
			updatedBy: sourceBinding?.updatedBy,
			createdAt: now,
			updatedAt: now
		});
		await newBinding.save();
	}

	return targetParty;
}

const checkItemExists = async (req, res, next) => {
	try {
		const { companyId, projectId, itemId } = req.body;

		if (!companyId || !projectId || !itemId) {
			return res.status(400).json({
				status: 0,
				message: "Company ID, Project ID, and Item ID are required"
			});
		}

		const item = await itemsModel.findOne({
			_id: itemId,
			companyId: companyId,
			projectId: projectId
		});

		return res.status(200).json({
			status: 1,
			exists: !!item,
			data: item || null
		});

	} catch (err) {
		console.error("Check item exists failed:", err);
		return res.status(500).json({
			status: 0,
			message: err.message || "Error checking item"
		});
	}
};


module.exports = { list, statusChange, create, findOne, update, checkCodeExist, fulllistItem, fullItem, listItem, itemImport, itemNameList, fullItemGet, getFullItemDetails, cloneItem, checkItemExists };