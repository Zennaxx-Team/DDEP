const mongoose = require("mongoose");
const itemRunningSettingModel = require("../models/ItemRunningSetting.model");

const validateItemRunningInput = (body) => {
	if (!body.item_id) {
		return "Please select the Item";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const validationError = validateItemRunningInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const itemRunningSetting = new itemRunningSettingModel({
			item_id: req.body.item_id,
			is_inbound_running: req.body.is_inbound_running || "0",
			is_outbound_running: req.body.is_outbound_running || "0"
		});

		const createdItemRunningSetting = await itemRunningSetting.save();

		return res.status(200).send({ status: 1, message: "Item running created successfully!", id: createdItemRunningSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

async function createItemRunning(body) {
	try {
		const validationError = validateItemRunningInput(body);
		if (validationError) {
			return { status: 0, message: validationError };
		}

		const itemRunningSetting = new itemRunningSettingModel({
			item_id: body.item_id,
			is_inbound_running: body.is_inbound_running || "0",
			is_outbound_running: body.is_outbound_running || "0"
		});

		const createdItemRunningSetting = await itemRunningSetting.save();

		return {
			status: 1,
			message: "Item running created successfully!",
			id: createdItemRunningSetting._id
		};
	} catch (err) {
		// Log or rethrow error if needed
		return {
			status: 0,
			message: "Internal server error",
			error: err.message || err.toString()
		};
	}
}


const findOne = async (req, res, next) => {
	try {
		const itemRunning = await itemRunningSettingModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!itemRunning || itemRunning.length === 0) {
			return res.status(404).send({ status: 0, message: "Item running not found!" });
		}

		return res.status(200).send({ status: 1, message: "Item running retrieved successfully!", data: itemRunning[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const validationError = validateItemRunningInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedItemRunningSetting = await itemRunningSettingModel.findByIdAndUpdate(
			req.params.id,
			{
				item_id: req.body.item_id,
				is_inbound_running: req.body.is_inbound_running || "0",
				is_outbound_running: req.body.is_outbound_running || "0"
			},
			{ new: true }
		);

		if (!updatedItemRunningSetting) {
			return res.status(404).send({ status: 0, message: "Item running not found!" });
		}

		return res.status(200).send({ status: 1, message: "Item running updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

async function updateItemRunning(id, body) {
	try {
		const validationError = validateItemRunningInput(body);
		if (validationError) {
			return { status: 0, message: validationError };
		}

		const updatedItemRunningSetting = await itemRunningSettingModel.findByIdAndUpdate(
			id,
			{
				item_id: body.item_id,
				is_inbound_running: body.is_inbound_running || "0",
				is_outbound_running: body.is_outbound_running || "0"
			},
			{ new: true }
		);

		if (!updatedItemRunningSetting) {
			return { status: 0, message: "Item running not found!" };
		}

		return { status: 1, message: "Item running updated successfully!" };
	} catch (err) {
		return {
			status: 0,
			message: "Internal server error",
			error: err.message || err.toString()
		};
	}
}


const updateMany = async (req, res, next) => {
	try {
		const newDate = new Date((Date.now() - (10 * 60 * 1000)));
		const itemRunningSetting = {
			is_inbound_running: "0",
			is_outbound_running: "0"
		};

		const updateResult = await itemRunningSettingModel.updateMany(
			{ updatedAt: { "$lte": newDate } },
			itemRunningSetting
		);

		return res.status(200).send({ status: 1, message: "Item running updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, updateMany, createItemRunning, updateItemRunning };