const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const inboundFilterModel = require("../models/inbound_filters.model");

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

const validateInboundFilterInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const inboundFilter = new inboundFilterModel({
			item_id: req.body.item_id,
			inbound_filter: req.body.inbound_filter || [],
			enableLog: req.body.enableLog || "off",
			is_active: req.body.is_active,
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdInboundFilter = await inboundFilter.save();

		return res.status(200).send({ status: 1, message: "Inbound filter created successfully!", id: createdInboundFilter._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const inboundFilter = await inboundFilterModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!inboundFilter || inboundFilter.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound filter retrieved successfully!", data: inboundFilter[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedInboundFilter = await inboundFilterModel.findByIdAndUpdate(
			req.params.id,
			{
				inbound_filter: req.body.inbound_filter || [],
				enableLog: req.body.enableLog || "off",
				is_active: req.body.is_active,
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedInboundFilter) {
			return res.status(404).send({ status: 0, message: "Inbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound filter updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateByItemId = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedInboundFilter = await inboundFilterModel.updateOne(
			{ item_id: req.body.item_id },
			{
				inbound_filter: req.body.inbound_filter || [],
				enableLog: req.body.enableLog || "off",
				is_active: req.body.is_active,
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedInboundFilter) {
			return res.status(404).send({ status: 0, message: "Inbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound filter updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, updateByItemId };