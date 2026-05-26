const mongoose = require("mongoose");
const inboundHistoryModel = require("../models/inbound_history.model");

const validateInboundHistoryInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const validationError = validateInboundHistoryInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const inboundHistory = new inboundHistoryModel({
			item_id: req.body.item_id,
			status: req.body.status
		});

		const createdInboundHistory = await inboundHistory.save();

		return res.status(200).send({ status: 1, message: "Inbound history created successfully!", id: createdInboundHistory._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const createInboundLogHistory = async (data) => {
	try {
		const validationError = validateInboundHistoryInput(data);
		if (validationError) {
			return { status: 0, message: validationError };
		}

		const inboundHistory = new inboundHistoryModel({
			item_id: data.item_id,
			status: data.status
		});

		const createdInboundHistory = await inboundHistory.save();

		return {
			status: 1,
			message: "Inbound history created successfully!",
			id: createdInboundHistory._id
		};
	} catch (error) {
		return {
			status: 0,
			message: "Failed to create inbound history",
			error: error.message || error
		};
	}
};

const findAll = async (req, res, next) => {
	try {
		const inboundHistory = await inboundHistoryModel.find();

		return res.status(200).send({ status: 1, message: "Inbound history retrieved successfully!", data: inboundHistory });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const inboundHistory = await inboundHistoryModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!inboundHistory || inboundHistory.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound history retrieved successfully!", data: inboundHistory[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const lastOne = async (req, res, next) => {
	try {
		const inboundHistory = await inboundHistoryModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $sort: { createdAt: -1 } },
			{ $limit: 1 }
		]);

		if (!inboundHistory || inboundHistory.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound history retrieved successfully!", data: inboundHistory[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const validationError = validateInboundFilterInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedInboundHistory = await inboundHistoryModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				status: req.body.status
			},
			{ new: true }
		);

		if (!updatedInboundHistory) {
			return res.status(404).send({ status: 0, message: "Inbound history not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound history updated successfully!" });
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

		const result = await inboundHistoryModel.deleteMany({ createdAt: { "$lte": newDate } });

		return res.status(200).json({ status: 1, message: "Deleted successfully" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, findOne, lastOne, update, deleteAll, createInboundLogHistory };