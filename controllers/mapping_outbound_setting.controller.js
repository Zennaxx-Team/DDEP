const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const mappingSettingModel = require("../models/mapping_outbound.model");

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

const validateMappingSettingInput = (body) => {
	if (!body.item_id) {
		return "Item ID not found";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateMappingSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const mappingSetting = new mappingSettingModel({
			item_id: req.body.item_id,
			inbound_format: req.body.inbound_format,
			outbound_format: req.body.outbound_format,
			mapping_data: req.body.mapping_data,
			is_active: req.body.is_active,
			enableLog: req.body.enableLog || "off",
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdMappingSetting = await mappingSetting.save();

		return res.status(200).send({ status: 1, message: "Mapping setting created successfully!", id: createdMappingSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const mappingSetting = await mappingSettingModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!mappingSetting || mappingSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Mapping setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Mapping setting retrieved successfully!", data: mappingSetting[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateMappingSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedMappingSetting = await mappingSettingModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				inbound_format: req.body.inbound_format,
				outbound_format: req.body.outbound_format,
				mapping_data: req.body.mapping_data,
				is_active: req.body.is_active,
				enableLog: req.body.enableLog || "off",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedMappingSetting) {
			return res.status(404).send({ status: 0, message: "Mapping setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Mapping setting updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateByItemId = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateMappingSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedMappingSetting = await mappingSettingModel.updateOne(
			{ item_id: req.body.item_id },
			{
				item_id: req.body.item_id,
				inbound_format: req.body.inbound_format,
				outbound_format: req.body.outbound_format,
				mapping_data: req.body.mapping_data,
				is_active: req.body.is_active,
				enableLog: req.body.enableLog || "off",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedMappingSetting) {
			return res.status(404).send({ status: 0, message: "Mapping setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Mapping setting updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, updateByItemId };