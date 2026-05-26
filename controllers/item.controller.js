const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const itemModel = require("../models/item.model");
const inboundSettingModel = require("../models/inbound_setting.model");

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
	if (!body.ItemCode) {
		return "Item code not found";
	}

	if (!body.ItemName) {
		return "Item name not found";
	}

	if (!body.CompanyName) {
		return "Company name is required";
	}

	return null;
};

const companyFullItemList = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { CompanyCode: companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		if (req.cookies && req.cookies.selectedProject) {
			query["ProjectId"] = mongoose.Types.ObjectId(req.cookies.selectedProject);
		} else if (req.cookies && req.cookies.selectedCompany) {
			query["companyId"] = mongoose.Types.ObjectId(req.cookies.selectedCompany);
			query["ProjectId"] = { $exists: false };
		} else {
			query["ProjectId"] = { $exists: false };
		}

		const total = await itemModel.countDocuments(query);
		const projects = await itemModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
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
					CompanyName: 1,
					ItemCode: 1,
					ItemName: 1,
					isActive: 1,
					createdAt: 1,
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

const fullItem = async (req, res, next) => {
	try {
		const data = await itemModel.aggregate([
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
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] }
				}
			},
			{
				$unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true }
			}
		]);

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data });
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

		let projectId = null;

		if (req.cookies != undefined && req.cookies.selectedProject != undefined && req.cookies.selectedProject != "") {
			projectId = req.cookies.selectedProject;
		}

		let itemData = {
			ItemCode: req.body.ItemCode,
			ItemName: req.body.ItemName,
			CompanyName: req.body.CompanyName,
			CompanyCode: companyCode,
			createdBy: userName,
			updateBy: userName,
			isActive: "1",
		};

		if (projectId) {
			itemData["ProjectId"] = projectId;
		}

		const item = new itemModel(itemData);

		const createdItem = await item.save();

		return res.status(200).send({ status: 1, message: "Item created successfully!", id: createdItem._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkecodexsit = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { Item_id, ItemCode } = req.body;

		const items = await itemModel.find({ ItemCode, CompanyCode: companyCode });

		if (items.length > 0) {
			const isTrue = items.every(item => item._id.toString() === Item_id);

			return res.status(200).send(isTrue ? "true" : "false");
		} else {
			return res.status(200).send("true");
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
			return res.status(400).send({ status: 0, message: "Invalid Item ID format!" });
		}

		const item = await itemModel.aggregate([
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

		const updatedItem = await itemModel.findByIdAndUpdate(
			req.params.id,
			{
				ItemName: req.body.ItemName,
				CompanyName: req.body.CompanyName,
				isActive: req.body.isActive,
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

const fulllistItem = async (req, res, next) => {
	try {
		const data = await itemModel.aggregate([
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
				$addFields: {
					item_running_setting: {$slice: ["$item_running_setting", -1]}
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
			}
		]);

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const fulllistItemDdepInput = async (req, res, next) => {
	try {
		const data = await inboundSettingModel.aggregate([
			{
				$match: { api_ddep_api: req.body.ddepInput }
			},
			{
				$lookup: {
					from: "items",
					localField: "item_id",
					foreignField: "_id",
					as: "items"
				}
			},
			{
				$lookup: {
					from: "items_props",
					localField: "item_id",
					foreignField: "item_id",
					as: "items_props"
				}
			},
			{
				$lookup: {
					from: "mappings",
					localField: "item_id",
					foreignField: "item_id",
					as: "mapping_setting"
				}
			},
			{
				$lookup: {
					from: "outbound_validations",
					localField: "item_id",
					foreignField: "item_id",
					as: "outbound_validation"
				}
			},
			{
				$lookup: {
					from: "outboundsettings",
					localField: "item_id",
					foreignField: "item_id",
					as: "outbound_setting"
				}
			},
			{
				$lookup: {
					from: "schedulesettings",
					localField: "item_id",
					foreignField: "item_id",
					as: "schedule_setting"
				}
			},
			{
				$unwind: { path: "$items", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$items_props", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$mapping_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_validation", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: true }
			}
		]);

		return res.status(200).send({ status: 1, message: "Item retrieved successfully!", data });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

/*exports.fulllistItemAPI = async () => {
	try {
		const items = await itemModel.aggregate([
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
					as: "inbound_history"
				}
			},
			{
				$lookup: {
					from: "mappings",
					localField: "_id",
					foreignField: "item_id",
					as: "mapping"
				}
			},
			{
				$addFields: {
					inbound_history: { $slice: ["$inbound_history", -1] }
				}
			},
			{
				$lookup: {
					from: "outboundhistories",
					localField: "_id",
					foreignField: "item_id",
					as: "outbound_history"
				}
			},
			{
				$addFields: {
					outbound_history: { $slice: ["$outbound_history", -1] }
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
					path: "$mapping",
					preserveNullAndEmptyArrays: true
				}
			}
		]);

		return items;
	} catch (error) {
		console.error("Error fetching items:", error);
		throw new Error("Could not fetch items");
	}
};*/

const createAPI = async (req, res, next) => {
	try {
		const item = new itemModel({
			ProjectId: req.body.ProjectId,
			ItemCode: req.body.ItemCode,
			ItemName: req.body.ItemName,
			CompanyName: req.body.CompanyName,
			isActive: req.body.isActive
		});

		const savedItem = await item.save();

		return res.status(200).send({ status: 1, message: "Item created successfully!", id: createdItem._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateAPI = async (req, res, next) => {
	try {
		const updatedItem = await itemModel.findByIdAndUpdate(
			req.params.id,
			{
				ItemName: req.body.ItemName,
				CompanyName: req.body.CompanyName,
				isActive: req.body.isActive
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

const checkAPI = async (req, res, next) => {
	try {
		const item = await itemModel.findOne({ ItemCode: req.body.itemCode });

		return item === null;
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const fullProjectAPI = async (req, res, next) => {
	try {
		let data = await itemModel.aggregate([
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
					from: "itemrunningsettings",
					localField: "_id",
					foreignField: "item_id",
					as: "item_running_setting"
				}
			},
			{
				$addFields: {
					item_running_setting: { $slice: ["$item_running_setting", -1] }
				}
			},
			{
				$unwind: { path: "$inbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$outbound_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$schedule_setting", preserveNullAndEmptyArrays: true }
			},
			{
				$unwind: { path: "$item_running_setting", preserveNullAndEmptyArrays: true }
			}
		]);

		data = data.map((project) => ({
			...project,
			ProjectCode: project.ItemCode,
			ProjectName: project.ItemName
		}));

		return res.status(200).send({ data });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { companyFullItemList, fullItem, create, checkecodexsit, findOne, update, fulllistItem, fulllistItemDdepInput, createAPI, updateAPI, checkAPI, fullProjectAPI };