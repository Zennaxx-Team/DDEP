const branchModel = require("../models/tbl_branch.model");

const create = async (req, res, next) => {
	try {
		const post_data = req.body;
		const userdetails = {};

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value;
		});

		const branch = new branchModel(userdetails);
		const createdBranch = await branch.save();
		
		return res.status(200).send({ status: 1, message: "Branch created successfully!", id: createdBranch._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const branch = await branchModel.aggregate([
			{ $match: { branch_code: req.body.id } },
			{ $limit: 1 }
		]);

		if (!branch || branch.length === 0) {
			return res.status(200).send({ status: 0, message: "Branch not found!" });
		}

		return res.status(200).send({ status: 1, message: "Branch retrieved successfully!", data: branch[0] });
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

		const updatedBranch = await branchModel.findByIdAndUpdate(
			req.params.id,
			userdetails,
			{ new: true }
		);

		if (!updatedBranch) {
			return res.status(404).send({ status: 0, message: "Branch not found!" });
		}

		return res.status(200).send({ status: 1, message: "Branch updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteBranch = async (req, res, next) => {
	try {
		const deletedBranch = await branchModel.findByIdAndRemove(req.params.id);

		if (!deletedBranch) {
			return res.status(404).send({ status: 0, message: "Branch not found" });
		}

		return res.status(200).send({ status: 1, message: "Branch deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, deleteBranch };