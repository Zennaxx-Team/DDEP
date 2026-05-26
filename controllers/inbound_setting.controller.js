const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const ase = require("../my_modules/aes");
const inboundSettingModel = require("../models/inbound_setting.model");

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

const validateInboundSettingInput = (body) => {
	const api_type = body.api_type.split(",");
	if (!body.item_id) {
		return "Item ID not found";
	}

	if (!body.inbound_format) {
		return "Inbound format is required";
	}

	if (!body.sync_type) {
		return "Select syncronize type";
	}

	if ((body.sync_type == "FTP" || body.sync_type == "FTP") && !body.ftp_server_link) {
		return "FTP URL is required";
	}

	if ((body.sync_type == "FTP" || body.sync_type == "FTP") && !body.port) {
		return "Port number is required";
	}

	if ((body.sync_type == "FTP" || body.sync_type == "FTP") && !body.login_name) {
		return "Login name is required";
	}

	if ((body.sync_type == "FTP" || body.sync_type == "FTP") && !body.password) {
		return "Password is required";
	}

	if ((body.sync_type == "FTP" || body.sync_type == "FTP") && !body.folder) {
		return "Folder path is required";
	}

	if (body.sync_type == "API" && (api_type[0] == undefined || api_type[0] == "")) {
		return "API type is required";
	}

	if (((body.sync_type == "API" && api_type[0] != undefined && api_type[0] == "DDEP_API") || (body.sync_type == "API" && api_type[1] != undefined && api_type[1] == "DDEP_API")) && body.api_ddep_api == "") {
		return "DDEP API URL is required";
	}

	if (((body.sync_type == "API" && api_type[0] != undefined && api_type[0] == "DDEP_API") || (body.sync_type == "API" && api_type[1] != undefined && api_type[1] == "DDEP_API")) && body.api_ddep_api != "") {
		const re = new RegExp(/^(\/)[a-zA-Z0-9-_\/]+$/);

		if (!re.test(body.api_ddep_api)) {
			return "DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)";
		}
	}

	if (body.sync_type == "API" && api_type[0] != undefined && api_type[0] == "User_API" && body.api_user_api == "") {
		return "User API URL is required";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const Aes = new ase();
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const inboundSetting = new inboundSettingModel({
			item_id: req.body.item_id,
			inbound_format: req.body.inbound_format,
			sync_type: req.body.sync_type || "",
			ftp_server_link: req.body.ftp_server_link || "",
			ftp_port: req.body.port || "",
			ftp_login_name: req.body.login_name || "",
			ftp_password: (data.password) ? await Aes.Encrypt(data.password) : "",
			ftp_folder: req.body.folder || "",
			ftp_backup_folder: req.body.backup_folder || "",
			api_type: req.body.api_type || "",
			api_user_api: req.body.api_user_api || "",
			api_ddep_api: req.body.api_ddep_api || "",
			createdBy: userName,
			updateBy: userName,
			is_active: req.body.is_active || "Active",
			ddep_api_auth_type: req.body.ddep_api_auth_type || "",
			ddep_api_authorization_api_keys: req.body.ddep_api_authorization_api_keys || "",
			max_file_download: req.body.max_file_download || "50",
			enableLog: req.body.enableLog || "off",
			CompanyCode: companyCode
		});

		const createdInboundSetting = await inboundSetting.save();

		return res.status(200).send({ status: 1, message: "Inbound setting created successfully!", id: createdInboundSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAll = async (req, res, next) => {
	try {
		const inboundSetting = await inboundSettingModel.find();

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const searchItemByDdepInput = async (req, res, next) => {
	try {
		let query = process.env.EnableGima === "true" ? { CompanyCode: req.body.CompanyCode } : {};
		query = { ...query, api_ddep_api: new RegExp(req.body.ddepInput + ".*") };

		const inboundSetting = await inboundSettingModel.find(query);

		if (!inboundSetting || inboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const inboundSetting = await inboundSettingModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!inboundSetting || inboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOneByDdepInput = async (req, res, next) => {
	try {
		let query = process.env.EnableGima === "true" ? { CompanyCode: req.body.CompanyCode } : {};
		query = { ...query, api_ddep_api: req.body.ddepInput };

		const inboundSetting = await inboundSettingModel.findOne(query);

		if (!inboundSetting || inboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const Aes = new ase();
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		let data = {
			item_id: req.body.item_id,
			inbound_format: req.body.inbound_format,
			sync_type: req.body.sync_type,
			ftp_server_link: req.body.ftp_server_link || "",
			ftp_port: req.body.port,
			ftp_login_name: req.body.login_name,
			ftp_folder: req.body.folder,
			ftp_backup_folder: req.body.backup_folder || "",
			is_active: req.body.is_active || "Active",
			api_type: req.body.api_type,
			api_user_api: req.body.api_user_api || "",
			updateBy: userName,
			ddep_api_auth_type: req.body.ddep_api_auth_type || "",
			ddep_api_authorization_api_keys: req.body.ddep_api_authorization_api_keys || "",
			max_file_download: req.body.max_file_download || "50",
			enableLog: req.body.enableLog || "off"
		};

		if (req.body.password != "") {
			data.ftp_password = await Aes.Encrypt(req.body.password);
		}

		if (req.body.api_ddep_api != "") {
			data.api_ddep_api = req.body.api_ddep_api;
		}

		const updatedInboundSetting = await inboundSettingModel.findByIdAndUpdate(
			req.params.id,
			data,
			{ new: true }
		);

		if (!updatedInboundSetting) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting created successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkddepinputexist = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const { api_ddep_api, item_id } = req.body;

		const inboundSetting = await inboundSettingModel.find({ api_ddep_api, CompanyCode: companyCode });

		if (inboundSetting.length > 0) {
			const isTrue = inboundSetting.every(inbound => inbound.item_id === item_id);

			return res.status(200).send(isTrue ? "true" : "false");
		} else {
			return res.status(200).send("true");
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, searchItemByDdepInput, findOne, findOneByDdepInput, update, checkddepinputexist };