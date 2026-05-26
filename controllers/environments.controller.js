const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const companiesModel = require("../models/companies.model");
const projectsModel = require("../models/projects.model");
const environmentsModel = require("../models/environments.model");
const itemsModel = require("../models/item.model");
const inboundSettingModel = require("../models/inbound_setting.model");
const { findSetting } = require("./settings.controller");
const { buildUrlPrefix, systemCompanyPrefixUpdate, nonSystemCompanyPrefixUpdate } = require("../common/prefix");

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

const validateEnvironmentInput = (body) => {
	if (!body.companyId) {
		return "Please select the company";
	}

	if (!body.projectId && !body.projectId === null) {
		return "Please select the Project";
	}

	if (!body.environmentName) {
		return "Please enter the Environment Name";
	}

	if (!body.ddepApiPrefix) {
		return "Please enter the DDEP API Prefix";
	} else {
		const re = new RegExp(/^(\/)[a-zA-Z0-9-_\/]+$/);

		if (!re.test(body.ddepApiPrefix)) {
			return "DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)";
		}
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await environmentsModel.countDocuments(query);
		const environments = await environmentsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "companies",
					localField: "companyId",
					foreignField: "_id",
					as: "companies"
				}
			},
			{
				$unwind: {
					path: "$companies",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$lookup: {
					from: "projects",
					localField: "projectId",
					foreignField: "_id",
					as: "projects"
				}
			},
			{
				$unwind: {
					path: "$projects",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$project: {
					_id: 1,
					projectId: 1,
					name: 1,
					ddepApiPrefix: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					"companies.name": 1,
					"projects.name": 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Environments retrieved successfully!", data: environments, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const { id } = req.params;
		const { isActive } = req.body;

		// Check if ID is valid (optional, depends on your validation)
		if (!id) {
			return res.status(400).send({ status: 0, message: "ID is required" });
		}

		// Ensure isActive is provided and is a boolean
		if (typeof isActive === 'undefined') {
			return res.status(400).send({ status: 0, message: "isActive is required" });
		} else if (typeof isActive !== 'boolean') {
			return res.status(400).send({ status: 0, message: "isActive value must be true or false" });
		}

		// Find and update the environment
		const updatedEnvironment = await environmentsModel.findByIdAndUpdate(
			id,
			{ isActive: isActive },
			{ new: true }
		);

		// Handle case where the environment is not found
		if (!updatedEnvironment) {
			return res.status(404).send({ status: 0, message: "Environment not found!" });
		}

		// Successfully updated
		return res.status(200).send({ status: 1, message: "Environment status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		// Pass error to next middleware for centralized error handling
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateEnvironmentInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const environment = new environmentsModel({
			companyId: req.body.companyId,
			projectId: req.body.projectId,
			name: req.body.environmentName,
			sequence: req.body.sequence,
			ddepApiPrefix: req.body.ddepApiPrefix,
			description: req.body.environmentDescription,
			isUrlPerfix: req.body.isUrlPerfix,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdEnvironment = await environment.save();

		return res.status(200).send({ status: 1, message: "Environment created successfully!", id: createdEnvironment._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const environment = await environmentsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!environment || environment.length === 0) {
			return res.status(404).send({ status: 0, message: "Environment not found!" });
		}

		return res.status(200).send({ status: 1, message: "Environment retrieved successfully!", data: environment[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateEnvironmentInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedEnvironment = await environmentsModel.findByIdAndUpdate(
			req.params.id,
			{
				companyId: req.body.companyId,
				projectId: req.body.projectId,
				name: req.body.environmentName,
				sequence: req.body.sequence,
				ddepApiPrefix: req.body.ddepApiPrefix,
				description: req.body.environmentDescription,
				isUrlPerfix: req.body.isUrlPerfix,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedEnvironment) {
			return res.status(404).send({ status: 0, message: "Environment not found!" });
		}

		const item_list = await itemsModel.find({ companyId: updatedEnvironment.companyId, ProjectId: updatedEnvironment.projectId });

		for (const item of item_list) {
			const inboundSetting = await inboundSettingModel.findOne({ item_id: item._id });
			let project = null;
			let company = null;
			company = await companiesModel.findById(updatedEnvironment.companyId);
			project = await projectsModel.findById(updatedEnvironment.projectId);
			if (inboundSetting) {
				const isSystemCompany = company.isSystemCompany;
				let companyPrefix = null;
				let projectPrefix = null;
				let environmentPrefix = null;

				if (isSystemCompany) {
					({ companyPrefix, projectPrefix, environmentPrefix } = await systemCompanyPrefixUpdate(company, project, updatedEnvironment, item));
				} else {
					({ companyPrefix, projectPrefix, environmentPrefix } = await nonSystemCompanyPrefixUpdate(company, project, updatedEnvironment, item));
				}

				const urlPrefix = buildUrlPrefix(companyPrefix, projectPrefix, environmentPrefix);
				// Update the record
				inboundSetting.urlPrefix = urlPrefix;
				inboundSetting.updatedAt = new Date();
				await inboundSetting.save();
			}
		}

		return res.status(200).send({ status: 1, message: "Environment updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const allProjectEnvironment = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		let query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		if (req?.body?.companyId && mongoose.Types.ObjectId.isValid(req.body.companyId)) {
			query.companyId = new mongoose.Types.ObjectId(req.body.companyId);
		}

		if ('projectId' in req.body) {
			if (req.body.projectId === null) {
				query.projectId = null;
			} else if (mongoose.Types.ObjectId.isValid(req.body.projectId)) {
				query.projectId = new mongoose.Types.ObjectId(req.body.projectId);
			} else {
				// return res.status(400).send({ status: 0, message: "Invalid projectId" });
			}
		}

		const environments = await environmentsModel.aggregate([
			{ $match: query },
			{ $sort: { sequence: 1, createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Environments retrieved successfully!", data: environments });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const environments = await environmentsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({ status: 1, message: "Environments retrieved successfully!", data: environments });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkDdepApiPrefixExist = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { ddepApiPrefix, companyId, projectId, environmentId } = req.body;

		const query = { ddepApiPrefix };

		// Add companyCode only if EnableGima is true
		if (process.env.EnableGima === "true") {
			query.companyCode = companyCode;
		}

		if (companyId) {
			query.companyId = companyId;
		}

		// Add projectId filter only if it's present and not null/undefined/empty
		if (projectId) {
			query.projectId = projectId;
		}

		const environments = await environmentsModel.find(query);

		if (environments.length > 0) {
			const isExist = environments.some(environment => environment._id.toString() !== req.body.environmentId);

			if (isExist) {
				return res.status(200).send({ status: 0, message: "Environment DDEP API Prefix already exists!" });
			} else {
				return res.status(200).send({ status: 1, message: "Environment DDEP API Prefix does not exist!" });
			}
		} else {
			return res.status(200).send({ status: 1, message: "Environment DDEP API Prefix does not exist!" });
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findEnvByddepApiPrefix = async (ddepApiPrefix) => {
	try {
		const environment = await environmentsModel.aggregate([
			{ $match: { ddepApiPrefix: ddepApiPrefix } },
			{ $limit: 1 }
		]);

		return environment.length > 0 ? environment[0] : null;
	} catch (error) {
		console.error("Error in findEnvByProjectId:", error);
		throw error;
	}
}

const findEnvByCompanyCodeWithddepApiPrefix = async (companyCode, projectId, ddepApiPrefix) => {
	try {
		const environments = await environmentsModel.aggregate([
			{ $match: { companyCode: companyCode, projectId: projectId, ddepApiPrefix: ddepApiPrefix } },
			{ $limit: 1 }
		]);

		return environments.length > 0 ? environments[0] : null;
	} catch (error) {
		console.error("Error in findEnvByCompanyCodeWithddepApiPrefix:", error);
		throw error;
	}
}

module.exports = { list, statusChange, create, findOne, update, allProjectEnvironment, all, checkDdepApiPrefixExist, findEnvByddepApiPrefix, findEnvByCompanyCodeWithddepApiPrefix };