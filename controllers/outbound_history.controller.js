const mongoose = require("mongoose");
const outboundHistoryModel = require("../models/outbound_history.model");

const validateOutboundHistoryInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const validationError = validateOutboundHistoryInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const outboundSetting = new outboundHistoryModel({
			item_id: req.body.item_id,
			status: req.body.status
		});

		const createdOutboundHistory = await outboundSetting.save();

		return res.status(200).send({ status: 1, message: "Outbound history created successfully!", id: createdOutboundHistory._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const createOutboundLogHistory = async (data) => {
	try {
		const validationError = validateOutboundHistoryInput(data);
		if (validationError) {
			return { status: 0, message: validationError };
		}

		const outboundHistory = new outboundHistoryModel({
			item_id: data.item_id,
			status: data.status
		});

		const createdOutboundHistory = await outboundHistory.save();

		return {
			status: 1,
			message: "Outbound history created successfully!",
			id: createdOutboundHistory._id
		};
	} catch (error) {
		return {
			status: 0,
			message: "Failed to create Outbound history",
			error: error.message || error
		};
	}
};

const findAll = async (req, res, next) => {
	try {
		const outboundHistory = await outboundHistoryModel.find();

		return res.status(200).send({ status: 1, message: "Outbound history retrieved successfully!", data: outboundHistory });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const outboundHistory = await outboundHistoryModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!outboundHistory || outboundHistory.length === 0) {
			return res.status(404).send({ status: 0, message: "Outbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound history retrieved successfully!", data: outboundHistory[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const lastOne = async (req, res, next) => {
	try {
		const outboundHistory = await outboundHistoryModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $sort: { createdAt: -1 } },
			{ $limit: 1 }
		]);

		if (!outboundHistory || outboundHistory.length === 0) {
			return res.status(404).send({ status: 0, message: "Outbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound history retrieved successfully!", data: outboundHistory[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const validationError = validateOutboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutboundHistory = await outboundHistoryModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				status: req.body.status
			},
			{ new: true }
		);

		if (!updatedOutboundHistory) {
			return res.status(404).send({ status: 0, message: "Outbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound history updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteAll = async (req, res, next) => {
	try {
		let day = parseInt(req.params.day);
		let newDate = new Date(new Date().getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days keeps

		if (!isNaN(day) && day > 0) {
			newDate = new Date(new Date().getTime() - (day * 24 * 60 * 60 * 1000));
		}

		const result = await outboundHistoryModel.deleteMany({ createdAt: { "$lte": newDate } });

		return res.status(200).json({ status: 1, message: "Deleted successfully" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, findOne, lastOne, update, deleteAll, createOutboundLogHistory };