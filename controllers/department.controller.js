const departmentModel = require("../models/tbl_department.model");

const create = async (req, res, next) => {
	try {
		const post_data = req.body;
		const userdetails = {};

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value;
		});

		const department = new departmentModel(userdetails);
		const createdDepartment = await department.save();
		
		return res.status(200).send({ status: 1, message: "Department created successfully!", id: createdDepartment._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const department = await departmentModel.aggregate([
			{ $match: { department_code: req.body.id } },
			{ $limit: 1 }
		]);

		if (!department || department.length === 0) {
			return res.status(200).send({ status: 0, message: "Department not found!" });
		}

		return res.status(200).send({ status: 1, message: "Department retrieved successfully!", data: department[0] });
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

		const updatedDepartment = await departmentModel.findByIdAndUpdate(
			req.params.id,
			userdetails,
			{ new: true }
		);

		if (!updatedDepartment) {
			return res.status(404).send({ status: 0, message: "Department not found!" });
		}

		return res.status(200).send({ status: 1, message: "Department updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteDepartment = async (req, res, next) => {
	try {
		const deletedDepartment = await departmentModel.findByIdAndRemove(req.params.id);

		if (!deletedDepartment) {
			return res.status(404).send({ status: 0, message: "Department not found" });
		}

		return res.status(200).send({ status: 1, message: "Department deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, deleteDepartment };