const jwtDecode = require("jwt-decode");
const config = require("../config");
const settingsModel = require("../models/settings.model");

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

const createEmailSmtp = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const settings = new settingsModel({
			slug: "email-smtp",
			smtpServer: req.body.smtpServer,
			smtpPort: req.body.smtpPort,
			smtpProperties: req.body.smtpProperties,
			smtpEmail: req.body.smtpEmail,
			smtpAccount: req.body.smtpAccount,
			smtpPassword: req.body.smtpPassword,
			smtpAuthenticationSPA: req.body.authenticationSPA || "off",
			smtpActive: req.body.smtpActive || "0",
			createdBy: userName,
			updateBy: userName,
			companyCode: companyCode,
		});

		const createdSetting = await settings.save();

		return res.status(200).send({ status: 1, message: "Setting created successfully!", id: createdSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const data = req.body;
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		let query = process.env.EnableGima === "true" ? { companyCode } : {};
		query = { ...query, slug: req.params.slug };

		if (data.companyCode != undefined && data.companyCode != "") {
			query["companyCode"] = data.companyCode;
		}

		const setting = await settingsModel.aggregate([
			{ $match: query },
			{ $limit: 1 }
		]);

		if (!setting) {
			return res.status(404).send({ status: 0, message: "Setting not found" });
		}

		return res.status(200).send({ status: 1, message: "Setting retrieved successfully!", data: setting[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getGeneralSetting = async (companyCode, slug) => {
	try {
		const query = { companyCode, slug: slug };
		const result = await settingsModel.findOne(query).sort({ createdAt: -1 }).lean();

		if (!result) {
			return { status: 0, message: "General settings not found", data: null };
		}

		return { status: 1, message: "General settings retrieved successfully!", data: result };
	} catch (error) {
		console.error("Error while fetching general settings:", error.message);
		return { status: 0, message: "An error occurred while fetching general settings", data: null };
	}
};

const updateEmailSmtp = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const updatedSetting = await settingsModel.findByIdAndUpdate(
			req.body.data_id,
			{
				smtpServer: req.body.smtpServer,
				smtpPort: req.body.smtpPort,
				smtpProperties: req.body.smtpProperties,
				smtpEmail: req.body.smtpEmail,
				smtpAccount: req.body.smtpAccount,
				smtpPassword: req.body.smtpPassword,
				smtpAuthenticationSPA: req.body.authenticationSPA || "off",
				smtpActive: req.body.smtpActive || "0",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedSetting) {
			return res.status(404).send({ status: 0, message: "Setting not found!", data: null });
		}

		return res.status(200).send({ status: 1, message: "Setting updated successfully!", id: updatedSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const createSettings = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const settings = new settingsModel({
			slug: "general-settings",
			data: { enableLogs: req.body.enableLogs || "off", enableFullLogs: req.body.enableFullLogs || "off", disableDefaultProjectPrefix: req.body.disableDefaultProjectPrefix || "off", defaultProjectPrefix: req.body.defaultProjectPrefix || "/default", enableDiffCheck: req.body.enableDiffCheck, diffCheckReturnUrl: req.body.diffCheckReturnUrl || '' },
			createdBy: userName,
			updateBy: userName,
			companyCode: companyCode,
		});

		const createdSetting = await settings.save();

		return res.status(200).send({ status: 1, message: "Setting created successfully!", id: createdSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const updateSettings = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const updatedSetting = await settingsModel.findByIdAndUpdate(
			req.body.data_id,
			{
				data: { enableLogs: req.body.enableLogs || "off", enableFullLogs: req.body.enableFullLogs || "off", disableDefaultProjectPrefix: req.body.disableDefaultProjectPrefix || "off", defaultProjectPrefix: req.body.defaultProjectPrefix || "/default", enableDiffCheck: req.body.enableDiffCheck, diffCheckReturnUrl: req.body.diffCheckReturnUrl || '' },
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedSetting) {
			return res.status(404).send({ status: 0, message: "Setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Setting updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findSetting = async (companyCode, slug) => {
	try {
		let query = {};
		if (process.env.EnableGima === "true") {
			query.companyCode = companyCode;
		}
		if (companyCode) {
			query.companyCode = companyCode;
		}
		if (slug) {
			query.slug = slug;
		}

		const setting = await settingsModel.aggregate([
			{ $match: query },
			{ $limit: 1 }
		]);

		if (!setting || setting.length === 0) {
			return { status: 0, message: "Setting not found" };
		}

		return { status: 1, message: "Setting retrieved successfully!", data: setting[0] };
	} catch (error) {
		return { status: 0, message: "Error retrieving setting", error: error.message };
	}
};

module.exports = { createEmailSmtp, findOne, updateEmailSmtp, createSettings, updateSettings, findSetting, getGeneralSetting };