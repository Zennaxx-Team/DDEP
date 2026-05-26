const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const environmentsModel = require("../models/environments.model");
const companiesModel = require("../models/companies.model");
const projectsModel = require("../models/projects.model");
const itemsModel = require("../models/item.model");
const inboundSettingModel = require("../models/inbound_setting.model");
const { findSetting } = require("./settings.controller");
const { buildUrlPrefix, systemCompanyPrefixUpdate, nonSystemCompanyPrefixUpdate } = require("../common/prefix");

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

const validateCompanyInput = (body) => {
	if (!body.companyName) {
		return "Please enter the Company Name";
	}

	if (!body.code) {
		return "Please enter the Company Code";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isSystemCompany: false } : { isSystemCompany: false };
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await companiesModel.countDocuments(query);
		const companies = await companiesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "projects",
					localField: "_id",
					foreignField: "companyId",
					as: "projects"
				}
			},
			{
				$addFields: {
					projectsTotal: {
						$size: "$projects"
					}
				}
			},
			{
				$project: {
					_id: 1,
					name: 1,
					code: 1,
					description: 1,
					sequence: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					projectsTotal: 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Companies retrieved successfully!", data: companies, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedCompany = await companiesModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedCompany) {
			return res.status(404).send({ status: 0, message: "Company not found!" });
		}

		return res.status(200).send({ status: 1, message: "Company status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateCompanyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const company = new companiesModel({
			code: req.body.code,
			name: req.body.companyName,
			description: req.body.companyDescription,
			sequence: req.body.sequence,
			defaultProjectPrefix: req.body.defaultProjectPrefix,
			isDisableDefaultProjectPrefix: req.body.isDisableDefaultProjectPrefix,
			isUrlPerfix: req.body.isUrlPerfix,
			isSystemCompany: false,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdCompany = await company.save();

		return res.status(200).send({ status: 1, message: "Company created successfully!", id: createdCompany._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const company = await companiesModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "projects",
					localField: "_id",
					foreignField: "companyId",
					as: "projects"
				}
			}
		]);

		if (!company || company.length === 0) {
			return res.status(404).send({ status: 0, message: "Company not found!" });
		}

		return res.status(200).send({ status: 1, message: "Company retrieved successfully!", data: company[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateCompanyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedCompany = await companiesModel.findByIdAndUpdate(
			req.params.id,
			{
				code: req.body.code,
				name: req.body.companyName,
				description: req.body.companyDescription,
				sequence: req.body.sequence,
				defaultProjectPrefix: req.body.defaultProjectPrefix,
				isDisableDefaultProjectPrefix: req.body.isDisableDefaultProjectPrefix,
				isUrlPerfix: req.body.isUrlPerfix,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedCompany) {
			return res.status(404).send({ status: 0, message: "Company not found!" });
		}

		const item_list = await itemsModel.find({ companyId: updatedCompany._id });
		for (const item of item_list) {
			const inboundSetting = await inboundSettingModel.findOne({ item_id: item._id });
			let project = null;
			let environment = null;
			project = await projectsModel.findById(item.ProjectId);
			environment = await environmentsModel.findById(item.environmentId);
			if (inboundSetting) {
				const isSystemCompany = updatedCompany.isSystemCompany;
				let companyPrefix = null;
				let projectPrefix = null;
				let environmentPrefix = null;

				if (isSystemCompany) {
					({ companyPrefix, projectPrefix, environmentPrefix } = await systemCompanyPrefixUpdate(updatedCompany, project, environment, item));
				} else {
					({ companyPrefix, projectPrefix, environmentPrefix } = await nonSystemCompanyPrefixUpdate(updatedCompany, project, environment, item));
				}

				const urlPrefix = buildUrlPrefix(companyPrefix, projectPrefix, environmentPrefix);

				// Update the record
				inboundSetting.urlPrefix = urlPrefix;
				inboundSetting.updatedAt = new Date();
				await inboundSetting.save();
			}
		}

		return res.status(200).send({ status: 1, message: "Company updated successfully!", id: updatedCompany._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const companies = await companiesModel.aggregate([
			{ $match: query },
			{ $sort: { isSystemCompany: -1, sequence: 1, createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Companies retrieved successfully!", data: companies });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getCompany = async (req, res, next) => {
	try {
		const company = await companiesModel.aggregate([
			{ $match: { companyCode: req.params.companyCode } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "projects",
					localField: "_id",
					foreignField: "companyId",
					as: "projects"
				}
			}
		]);

		if (!company || company.length === 0) {
			return res.status(404).send({ status: 0, message: "Company not found!" });
		}

		return res.status(200).send({ status: 1, message: "Company retrieved successfully!", data: company[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getCompanyByCompanyCode = async (companyCode) => {
	try {
		let company = await companiesModel.aggregate([
			{ $match: { companyCode, isActive: true, isSystemCompany: true } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "projects",
					localField: "_id",
					foreignField: "companyId",
					as: "projects"
				}
			}
		]);

		if (!company || company.length === 0) {
			company = await companiesModel.aggregate([
				{ $match: { companyCode } },
				{ $limit: 1 },
				{
					$lookup: {
						from: "projects",
						localField: "_id",
						foreignField: "companyId",
						as: "projects"
					}
				}
			]);
		}

		if (!company || company.length === 0) {
			return { status: 0, message: "Company not found!" };
		}

		return { status: 1, message: "Company retrieved successfully!", data: company[0] };
	} catch (err) {
		err.statusCode = 500;
		return { status: 0, message: "Company  not retrieved successfully!", data: null };
	}
};


const checkCodeExist = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);

		const baseQuery = { code: req.body.code, companyCode, isActive: true };

		const companies = await companiesModel.find(baseQuery);
		if (companies.length > 0) {
			const isExist = companies.some(company => company._id.toString() !== req.body.companyId);

			if (isExist) {
				return res.status(200).send({ status: 0, message: "Company code already exists!" });
			} else {
				return res.status(200).send({ status: 1, message: "Company code does not exist!" });
			}
		} else {
			return res.status(200).send({ status: 1, message: "Company code does not exist!" });
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
}

const getCompanyByCode = async (companyCode, code) => {
	try {
		const company = await companiesModel.aggregate([
			{ $match: { code: code, companyCode: companyCode } },
			{ $limit: 1 }
		]);

		return company.length > 0 ? company[0] : null;
	} catch (error) {
		console.error("Error in getCompanyByCode:", error);
		throw error;
	}
};

const checkCompanyExists = async (req, res, next) => {
	try {
		const { companyId } = req.body;

		if (!companyId) {
			return res.status(400).json({ 
				status: 0, 
				message: "Company ID is required" 
			});
		}

		const company = await companiesModel.findById(companyId);

		return res.status(200).json({
			status: 1,
			exists: !!company,
			data: company || null
		});

	} catch (err) {
		console.error("Check company exists failed:", err);
		return res.status(500).json({ 
			status: 0, 
			message: err.message || "Error checking company" 
		});
	}
};

module.exports = { list, statusChange, create, findOne, update, all, getCompany, getCompanyByCompanyCode, checkCodeExist, getCompanyByCode, checkCompanyExists };