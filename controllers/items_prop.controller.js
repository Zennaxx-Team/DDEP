const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const itemsPropModel = require("../models/items_prop.model");

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

const validateItemsPropInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateItemsPropInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const itemsProp = new itemsPropModel({
			item_id: req.body.item_id,
			item_properties: req.body.item_properties || [],
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdItemsProp = await itemsProp.save();

		return res.status(200).send({ status: 1, message: "Items properties created successfully!", id: createdItemsProp._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const itemsProp = await itemsPropModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!itemsProp || itemsProp.length === 0) {
			return res.status(404).send({ status: 0, message: "Items properties not found!" });
		}

		return res.status(200).send({ status: 1, message: "Items properties retrieved successfully!", data: itemsProp[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateItemsPropInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedItemsProp = await itemsPropModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				item_properties: req.body.item_properties || [],
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedItemsProp) {
			return res.status(404).send({ status: 0, message: "Items properties not found!" });
		}

		return res.status(200).send({ status: 1, message: "Items properties updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateByItemId = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateItemsPropInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedItemsProp = await itemsPropModel.updateOne(
			{ item_id: req.body.item_id },
			{
				item_id: req.body.item_id,
				item_properties: req.body.item_properties || [],
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedItemsProp) {
			return res.status(404).send({ status: 0, message: "Items properties not found!" });
		}

		return res.status(200).send({ status: 1, message: "Items properties updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const clear = async (req, res, next) => {
	try {
		const itemsProp = await itemsPropModel.findByIdAndRemove(req.params.id);

		if (!itemsProp) {
			return res.status(404).send({ status: 0, message: "Items properties not found!" });
		}

		return res.status(200).send({ status: 1, message: "Items properties deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, update, findOne, updateByItemId, clear };