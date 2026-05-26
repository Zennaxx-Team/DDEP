const legalEntityModel = require("../models/tbl_legal_entity.model");

const create = async (req, res, next) => {
	try {
		const post_data = req.body;
		const userdetails = {};

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value;
		});

		const legalEntity = new legalEntityModel(userdetails);
		const createdLegalEntity = await legalEntity.save();
		
		return res.status(200).send({ status: 1, message: "Legal Entity created successfully!", id: createdLegalEntity._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const legalEntity = await legalEntityModel.aggregate([
			{ $match: { legal_entity_code: req.body.id } },
			{ $limit: 1 }
		]);

		if (!legalEntity || legalEntity.length === 0) {
			return res.status(200).send({ status: 0, message: "Legal Entity not found!" });
		}

		return res.status(200).send({ status: 1, message: "Legal Entity retrieved successfully!", data: legalEntity[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const post_data = req.body;
		const userdetails = {};

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value; 
		});

		const updatedLegalEntity = await legalEntityModel.findByIdAndUpdate(
			req.params.id,
			userdetails,
			{ new: true }
		);

		if (!updatedLegalEntity) {
			return res.status(404).send({ status: 0, message: "Legal Entity not found!" });
		}

		return res.status(200).send({ status: 1, message: "Legal Entity updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteLegalEntity = async (req, res, next) => {
	try {
		const deletedLegalEntity = await legalEntityModel.findByIdAndRemove(req.params.id);

		if (!deletedLegalEntity) {
			return res.status(404).send({ status: 0, message: "Legal Entity not found" });
		}

		return res.status(200).send({ status: 1, message: "Legal Entity deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, deleteLegalEntity };