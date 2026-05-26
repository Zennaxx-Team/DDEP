const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const partiesModel = require("../models/parties.model");
const partiesEnvironmentsModel = require("../models/parties_environments.model");

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

const validatePartyInput = (body) => {
	if (!body.companyId) {
		return "Please select the Company";
	}

	if (!body.projectId && !body.projectId === null) {
		return "Please select the Project";
	}

	if (!body.partyName) {
		return "Please enter the Party Name";
	}

	return null;
};

const list = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode } : {};
		const limitRecord = Math.max(parseInt(req.body.limit) || 10, 0);
		const skipRecord = Math.max((parseInt(req.body.page) - 1) * limitRecord, 0);

		const total = await partiesModel.countDocuments(query);
		const parties = await partiesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{ $skip: skipRecord },
			{ $limit: limitRecord },
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

		return res.status(200).send({ status: 1, message: "Parties retrieved successfully!", data: parties, total });
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

		// Find and update the party
		const updatedParty = await partiesModel.findByIdAndUpdate(
			id,
			{ isActive: isActive },
			{ new: true }
		);

		// Handle case where the party is not found
		if (!updatedParty) {
			return res.status(404).send({ status: 0, message: "Party not found!" });
		}

		// Successfully updated
		return res.status(200).send({ status: 1, message: "Party status updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		// Pass error to next middleware for centralized error handling
		next(err);
	}
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validatePartyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const party = new partiesModel({
			companyId: req.body.companyId,
			projectId: req.body.projectId,
			name: req.body.partyName,
			description: req.body.partyDescription,
			sequence: req.body.sequence,
			isActive: req.body.isActive,
			companyCode,
			createdBy: userName,
			updatedBy: userName
		});

		const createdParty = await party.save();

		if (Array.isArray(req.body.environments) && req.body.environments.length > 0) {
			const partyEnvironmentsPromises = req.body.environments.map(environment => {
				return new partiesEnvironmentsModel({
					partyId: createdParty._id,
					environmentId: environment.environmentId,
					domainPrefix: environment.domainPrefix,
					domain: environment.domain,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});
			await Promise.all(partyEnvironmentsPromises);
		}

		return res.status(200).send({ status: 1, message: "Party created successfully!", id: createdParty._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const party = await partiesModel.aggregate([
			{ $match: { _id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 },
			{
				$lookup: {
					from: "parties_environments",
					let: { partyId: "$_id" },
					pipeline: [
						{ $match: { $expr: { $eq: ["$partyId", "$$partyId"] } } },
						{
							$lookup: {
								from: "environments",
								localField: "environmentId",
								foreignField: "_id",
								as: "env"
							}
						},
						{ $unwind: { path: "$env", preserveNullAndEmptyArrays: true } },
						{
							$addFields: {
								environment: "$env.name"
							}
						},
						{ $project: { env: 0 } }
					],
					as: "environments"
				}
			}
		]);

		if (!party || party.length === 0) {
			return res.status(404).send({ status: 0, message: "Party not found!" });
		}

		return res.status(200).send({
			status: 1,
			message: "Party retrieved successfully!",
			data: party[0]
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validatePartyInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedParty = await partiesModel.findByIdAndUpdate(
			req.params.id,
			{
				companyId: req.body.companyId,
				projectId: req.body.projectId,
				name: req.body.partyName,
				description: req.body.partyDescription,
				sequence: req.body.sequence,
				isActive: req.body.isActive,
				updatedBy: userName
			},
			{ new: true }
		);

		if (!updatedParty) {
			return res.status(404).send({ status: 0, message: "Party not found!" });
		}

		const existingEnvironments = await partiesEnvironmentsModel.find({ partyId: req.params.id });
		const existingEnvironmentIds = existingEnvironments.map(p => p._id.toString());

		const environmentsToAdd = req.body.environments.filter(p => !p._id || !existingEnvironmentIds.includes(p._id));
		const environmentsToUpdate = req.body.environments.filter(p => p._id && existingEnvironmentIds.includes(p._id));
		const environmentsToDelete = existingEnvironments.filter(p => !req.body.environments.some(ip => ip._id === p._id.toString()));

		if (environmentsToAdd.length > 0) {
			const partyEnvironmentsPromises = environmentsToAdd.map(environment => {
				return new partiesEnvironmentsModel({
					partyId: req.params.id,
					environmentId: environment.environmentId,
					domainPrefix: environment.domainPrefix,
					domain: environment.domain,
					createdBy: userName,
					updatedBy: userName
				}).save();
			});

			await Promise.all(partyEnvironmentsPromises);
		}

		if (environmentsToUpdate.length > 0) {
			const updatePromises = environmentsToUpdate.map(environment => {
				return partiesEnvironmentsModel.findByIdAndUpdate(environment._id, {
					environmentId: environment.environmentId,
					domainPrefix: environment.domainPrefix,
					domain: environment.domain,
					updatedBy: userName
				});
			});

			await Promise.all(updatePromises);
		}

		if (environmentsToDelete.length > 0) {
			const deletePromises = environmentsToDelete.map(environment => {
				return partiesEnvironmentsModel.findByIdAndDelete(environment._id);
			});

			await Promise.all(deletePromises);
		}

		return res.status(200).send({ status: 1, message: "Party updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const all = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const query = process.env.EnableGima === "true" ? { companyCode, isActive: true } : { isActive: true };

		const parties = await partiesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } }
		]);

		return res.status(200).send({ status: 1, message: "Parties retrieved successfully!", data: parties });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const allProjectParties = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { projectId, environmentId } = req.body;
		// const query = process.env.EnableGima === "true" ? { companyCode, projectId: mongoose.Types.ObjectId(projectId), isActive: true } : { projectId: mongoose.Types.ObjectId(projectId), isActive: true };

		const query = { isActive: true };
		if (process.env.EnableGima === "true") { query.companyCode = companyCode; }
		if (projectId) { query.projectId = mongoose.Types.ObjectId(projectId); } else { query.projectId = null; }

		const parties = await partiesModel.aggregate([
			{ $match: query },
			{ $sort: { sequence: 1, createdAt: 1 } },
			{
				$lookup: {
					from: "parties_environments",
					let: { partyId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$partyId", "$$partyId"] },
										{ $eq: ["$environmentId", mongoose.Types.ObjectId(environmentId)] }
									]
								}
							}
						}
					],
					as: "environments"
				}
			},
			{ $match: { "environments.0": { $exists: true } } }
		]);

		return res.status(200).send({ status: 1, message: "Parties retrieved successfully!", data: parties });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findPartyById = async (partyId, environmentId) => {
	try {
		const query = { _id: mongoose.Types.ObjectId(partyId) };

		const parties = await partiesModel.aggregate([
			{ $match: query },
			{ $sort: { createdAt: -1 } },
			{
				$lookup: {
					from: "parties_environments",
					let: { partyId: "$_id" },
					pipeline: [
						{
							$match: {
								$expr: {
									$and: [
										{ $eq: ["$partyId", "$$partyId"] },
										{ $eq: ["$environmentId", mongoose.Types.ObjectId(environmentId)] }
									]
								}
							}
						}
					],
					as: "environments"
				}
			},
			{ $match: { "environments.0": { $exists: true } } }
		]);

		return { status: 1, message: "Parties retrieved successfully!", data: parties[0] };
	} catch (err) {
		return { status: 0, message: err.message };
	}
}

module.exports = { list, statusChange, create, findOne, update, all, allProjectParties, findPartyById };