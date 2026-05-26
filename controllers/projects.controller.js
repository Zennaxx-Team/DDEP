const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const environmentsModel = require("../models/environments.model");
const companiesModel = require("../models/companies.model");
const projectsModel = require("../models/projects.model");
const projectsUsersModel = require("../models/projects_users.model");
const itemsModel = require("../models/item.model");
const inboundSettingModel = require("../models/inbound_setting.model");
const { findSetting } = require("./settings.controller");
const { buildUrlPrefix, nonSystemCompanyPrefixUpdate, systemCompanyPrefixUpdate } = require("../common/prefix.js");

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

const validateProjectInput = (body) => {
	if (!body.projectCode) {
		return "Please enter the Project Code";
	}

	if (!body.projectName) {
		return "Please enter the Project Name";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await projectsModel.countDocuments(query);
		const projects = await projectsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "projects_users",
					localField: "_id",
					foreignField: "projectId",
					as: "users"
				}
			},
			{
				$addFields: {
					membersTotal: {
						$size: "$users"
					}
				}
			},
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
				$project: {
					_id: 1,
					name: 1,
					description: 1,
					isActive: 1,
					createdBy: 1,
					createdAt: 1,
					updatedAt: 1,
					membersTotal: 1,
					"companies.name": 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Projects retrieved successfully!", data: projects, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedProject = await projectsModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedProject) {
			return res.status(404).send({ status: 0, message: "Project not found!" });
		}

		return res.status(200).send({ status: 1, message: "Project status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateProjectInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const project = new projectsModel({
			companyId: req.body.companyId,
			code: req.body.projectCode,
			name: req.body.projectName,
			description: req.body.projectDescription,
			sequence: req.body.sequence,
			email: req.body.email,
			emailTitle: req.body.emailTitle,
			isUrlPerfix: req.body.isUrlPerfix,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdProject = await project.save();

		if (Array.isArray(req.body.permissions) && req.body.permissions.length > 0) {
			const projectsUserPromises = req.body.permissions.map(permission => {
				return new projectsUsersModel({
					projectId: createdProject._id,
					userId: permission.userId,
					permissionId: permission.permissionId,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});
			await Promise.all(projectsUserPromises);
		}

		return res.status(200).send({ status: 1, message: "Project created successfully!", id: createdProject._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const project = await projectsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "projects_users",
					localField: "_id",
					foreignField: "projectId",
					as: "users"
				}
			}
		]);

		if (!project || project.length === 0) {
			return res.status(404).send({ status: 0, message: "Project not found!" });
		}

		return res.status(200).send({ status: 1, message: "Project retrieved successfully!", data: project[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateProjectInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedProject = await projectsModel.findByIdAndUpdate(
			req.params.id,
			{
				companyId: req.body.companyId,
				code: req.body.projectCode,
				name: req.body.projectName,
				description: req.body.projectDescription,
				sequence: req.body.sequence,
				email: req.body.email,
				emailTitle: req.body.emailTitle,
				isUrlPerfix: req.body.isUrlPerfix,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedProject) {
			return res.status(404).send({ status: 0, message: "Project not found!" });
		}

		const item_list = await itemsModel.find({ companyId: updatedProject.companyId, ProjectId: updatedProject._id });
		const company = await companiesModel.findById(updatedProject.companyId);
		if (company) {
			for (const item of item_list) {
				const inboundSetting = await inboundSettingModel.findOne({ item_id: item._id });
				let environment = null;
				environment = await environmentsModel.findById(item.environmentId);
				if (inboundSetting) {
					const isSystemCompany = company.isSystemCompany;
					let companyPrefix = null;
					let projectPrefix = null;
					let environmentPrefix = null;

					if (isSystemCompany) {
						({ companyPrefix, projectPrefix, environmentPrefix } = await systemCompanyPrefixUpdate(company, updatedProject, environment, item));
					} else {
						({ companyPrefix, projectPrefix, environmentPrefix } = await nonSystemCompanyPrefixUpdate(company, updatedProject, environment, item));
					}

					const urlPrefix = buildUrlPrefix(companyPrefix, projectPrefix, environmentPrefix);

					// Update the record
					inboundSetting.urlPrefix = urlPrefix;
					inboundSetting.updatedAt = new Date();
					await inboundSetting.save();
				}
			}
		}

		const existingPermissions = await projectsUsersModel.find({ projectId: req.params.id });
		const existingPermissionIds = existingPermissions.map(p => p._id.toString());

		const permissionsToAdd = req.body.permissions.filter(p => !p._id || !existingPermissionIds.includes(p._id));
		const permissionsToUpdate = req.body.permissions.filter(p => p._id && existingPermissionIds.includes(p._id));
		const permissionsToDelete = existingPermissions.filter(p => !req.body.permissions.some(ip => ip._id === p._id.toString()));

		if (permissionsToAdd.length > 0) {
			const projectsUserPromises = permissionsToAdd.map(permission => {
				return new projectsUsersModel({
					projectId: req.params.id,
					userId: permission.userId,
					permissionId: permission.permissionId,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});

			await Promise.all(projectsUserPromises);
		}

		if (permissionsToUpdate.length > 0) {
			const updatePromises = permissionsToUpdate.map(permission => {
				return projectsUsersModel.findByIdAndUpdate(permission._id, {
					userId: permission.userId,
					permissionId: permission.permissionId,
					updatedBy: userName
				});
			});

			await Promise.all(updatePromises);
		}

		if (permissionsToDelete.length > 0) {
			const deletePromises = permissionsToDelete.map(permission => {
				return projectsUsersModel.findByIdAndDelete(permission._id);
			});

			await Promise.all(deletePromises);
		}

		return res.status(200).send({ status: 1, message: "Project updated successfully!", id: updatedProject._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const allCompanyProject = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		let query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		if (req?.body?.companyId && req?.body?.companyId !== "all") {
			query = { ...query, companyId: new mongoose.Types.ObjectId(req?.body?.companyId) };
		}

		const projects = await projectsModel.aggregate([
			{ $match: query },
			{ $sort: { sequence: 1, createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Projects retrieved successfully!", data: projects });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		let query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const projects = await projectsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: 1 } }
		]);

		return res.status(200).send({ status: 1, message: "Projects retrieved successfully!", data: projects });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkCodeExist = async (req, res, next) => {
	try {
		const projects = await projectsModel.find({ code: req.body.projectCode });

		if (projects.length > 0) {
			const isExist = projects.some(project => project._id.toString() !== req.body.projectId);

			if (isExist) {
				return res.status(200).send({ status: 0, message: "Project code already exists!" });
			} else {
				return res.status(200).send({ status: 1, message: "Project code does not exist!" });
			}
		} else {
			return res.status(200).send({ status: 1, message: "Project code does not exist!" });
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findProjectByCode = async (companyCode, projectCode) => {
	try {
		const project = await projectsModel.aggregate([
			{ $match: { companyCode, code: projectCode } },
			{ $limit: 1 }
		]);

		return project.length > 0 ? project[0] : null;
	} catch (error) {
		console.error("Error in findProjectById:", error);
		throw error;
	}
};

const findProjectById = async (projectCode, _id) => {
	try {
		const project = await projectsModel.aggregate([
			{ $match: { code: projectCode, companyId: _id } },
			{ $limit: 1 }
		]);

		return project.length > 0 ? project[0] : null;
	} catch (error) {
		console.error("Error in findProjectById:", error);
		throw error;
	}
};

// Old

const fulllistProject = async () => {
	let result;
	await projectsModel.find()
		.then(projects => {
			result = projects
		}).catch(err => {
			result = "error";
		});
	return result;
}

const findProject = async (projectId) => {
	try {
		const project = await projectsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(projectId) } },
			{ $limit: 1 }
		]);

		if (!project || project.length === 0) {
			return { status: 0, message: "Project not found!" };
		}

		return { status: 1, message: "Project retrieved successfully!", data: project[0] };
	} catch (err) {
		return { status: 0, message: "Project not found!" };
	}
}
const checkProjectExists = async (req, res, next) => {
	try {
		const { companyId, projectId } = req.body;

		if (!companyId || !projectId) {
			return res.status(400).json({ 
				status: 0, 
				message: "Company ID and Project ID are required" 
			});
		}

		const project = await projectsModel.findOne({ 
			_id: projectId, 
			companyId: companyId 
		});

		return res.status(200).json({
			status: 1,
			exists: !!project,
			data: project || null
		});

	} catch (err) {
		console.error("Check project exists failed:", err);
		return res.status(500).json({ 
			status: 0, 
			message: err.message || "Error checking project" 
		});
	}
};

module.exports = { list, statusChange, create, findOne, update, allCompanyProject, all, checkCodeExist, fulllistProject, findProjectByCode, findProjectById, findProject, checkProjectExists };