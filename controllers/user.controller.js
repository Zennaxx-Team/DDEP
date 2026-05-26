const jwtDecode = require("jwt-decode");
const config = require("../config");
const usersModel = require("../models/user.model");

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

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await usersModel.countDocuments(query);
		const users = await usersModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$project: {
					_id: 1,
					display_name: 1,
					title: 1,
					email: 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Users retrieved successfully!", data: users, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		let post_data = req.body;
		const userdetails = {};

		delete post_data._id;

		Object.entries(post_data).forEach(([key, value]) => {
			userdetails[key] = value;
		});

		const user = new usersModel(userdetails);
		const createdUser = await user.save();

		return res.status(200).send({ status: 1, message: "User created successfully!", id: createdUser._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const user = await usersModel.aggregate([
			{ $match: { user_name: req.body.id, companyCode: req.body.companyCode } },
			{ $limit: 1 }
		]);

		if (!user || user.length === 0) {
			return res.status(200).send({ status: 0, message: "User not found!" });
		}

		return res.status(200).send({ status: 1, message: "User retrieved successfully!", data: user[0] });
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

		const updatedUser = await usersModel.findByIdAndUpdate(
			req.params.id,
			userdetails,
			{ new: true }
		);

		if (!updatedUser) {
			return res.status(404).send({ status: 0, message: "User not found!" });
		}

		return res.status(200).send({ status: 1, message: "User updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const deleteUser = async (req, res, next) => {
	try {
		const deletedUser = await usersModel.findByIdAndRemove(req.params.id);

		if (!deletedUser) {
			return res.status(404).send({ status: 0, message: "User not found" });
		}

		return res.status(200).send({ status: 1, message: "User deleted successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};

		const users = await usersModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({ status: 1, message: "Users retrieved successfully!", data: users });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getUserDetails = async (user_name, companyCode) => {
	try {
		const users = await usersModel.aggregate([
			{ $match: { user_name, companyCode } },
			{ $limit: 1 }
		]);

		if (!users || users.length === 0) {
			return { status: 0, message: "User not found!" };
		}

		return { status: 1, message: "User retrieved successfully!", data: users[0] };
	} catch (error) {
		error.statusCode = 500;
		return { status: 0, message: "Internal server error", data: null };
	}
};

module.exports = { list, create, findOne, update, deleteUser, all, getUserDetails };