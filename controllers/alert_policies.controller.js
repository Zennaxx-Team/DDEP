const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const alertpoliciesModel = require("../models/alert_policies.model");

const extractUserInfoFromToken = (cookies) => {
	if (cookies && cookies.Token && process.env.EnableGima === "true") {
		const decoded = jwtDecode(cookies.Token);

		return {
			companyCode: decoded.company_code,
			userName: decoded.username
		};
	}

	return {
		companyCode: config.companyCode,
		userName: config.userName
	};
};

const validateAlertPolicyInput = (body) => {
	if (!body.name) {
		return "Please enter the Policy Name";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const searchKeyword = req.body.search || ""; 
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const query = {
			companyCode,
			$or: [
				{ name: { $regex: searchKeyword, $options: "i" } },
				{ description: { $regex: searchKeyword, $options: "i" } },
				{ createdBy: { $regex: searchKeyword, $options: "i" } }
			]
		};

		const total = await alertpoliciesModel.countDocuments(query);
		const alertPolicies = await alertpoliciesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Alert policies retrieved successfully!", data: alertPolicies, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedalertpolicie = await alertpoliciesModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedalertpolicie) {
			return res.status(404).send({ status: 0, message: "Alert policy not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert policy status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateAlertPolicyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const alertpolicie = new alertpoliciesModel({
			name: req.body.name,
			description: req.body.description,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdAlertpolicie = await alertpolicie.save();

		return res.status(200).send({ status: 1, message: "Alert policy created successfully!", id: createdAlertpolicie._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const alertpolicy = await alertpoliciesModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
		]);

		if (!alertpolicy || alertpolicy.length === 0) {
			return res.status(404).send({ status: 0, message: "Alert policy not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert policy retrieved successfully!", data: alertpolicy[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateAlertPolicyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedalertpolicy = await alertpoliciesModel.findByIdAndUpdate(
			req.params.id,
			{
				name: req.body.name,
				description: req.body.description,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedalertpolicy) {
			return res.status(404).send({ status: 0, message: "Alert policy not found!" });
		}

		return res.status(200).send({ status: 1, message: "Alert policy updated successfully!", id: updatedalertpolicy._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const alertPolicies = await alertpoliciesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Alert policy retrieved successfully!", data: alertPolicies });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { list, statusChange, create, findOne, update, all };