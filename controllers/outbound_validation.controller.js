const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const outboundValidationModel = require("../models/outbound_validation.model");

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

const validateOutboundValidationInput = (body) => {
	if (!body.item_id) {
		return "Item ID not found";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundValidationInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const outboundValidation = new outboundValidationModel({
			item_id: req.body.item_id,
			validations: req.body.validations || [],
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdOutboundValidation = await outboundValidation.save();

		return res.status(200).send({ status: 1, message: "Outbound validation created successfully!", id: createdOutboundValidation._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAll = async (req, res, next) => {
	try {
		const outboundValidation = await outboundValidationModel.find();

		return res.status(200).send({ status: 1, message: "Outbound validation retrieved successfully!", data: outboundValidation });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const outboundValidation = await outboundValidationModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!outboundValidation || outboundValidation.length === 0) {
			return res.status(404).send({ status: 0, message: "Outbound validation not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound validation retrieved successfully!", data: outboundValidation[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundValidationInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutboundValidation = await outboundValidationModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				validations: req.body.validations || [],
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedOutboundValidation) {
			return res.status(404).send({ status: 0, message: "Outbound validation not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound validation updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, findOne, update };