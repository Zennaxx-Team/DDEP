const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const mappingProfilesModel = require("../models/mapping_profiles.model");
const mappingProfilesHistoriesModel = require("../models/mapping_profiles_histories.model");
const itemsOutboundsModel = require("../models/outbound_setting.model");

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

const validateMappingProfileInput = (body) => {
	if (!body.mappingProfileName) {
		return "Please enter the Mapping Profile Name";
	}

	if (!body.projectId && !body.projectId === null) {
		return "Please select the Project";
	}

	if (!body.version) {
		return "Please enter the Mapping Profile Version";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await mappingProfilesModel.countDocuments(query);

		const mappingProfiles = await mappingProfilesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
			{
				$lookup: {
					from: "mapping_profiles_histories",
					let: { profileId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$mappingProfileId", "$$profileId"] },
										{ $eq: ["$isCurrentVersion", true] }
									]
								}
							}
						},
						{ $sort: { publishedAt: -1 } },
						{ $limit: 1 }
					],
					as: "currentVersion"
				}
			},
			{
				$unwind: {
					path: "$currentVersion",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$lookup: {
					from: "companies",
					localField: "currentVersion.companyId",
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
					localField: "currentVersion.projectId",
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
					isActive: 1,
					createdAt: 1,
					"currentVersion._id": 1,
					"currentVersion.name": 1,
					"currentVersion.version": 1,
					"currentVersion.description": 1,
					"currentVersion.projectId": 1,
					"currentVersion.companyId": 1,
					"projects.name": 1,
					"companies.name": 1
				}
			}
		]);

		return res.status(200).send({ status: 1, message: "Mapping profiles retrieved successfully!", data: mappingProfiles, total });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const statusChange = async (req, res, next) => {
	try {
		const updatedMappingProfile = await mappingProfilesModel.findByIdAndUpdate(
			req.params.id,
			{ isActive: req.body.isActive },
			{ new: true }
		);

		if (!updatedMappingProfile) {
			return res.status(404).send({ status: 0, message: "Mapping profile not found!" });
		}

		await mappingProfilesHistoriesModel.updateMany(
			{ mappingProfileId: req.params.id },
			{ $set: { isActive: req.body.isActive } }
		);

		return res.status(200).send({ status: 1, message: "Mapping profile status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateMappingProfileInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const mappingProfile = new mappingProfilesModel({
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdMappingProfile = await mappingProfile.save();

		const mappingProfileHistory = new mappingProfilesHistoriesModel({
			mappingProfileId: createdMappingProfile._id,
			companyId: req.body.companyId,
			projectId: req.body.projectId,
			name: req.body.mappingProfileName,
			version: req.body.version || "",
			description: req.body.mappingProfileDescription || "",
			returnUrl: req.body.returnUrl || "",
			sendCollectionOnebyOne: req.body.sendCollectionOnebyOne || false,
			collectionsName: req.body.collectionsName || "",
			filters: req.body.filters || [],
			inboundFormat: req.body.inboundFormat || "json",
			outboundFormat: req.body.outboundFormat || "json",
			inboundFormatData: req.body.inboundFormatData || "",
			outboundFormatData: req.body.outboundFormatData || "",
			mappingData: JSON.parse(req.body.mappingData) || {},
			properties: req.body.properties || [],
			isCurrentVersion: true,
			isActive: req.body.isActive,
			createdBy: userName,
			updatedBy: userName
		});

		const createdMappingProfileHistory = await mappingProfileHistory.save();

		return res.status(200).send({ status: 1, message: "Mapping profile created successfully!", id: createdMappingProfile._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const mappingProfile = await mappingProfilesModel.aggregate([
			{
				$match: { _id: new mongoose.Types.ObjectId(req.params.mappingProfileId) }
			},
			{
				$limit: 1
			},
			{
				$lookup: {
					from: "mapping_profiles_histories",
					let: { profileId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$mappingProfileId", "$$profileId"] },
										{
											$cond: {
												if: { $ne: [req.params.mappingProfileHistoryId, null] },
												then: { $eq: ["$_id", new mongoose.Types.ObjectId(req.params.mappingProfileHistoryId)] },
												else: { $eq: ["$isCurrentVersion", true] }
											}
										}
									]
								}
							}
						}
					],
					as: "currentVersion"
				}
			},
			{
				$unwind: {
					path: "$currentVersion",
					preserveNullAndEmptyArrays: true
				}
			},
			{
				$lookup: {
					from: "mapping_profiles_histories",
					let: { profileId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$mappingProfileId", "$$profileId"]
								}
							}
						},
						{
							$sort: { publishedAt: -1 }
						}
					],
					as: "histories"
				}
			},
			{
				$project: {
					_id: 1,
					isActive: 1,
					companyCode: 1,
					name: { $ifNull: ["$currentVersion.name", "$name"] },
					version: { $ifNull: ["$currentVersion.version", "$version"] },
					description: { $ifNull: ["$currentVersion.description", "$description"] },
					companyId: { $ifNull: ["$currentVersion.companyId", "$companyId"] },
					projectId: { $ifNull: ["$currentVersion.projectId", "$projectId"] },
					returnUrl: { $ifNull: ["$currentVersion.returnUrl", "$returnUrl"] },
					sendCollectionOnebyOne: { $ifNull: ["$currentVersion.sendCollectionOnebyOne", "$sendCollectionOnebyOne"] },
					collectionsName: { $ifNull: ["$currentVersion.collectionsName", "$collectionsName"] },
					filters: { $ifNull: ["$currentVersion.filters", "$filters"] },
					inboundFormat: { $ifNull: ["$currentVersion.inboundFormat", "$inboundFormat"] },
					outboundFormat: { $ifNull: ["$currentVersion.outboundFormat", "$outboundFormat"] },
					inboundFormatData: { $ifNull: ["$currentVersion.inboundFormatData", "$inboundFormatData"] },
					outboundFormatData: { $ifNull: ["$currentVersion.outboundFormatData", "$outboundFormatData"] },
					mappingData: { $ifNull: ["$currentVersion.mappingData", "$mappingData"] },
					properties: { $ifNull: ["$currentVersion.properties", "$properties"] },
					isCurrentVersion: "$currentVersion.isCurrentVersion",
					"histories._id": 1,
					"histories.version": 1,
					"histories.description": 1,
					"histories.isCurrentVersion": 1,
					"histories.createdAt": 1
				}
			}
		]);

		if (!mappingProfile || mappingProfile.length === 0) {
			return res.status(200).send({ status: 0, message: "Mapping profile not found!" });
		}

		return res.status(200).send({ status: 1, message: "Mapping profile retrieved successfully!", data: mappingProfile[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName, companyCode } = extractUserInfoFromToken(req.cookies);

		const validationError = validateMappingProfileInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		if (req.body.isNewMappingProfile) {
			const historyToSwitchTo = await mappingProfilesHistoriesModel.findOne({
				mappingProfileId: mongoose.Types.ObjectId(req.params.id),
				version: req.body.version
			});

			if (historyToSwitchTo) {
				return res.status(400).json({ status: 0, message: "This version already exists, please modify the version information!" });
			}
		}

		const updatedMappingProfile = await mappingProfilesModel.findByIdAndUpdate(
			req.params.id,
			{
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedMappingProfile) {
			return res.status(404).send({ status: 0, message: "Mapping profile not found!" });
		}

		let findLastCurrentVersion = await mappingProfilesHistoriesModel.findOne({
			mappingProfileId: mongoose.Types.ObjectId(req.params.id),
			isCurrentVersion: true
		})

		await mappingProfilesHistoriesModel.updateMany(
			{ mappingProfileId: req.params.id, isCurrentVersion: true },
			{ $set: { isCurrentVersion: false } }
		);

		const mappingProfileHistory = new mappingProfilesHistoriesModel({
			mappingProfileId: updatedMappingProfile._id,
			companyId: req.body.companyId,
			projectId: req.body.projectId,
			name: req.body.mappingProfileName,
			version: req.body.version || "",
			description: req.body.mappingProfileDescription || "",
			returnUrl: req.body.returnUrl || "",
			sendCollectionOnebyOne: req.body.sendCollectionOnebyOne || false,
			collectionsName: req.body.collectionsName || "",
			filters: req.body.filters || [],
			inboundFormat: req.body.inboundFormat || "json",
			outboundFormat: req.body.outboundFormat || "json",
			inboundFormatData: req.body.inboundFormatData || "",
			outboundFormatData: req.body.outboundFormatData || "",
			mappingData: JSON.parse(req.body.mappingData) || {},
			properties: req.body.properties || [],
			isCurrentVersion: true,
			isActive: req.body.isActive,
			createdBy: userName,
			updatedBy: userName
		});

		const createdMappingProfileHistory = await mappingProfileHistory.save();

		return res.status(200).send({ status: 1, message: "Mapping profile updated successfully!", id: (createdMappingProfileHistory._id).toString() });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const versionChange = async (req, res, next) => {
	try {
		const existingProfile = await mappingProfilesModel.findById(req.body.mappingProfileId);
		if (!existingProfile) {
			return res.status(404).json({ error: "Mapping profile not found!" });
		}

		const historyToSwitchTo = await mappingProfilesHistoriesModel.findOne({
			_id: mongoose.Types.ObjectId(req.body.mappingProfileHistoryId),
			version: req.body.version
		});

		if (!historyToSwitchTo) {
			return res.status(404).json({ error: "History version not found!" });
		}

		await mappingProfilesHistoriesModel.updateMany(
			{ mappingProfileId: req.body.mappingProfileId, isCurrentVersion: true },
			{ $set: { isCurrentVersion: false } }
		);

		historyToSwitchTo.isCurrentVersion = true;
		await historyToSwitchTo.save();

		return res.status(200).send({ status: 1, message: "Mapping profile version switched successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const mappingProfilesDatas = await mappingProfilesModel.aggregate([
			{ $match: query },
			{
				$lookup: {
					from: "mapping_profiles_histories",
					let: { profileId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$eq: ["$mappingProfileId", "$$profileId"]
								},
							},
						},
						{
							$sort: { publishedAt: -1 }
						},
					],
					as: "histories"
				},
			},
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({ status: 1, message: "Mapping profiles retrieved successfully!", data: mappingProfilesDatas });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const allProjectMappingProfile = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { projectId, companyId } = req.body;
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const matchExpr = {
			$and: [{ $eq: ["$mappingProfileId", "$$profileId"] }]
		};

		if (companyId && companyId !== "all") {
			matchExpr.$and.push({
				$eq: ["$companyId", mongoose.Types.ObjectId(companyId)]
			});
		} else if (!companyId) {
			matchExpr.$and.push({
				$eq: ["$companyId", null]
			});
		}

		if (projectId && projectId !== "all") {
			matchExpr.$and.push({
				$eq: ["$projectId", mongoose.Types.ObjectId(projectId)]
			});
		} else if (!projectId) {
			matchExpr.$and.push({
				$eq: ["$projectId", null]
			});
		}

		const mappingProfilesDatas = await mappingProfilesModel.aggregate([
			{ $match: query },
			{
				$lookup: {
					from: "mapping_profiles_histories",
					let: {
						profileId: "$_id"
					},
					pipeline: [
						{
							$match: {
								$expr: matchExpr
							}
						},
						{ $sort: { publishedAt: -1 } }
					],
					as: "histories"
				}
			},
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({
			status: 1,
			message: "Mapping profiles retrieved successfully!",
			data: mappingProfilesDatas
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findMappingProfileHistoryById = async (mappingProfileId, version, ProjectId) => {
	try {
		const projectId = mongoose.Types.ObjectId.isValid(ProjectId)
			? new mongoose.Types.ObjectId(ProjectId)
			: ProjectId || null;
		const mappingProfileHistory = await mappingProfilesHistoriesModel.aggregate([
			{
				$match: { mappingProfileId: new mongoose.Types.ObjectId(mappingProfileId), version: version, projectId: projectId }
			},
			{
				$sort: { updatedAt: -1 }
			},
			{
				$limit: 1
			}
		]);

		if (!mappingProfileHistory || mappingProfileHistory.length === 0) {
			return { status: 0, message: "Mapping profile not found!" };
		}

		return { status: 1, message: "Mapping profile retrieved successfully!", data: mappingProfileHistory[0] };
	} catch (err) {
		return { status: 0, message: err.message };
	}
};

const getMappingProfileHistoryId = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { mappingProfileId, version } = req.body;
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const mappingProfileHistory = await mappingProfilesHistoriesModel.aggregate([
			{
				$match: { mappingProfileId: new mongoose.Types.ObjectId(mappingProfileId), version: version }
			},
			{
				$sort: { updatedAt: -1 }
			},
			{
				$limit: 1
			}
		]);

		if (!mappingProfileHistory || mappingProfileHistory.length === 0) {
			return { status: 0, message: "Mapping profile not found!" };
		}

		return res.status(200).send({ status: 1, message: "Mapping profiles retrieved successfully!", data: mappingProfileHistory[0] });
	} catch (err) {
		return { status: 0, message: err.message };
	}
};

module.exports = { list, statusChange, create, findOne, update, versionChange, all, allProjectMappingProfile, findMappingProfileHistoryById, getMappingProfileHistoryId };