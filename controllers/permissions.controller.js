const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const ase = require("../my_modules/aes");
const permissionsModel = require("../models/permissions.model");
const permissionsTypesModel = require("../models/permissions_types.model");
const permissionsUsersModel = require("../models/permissions_users.model");
const usersModel = require("../models/user.model");
const companiesModel = require("../models/companies.model");
const itemsModel = require("../models/item.model");

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

const validatePermissionInput = (body) => {
	if (!body.permissionName) {
		return "Please enter the Permission Name";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await permissionsModel.countDocuments(query);
		const permissions = await permissionsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord }
		]);

		return res.status(200).send({ status: 1, message: "Permissions retrieved successfully!", data: permissions, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedPermission = await permissionsModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedPermission) {
			return res.status(404).send({ status: 0, message: "Permission not found!" });
		}

		return res.status(200).send({ status: 1, message: "Permission status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validatePermissionInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const permission = new permissionsModel({
			name: req.body.permissionName,
			isAdmin: req.body.isAdmin,
			description: req.body.permissionDescription,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdPermission = await permission.save();

		if (Array.isArray(req.body.permissions) && req.body.permissions.length > 0) {
			const permissionsTypePromises = req.body.permissions.map(permissionType => {
				return new permissionsTypesModel({
					permissionId: createdPermission._id,
					type: permissionType.type,
					canView: permissionType.canView,
					canCreate: permissionType.canCreate,
					canModify: permissionType.canModify,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});
			await Promise.all(permissionsTypePromises);
		}

		return res.status(200).send({ status: 1, message: "Permission created successfully!", id: createdPermission._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const permission = await permissionsModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "permissions_types",
					localField: "_id",
					foreignField: "permissionId",
					as: "permissionsTypes"
				}
			}
		]);

		if (!permission || permission.length === 0) {
			return res.status(404).send({ status: 0, message: "Permission not found!" });
		}

		return res.status(200).send({ status: 1, message: "Permission retrieved successfully!", data: permission[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validatePermissionInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedPermission = await permissionsModel.findByIdAndUpdate(
			req.params.id,
			{
				name: req.body.permissionName,
				isAdmin: req.body.isAdmin,
				description: req.body.permissionDescription,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedPermission) {
			return res.status(404).send({ status: 0, message: "Permission not found!" });
		}

		const existingPermissions = await permissionsTypesModel.find({ permissionId: req.params.id });
		const existingPermissionIds = existingPermissions.map(p => p._id.toString());

		const permissionsToAdd = req.body.permissions.filter(p => !p._id || !existingPermissionIds.includes(p._id));
		const permissionsToUpdate = req.body.permissions.filter(p => p._id && existingPermissionIds.includes(p._id));
		const permissionsToDelete = existingPermissions.filter(p => !req.body.permissions.some(ip => ip._id === p._id.toString()));

		if (permissionsToAdd.length > 0) {
			const permissionsTypePromises = permissionsToAdd.map(permissionType => {
				return new permissionsTypesModel({
					permissionId: req.params.id,
					type: permissionType.type,
					canView: permissionType.canView,
					canCreate: permissionType.canCreate,
					canModify: permissionType.canModify,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});

			await Promise.all(permissionsTypePromises);
		}

		if (permissionsToUpdate.length > 0) {
			const updatePromises = permissionsToUpdate.map(permission => {
				return permissionsTypesModel.findByIdAndUpdate(permission._id, {
					permissionId: permission.permissionId,
					type: permission.type,
					canView: permission.canView,
					canCreate: permission.canCreate,
					canModify: permission.canModify,
					updatedBy: userName
				});
			});

			await Promise.all(updatePromises);
		}

		if (permissionsToDelete.length > 0) {
			const deletePromises = permissionsToDelete.map(permission => {
				return permissionsTypesModel.findByIdAndDelete(permission._id);
			});

			await Promise.all(deletePromises);
		}

		return res.status(200).send({ status: 1, message: "Permission updated successfully!", id: updatedPermission._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const permissions = await permissionsModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({ status: 1, message: "Permissions retrieved successfully!", data: permissions });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const initPermission = async (req, res, next) => {
	try {
		const Aes = new ase();
		const reqBody = req.body;
		const data = Aes.Decrypt(unescape(reqBody));
		const { companyCode, username, companyName } = JSON.parse(data);

		const datas = [
			{
				permissionCode: "Viewer",
				name: "Viewer",
				description: "Viewer",
				isAdmin: false,
				isActive: true,
				permissions: [
					{
						type: "projects",
						canView: true,
						canCreate: false,
						canModify: false
					},
					{
						type: "items",
						canView: true,
						canCreate: false,
						canModify: false
					}
				]
			},
			{
				permissionCode: "Items Maintainer",
				name: "Items Maintainer",
				description: "Items Maintainer",
				isAdmin: false,
				isActive: true,
				permissions: [
					{
						type: "projects",
						canView: true,
						canCreate: false,
						canModify: false
					},
					{
						type: "items",
						canView: true,
						canCreate: true,
						canModify: true
					}
				]
			},
			{
				permissionCode: "Project Maintainer",
				name: "Project Maintainer",
				description: "Project Maintainer",
				isAdmin: false,
				isActive: true,
				permissions: [
					{
						type: "projects",
						canView: true,
						canCreate: true,
						canModify: true
					},
					{
						type: "items",
						canView: true,
						canCreate: true,
						canModify: true
					}
				]
			},
			{
				permissionCode: "Administrator",
				name: "Administrator",
				description: "Administrator",
				isAdmin: true,
				isActive: true,
				permissions: []
			}
		];

		const createdPermissionIds = [];
		let adminPermissionId = null;
		let message = "";

		const permissionPromises = datas.map(async data => {
			const existingPermission = await permissionsModel.findOne({
				companyCode,
				permissionCode: data.permissionCode,
			});

			if (existingPermission) {
				console.log(`Permission ${data.name} already exists for company ${companyCode}. Skipping...`);
				if (data.permissionCode === "Administrator") {
					adminPermissionId = existingPermission._id;
				}
				return;
			}

			const permission = new permissionsModel({
				permissionCode: data.permissionCode || null,
				name: data.name,
				isAdmin: data.isAdmin,
				description: data.description,
				isActive: data.isActive,
				companyCode,
				createdBy: username,
				updatedBy: username
			});

			const createdPermission = await permission.save();

			createdPermissionIds.push(createdPermission._id);

			if (data.permissionCode === "Administrator") {
				adminPermissionId = createdPermission._id;
			}

			if (Array.isArray(data.permissions) && data.permissions.length > 0) {
				const permissionsTypePromises = data.permissions.map(permissionType => {
					return new permissionsTypesModel({
						permissionId: createdPermission._id,
						type: permissionType.type,
						canView: permissionType.canView,
						canCreate: permissionType.canCreate,
						canModify: permissionType.canModify,
						createdBy: username,
						updatedBy: username
					}).save();
				});
				await Promise.all(permissionsTypePromises);
			}

			message = `Administrator created in ${companyCode} company.\r\nProject Maintainer created in ${companyCode} company.\r\nItem Maintainer created in ${companyCode} company.\r\nViewer created in ${companyCode} company.\r\n`;
		});

		await Promise.all(permissionPromises);

		const existingUser = await usersModel.findOne({
			companyCode,
			user_name: username
		});

		const existingPermissionUser = await permissionsUsersModel.findOne({
			companyCode,
			userName: username,
		});

		if (existingUser && !existingPermissionUser && adminPermissionId) {
			const newPermissionUser = new permissionsUsersModel({
				permissionId: adminPermissionId,
				userName: username,
				companyCode,
				createdBy: username,
				updatedBy: username
			});

			await newPermissionUser.save();

			message += `Administrator role assigned to ${username}.`;
		} else if (!existingUser) {
			message += `Administrator role has not assigned to ${username}, user cannot found in DDEP system.`;
		} else {
			message += `Administrator role assigned to ${username}.`;
		}

		if (companyName) {
			let companyId = "";
			const existingCompany = await companiesModel.findOne({
				companyCode,
				isSystemCompany: true
			});

			if (existingCompany) {
				await companiesModel.findByIdAndUpdate(
					existingCompany._id,
					{
						name: companyName,
						updatedBy: username
					},
					{ new: true }
				);

				companyId = existingCompany._id;
			} else {
				const newCompany = new companiesModel({
					name: companyName,
					description: "",
					sequence: "1",
					isSystemCompany: true,
					companyCode,
					createdBy: username,
					updatedBy: username
				});

				const createdCompany = await newCompany.save();
				companyId = createdCompany._id;
			}

			await itemsModel.updateMany(
				{
					CompanyCode: companyCode,
					companyId: { $exists: false },
					ProjectId: { $exists: false }
				},
				{
					$set: { companyId }
				}
			);
		}

		return res.status(200).json({ status: 1, message });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getUserPermission = async (req, res, next) => {
	try {
		const permission = await permissionsUsersModel.aggregate([
			{
				$match: { userName: req.body.username }
			},
			{
				$lookup: {
					from: "permissions",
					localField: "permissionId",
					foreignField: "_id",
					as: "permissions"
				}
			},
			{ $unwind: "$permissions" },
			{
				$lookup: {
					from: "permissions_types",
					localField: "permissions._id",
					foreignField: "permissionId",
					as: "permissionTypes"
				}
			},
			{
				$project: {
					_id: 0,
					username: "$userName",
					"permissions.name": 1,
					"permissions.isAdmin": 1,
					"permissions.isActive": 1,
					"permissions.permissionTypes.type": 1,
					"permissions.permissionTypes.canView": 1,
					"permissions.permissionTypes.canCreate": 1,
					"permissions.permissionTypes.canModify": 1
				}
			}
		]);

		let permissionData = {
			name: "Viewer",
			isAdmin: false,
			isActive: true,
			canViewProjects: false,
			canCreateProjects: false,
			canModifyProjects: false,
			canViewItems: true,
			canCreateItems: false,
			canModifyItems: false
		};

		if (permission && permission.length > 0) {
			const foundPermission = permission[0];

			permissionData = {
				name: foundPermission.permissions.name || "Viewer",
				isAdmin: foundPermission.permissions.isAdmin || false,
				isActive: foundPermission.permissions.isActive || true,
				canViewProjects: false,
				canCreateProjects: false,
				canModifyProjects: false,
				canViewItems: true,
				canCreateItems: false,
				canModifyItems: false
			};

			const permissionTypes = foundPermission.permissions.permissionTypes || [];
			for (let i = 0; i < permissionTypes.length; i++) {
				if (permissionTypes[i].type === "projects") {
					permissionData["canViewProjects"] = permissionTypes[i].canView;
					permissionData["canCreateProjects"] = permissionTypes[i].canCreate;
					permissionData["canModifyProjects"] = permissionTypes[i].canModify;
				} else if (permissionTypes[i].type === "items") {
					permissionData["canViewItems"] = permissionTypes[i].canView;
					permissionData["canCreateItems"] = permissionTypes[i].canCreate;
					permissionData["canModifyItems"] = permissionTypes[i].canModify;
				}
			}
		}

		return res.status(200).send({
			status: 1,
			message: "Permission retrieved successfully!",
			data: permissionData
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getUserPermissionByUsername = async (userName, companyCode) => {
	try {
		const permission = await permissionsUsersModel.aggregate([
			{
				$match: { userName, companyCode }
			},
			{
				$lookup: {
					from: "permissions",
					localField: "permissionId",
					foreignField: "_id",
					as: "permissions"
				}
			},
			{ $unwind: "$permissions" },
			{
				$lookup: {
					from: "permissions_types",
					let: { permId: "$permissions._id" },
					pipeline: [
						{ $match: { $expr: { $eq: ["$permissionId", "$$permId"] } } }
					],
					as: "permissions.permissionTypes"
				}
			},
			{
				$project: {
					_id: 0,
					username: "$userName",
					"permissions.name": 1,
					"permissions.isAdmin": 1,
					"permissions.isActive": 1,
					"permissions.permissionTypes.type": 1,
					"permissions.permissionTypes.canView": 1,
					"permissions.permissionTypes.canCreate": 1,
					"permissions.permissionTypes.canModify": 1
				}
			}
		]);

		let permissionData = {
			name: "Viewer",
			isAdmin: false,
			isActive: true,
			canViewProjects: false,
			canCreateProjects: false,
			canModifyProjects: false,
			canViewItems: true,
			canCreateItems: false,
			canModifyItems: false
		};

		if (permission && permission.length > 0) {
			const foundPermission = permission[0];

			permissionData = {
				name: foundPermission.permissions.name || "Viewer",
				isAdmin: foundPermission.permissions.isAdmin || false,
				isActive: foundPermission.permissions.isActive || true,
				canViewProjects: false,
				canCreateProjects: false,
				canModifyProjects: false,
				canViewItems: true,
				canCreateItems: false,
				canModifyItems: false
			};

			const permissionTypes = foundPermission.permissions.permissionTypes || [];
			for (let i = 0; i < permissionTypes.length; i++) {
				if (permissionTypes[i].type === "projects") {
					permissionData["canViewProjects"] = permissionTypes[i].canView;
					permissionData["canCreateProjects"] = permissionTypes[i].canCreate;
					permissionData["canModifyProjects"] = permissionTypes[i].canModify;
				} else if (permissionTypes[i].type === "items") {
					permissionData["canViewItems"] = permissionTypes[i].canView;
					permissionData["canCreateItems"] = permissionTypes[i].canCreate;
					permissionData["canModifyItems"] = permissionTypes[i].canModify;
				}
			}
		}

		return {
			status: 1,
			message: "Permission retrieved successfully!",
			data: permissionData
		};
	} catch (err) {
		err.statusCode = 500;
		return {
			status: 0,
			message: "Permission not found!",
			data: null
		};
	}
};

module.exports = { list, statusChange, create, findOne, update, all, initPermission, getUserPermission, getUserPermissionByUsername };