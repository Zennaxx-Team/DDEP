const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const outboundFilterModel = require("../models/outbound_filters.model");

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

const validateOutboundFilterInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const outboundFilter = new outboundFilterModel({
			item_id: req.body.item_id,
			outbound_filter: req.body.outbound_filter || [],
			is_active: req.body.is_active,
			enableLog: req.body.enableLog || "off",
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdOutboundFilter = await outboundFilter.save();

		return res.status(200).send({ status: 1, message: "Outbound filter created successfully!", id: createdOutboundFilter._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const outboundFilter = await outboundFilterModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!outboundFilter || outboundFilter.length === 0) {
			return res.status(404).send({ status: 0, message: "Outbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound filter retrieved successfully!", data: outboundFilter[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutboundFilter = await outboundFilterModel.findByIdAndUpdate(
			req.params.id,
			{
				outbound_filter: req.body.outbound_filter || [],
				enableLog: req.body.enableLog || "off",
				is_active: req.body.is_active,
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedOutboundFilter) {
			return res.status(404).send({ status: 0, message: "Outbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound filter updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateByItemId = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutboundFilter = await outboundFilterModel.updateOne(
			{ item_id: req.body.item_id },
			{
				outbound_filter: req.body.outbound_filter || [],
				enableLog: req.body.enableLog || "off",
				is_active: req.body.is_active,
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedOutboundFilter) {
			return res.status(404).send({ status: 0, message: "Outbound filter not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound filter updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, updateByItemId };