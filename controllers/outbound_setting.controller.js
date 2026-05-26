const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const outboundSettingModel = require("../models/outbound_setting.model");

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

const validateOutboundSettingInput = (body) => {
	if (!body.item_id) {
		return "Item ID not found";
	}

	if (!body.outbound_format) {
		return "Outbound format is required";
	}

	if (!body.api_url) {
		return "API URL is required";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const outboundSetting = new outboundSettingModel({
			item_id: req.body.item_id,
			outbound_format: req.body.outbound_format, 
			sync_type_out: req.body.sync_type_out || "API",
			api_url: req.body.api_url,
			is_active: req.body.is_active || "Active",
			max_file_post: req.body.max_file_post || "50",
			sendCollectionOnebyOne: req.body.sendCollectionOnebyOne || "off",
			collections_name: req.body.collections_name || "",
			enableLog: req.body.enableLog || "off",
			globalHeaders: req.body.globalHeaders || [],
			specifyHeaders: req.body.specifyHeaders || {},
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdOutboundSetting = await outboundSetting.save();

		return res.status(200).send({ status: 1, message: "Outbound setting created successfully!", id: createdOutboundSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAll = async (req, res, next) => {
	try {
		const outboundSetting = await outboundSettingModel.find();

		return res.status(200).send({ status: 1, message: "Outbound setting retrieved successfully!", data: outboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const outboundSetting = await outboundSettingModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!outboundSetting || outboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Outbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound setting retrieved successfully!", data: outboundSetting[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutboundSetting = await outboundSettingModel.findByIdAndUpdate(
			req.params.id,
			{
				outbound_format: req.body.outbound_format,
				sync_type_out: req.body.sync_type_out || "API",
				api_url: req.body.api_url,
				is_active: req.body.is_active || "Active",
				max_file_post: req.body.max_file_post || "50",
				sendCollectionOnebyOne: req.body.sendCollectionOnebyOne || "off",
				collections_name: req.body.collections_name || "",
				enableLog: req.body.enableLog || "off",
				globalHeaders: req.body.globalHeaders || [],
				specifyHeaders: req.body.specifyHeaders || {},
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedOutboundSetting) {
			return res.status(404).send({ status: 0, message: "Outbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound setting created successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, findOne, update };