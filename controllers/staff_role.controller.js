const staffRoleModel = require("../models/staff_role.model");

const create = async (req, res, next) => {
	try {
		const post_data = req.body;
		const userdetails = {};

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value;
		});

		const user = new staffRoleModel(userdetails);
		const createdStaffRole = await user.save();
		
		return res.status(200).send({ status: 1, message: "Staff role created successfully!", id: createdStaffRole._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const staffRole = await staffRoleModel.aggregate([
			{ $match: { guid_key: req.body.id } },
			{ $limit: 1 }
		]);

		if (!staffRole || staffRole.length === 0) {
			return res.status(200).send({ status: 0, message: "Staff role not found!" });
		}

		return res.status(200).send({ status: 1, message: "Staff role retrieved successfully!", data: staffRole[0] });
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

		const updatedStaffRole = await staffRoleModel.findByIdAndUpdate(
			req.params.id,
			userdetails,
			{ new: true }
		);

		if (!updatedStaffRole) {
			return res.status(404).send({ status: 0, message: "Staff role not found!" });
		}

		return res.status(200).send({ status: 1, message: "Staff role updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteStaffRole = async (req, res, next) => {
	try {
		const deletedStaffRole = await staffRoleModel.findByIdAndRemove(req.params.id);

		if (!deletedStaffRole) {
			return res.status(404).send({ status: 0, message: "Staff role not found" });
		}

		return res.status(200).send({ status: 1, message: "Staff role deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, deleteStaffRole };