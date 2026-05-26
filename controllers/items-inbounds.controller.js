const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const itemsInboundsModel = require("../models/inbound_setting.model");
const ase = require("../my_modules/aes");

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

const validateInboundInput = (body) => {
	if (!body.itemId) {
		return "Item ID not found";
	}

	if (!body.platform) {
		return "Select syncronize type";
	}

	if (body.platform === "API" && !body.platformApiType) {
		return "API type is required";
	}

	if (body.platform === "API" && body.platformApiType != undefined && body.platformApiType === "DDEP_API" && !body.ddepApiEndpoint) {
		return "DDEP API URL is required";
	} else if (body.platform === "API" && body.platformApiType != undefined && body.platformApiType === "DDEP_API" && body.ddepApiEndpoint) {
		const re = new RegExp(/^(\/)[a-zA-Z0-9-_\/]+$/);

		if (!re.test(body.ddepApiEndpoint)) {
			return "DDEP API is not valid (must start with a '/' and must contain any letter, capitalize letter, number, dash or underscore)";
		}
	}

	if (body.platform === "API" && body.platformApiType != undefined && body.platformApiType === "User_API" && !body.userApi) {
		return "User API URL is required";
	}

	if ((body.platform === "FTP" || body.platform === "SFTP") && !body.ftpServerLink) {
		return "FTP URL is required";
	}

	if ((body.platform === "FTP" || body.platform === "SFTP") && !body.port) {
		return "Port number is required";
	}

	if ((body.platform === "FTP" || body.platform === "SFTP") && !body.loginName) {
		return "Login name is required";
	}

	if ((body.platform === "FTP" || body.platform === "SFTP") && !body.password) {
		return "Password is required";
	}

	if ((body.platform === "FTP" || body.platform === "SFTP") && !body.folder) {
		return "Folder path is required";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const Aes = new ase();
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const inbound = new itemsInboundsModel({
			item_id: req.body.itemId,
			inbound_format: req.body.mimeType || "",
			urlPrefix: req.body.urlPrefix || "",
			sync_type: req.body.platform || "",
			api_type: req.body.platformApiType || "",
			api_ddep_api: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" ? req.body.ddepApiEndpoint : null,
			api_user_api: req.body.platform === "API" && req.body.platformApiType === "User_API" ? req.body.userApi : null,
			ddep_api_auth_type: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" ? req.body.ddepApiAuthType || "No_Auth" : "No_Auth",
			ddep_api_authorization_api_keys: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" && req.body.ddepApiAuthorizationApiKeys ? JSON.parse(req.body.ddepApiAuthorizationApiKeys) : null,
			ftp_server_link: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.ftpServerLink : null,
			ftp_port: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.port : null,
			ftp_login_name: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.loginName : null,
			ftp_password: ["FTP", "SFTP"].includes(req.body.platform) ? (req.body.password) ? Aes.Encrypt(req.body.password) : "" : null,
			ftp_folder: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.folder : null,
			ftp_backup_folder: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.backupFolder : null,
			max_file_download: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.maxFileDownload || "50" : "50",
			disabledInboundEmailFailuresNotice: req?.body?.disabledInboundEmailFailuresNotice || "off",
			enableLog: req?.body?.enableLog || "off",
			enableEmail: req?.body?.enableEmail || "off",
			email_endpoint_url: req?.body?.email_endpoint_url || false,
			email_log_url: req?.body?.email_log_url || false,
			email_request_header: req?.body?.email_request_header || false,
			email_query_params: req?.body?.email_query_params || false,
			email_body: req?.body?.email_body || false,
			email_body_html: req?.body?.email_body_html || false,
			email_validation_message: req?.body?.email_validation_message || false,
			email_logs: req?.body?.email_logs || false,
			is_active: req?.body?.is_active || "Active",
			CompanyCode: companyCode,
			createdBy: userName,
			updateBy: userName
		});

		const createdInbound = await inbound.save();

		return res.status(200).send({ status: 1, message: "Inbound created successfully!", id: createdInbound._id });
	} catch (err) {
		err.statusCode = err.statusCode || 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const Aes = new ase();
		
		const inbound = await itemsInboundsModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!inbound || inbound.length === 0) {
			return res.status(200).send({ status: 0, message: "Inbound not found!" });
		}

		const result = inbound[0];

		// Decrypt ftp_password if exists
		if (["FTP", "SFTP"].includes(result.sync_type) && result.ftp_password) {
			result.ftp_password = Aes.Decrypt(result.ftp_password);
		}

		return res.status(200).send({ status: 1, message: "Inbound retrieved successfully!", data: result });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const Aes = new ase();
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateInboundInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedInbound = await itemsInboundsModel.findByIdAndUpdate(
			req.params.id,
			{
				inbound_format: req.body.mimeType || "",
				urlPrefix: req.body.urlPrefix || "",
				sync_type: req.body.platform || "",
				api_type: req.body.platformApiType || "",
				api_ddep_api: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" ? req.body.ddepApiEndpoint : null,
				api_user_api: req.body.platform === "API" && req.body.platformApiType === "User_API" ? req.body.userApi : null,
				ddep_api_auth_type: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" ? req.body.ddepApiAuthType || "No_Auth" : "No_Auth",
				ddep_api_authorization_api_keys: req.body.platform === "API" && req.body.platformApiType === "DDEP_API" && req.body.ddepApiAuthorizationApiKeys ? JSON.parse(req.body.ddepApiAuthorizationApiKeys) : null,
				ftp_server_link: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.ftpServerLink : null,
				ftp_port: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.port : null,
				ftp_login_name: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.loginName : null,
				ftp_password: ["FTP", "SFTP"].includes(req.body.platform) ? (req.body.password) ? Aes.Encrypt(req.body.password) : "" : null,
				ftp_folder: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.folder : null,
				ftp_backup_folder: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.backupFolder : null,
				max_file_download: ["FTP", "SFTP"].includes(req.body.platform) ? req.body.maxFileDownload || "50" : "50",
				disabledInboundEmailFailuresNotice: req?.body?.disabledInboundEmailFailuresNotice || "off",
				enableLog: req?.body?.enableLog || "off",
				enableEmail: req?.body?.enableEmail || "off",
				email_endpoint_url: req?.body?.email_endpoint_url || false,
				email_log_url: req?.body?.email_log_url || false,
				email_request_header: req?.body?.email_request_header || false,
				email_query_params: req?.body?.email_query_params || false,
				email_body: req?.body?.email_body || false,
				email_body_html: req?.body?.email_body_html || false,
				email_validation_message: req?.body?.email_validation_message || false,
				email_logs: req?.body?.email_logs || false,
				is_active: req?.body?.is_active || "Active",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedInbound) {
			return res.status(404).send({ status: 0, message: "Inbound not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const checkCodeExist = async (req, res, next) => {
	try {
		const { companyCode } = extractUserInfoFromToken(req.cookies);
		const inbounds = await itemsInboundsModel.find({ urlPrefix: req.body.urlPrefix, api_ddep_api: req.body.ddepApiEndpoint, CompanyCode: companyCode });

		if (inbounds.length > 0) {
			const isExist = inbounds.some(inbound => inbound.item_id.toString() !== req.body.itemId);

			if (isExist) {
				return res.status(200).send({ status: 0, message: "DDEP endpoint already exists!" });
			} else {
				return res.status(200).send({ status: 1, message: "DDEP endpoint does not exist!" });
			}
		} else {
			return res.status(200).send({ status: 1, message: "DDEP endpoint does not exist!" });
		}
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const searchItemByDdepInput = async (req, res, next) => {
	try {
		let query = process.env.EnableGima === "true" ? { CompanyCode: req.body.CompanyCode } : {};
		query = { ...query, api_ddep_api: new RegExp(req.body.ddepInput + ".*") };

		const inboundSetting = await itemsInboundsModel.find(query);

		if (!inboundSetting || inboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOneByDdepInput = async (req, res, next) => {
	try {
		let query = process.env.EnableGima === "true" ? { CompanyCode: req.body.CompanyCode } : {};
		query = { ...query, api_ddep_api: req.body.ddepInput, urlPrefix: req.body.urlPrefix };

		const inboundSetting = await itemsInboundsModel.findOne(query);

		if (!inboundSetting || inboundSetting.length === 0) {
			return res.status(404).send({ status: 0, message: "Inbound setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const chcekDdepPathUrlPrefix = async (CompanyCode, urlPrefix) => {
	try {
		let query = { CompanyCode: CompanyCode }
		query = { ...query, urlPrefix: urlPrefix };
		const inboundSetting = await itemsInboundsModel.findOne(query);
		if (!inboundSetting || inboundSetting.length === 0) {
			return { status: 0, message: "Inbound setting not found!" }
		}

		return { status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting }
	} catch (err) {
		err.statusCode = 500;
		return { status: 0, message: "Inbound setting not found!" }
	}
}

const chcekDdepPathWithUrlPrefix = async (CompanyCode, urlPrefix, api_ddep_api) => {
	try {
		let query = { CompanyCode: CompanyCode }
		query = { ...query, urlPrefix: urlPrefix, api_ddep_api: api_ddep_api };

		const inboundSetting = await itemsInboundsModel.find({
			CompanyCode: CompanyCode
		});

		const matched = inboundSetting.filter(item =>
			api_ddep_api.startsWith(item.api_ddep_api) && urlPrefix.startsWith(item.urlPrefix))

		if (matched.length === 0) {
			return { statusCode: 404, status: 0, message: "Inbound setting not found!" };
		}

		return { status: 1, message: "Inbound setting retrieved successfully!", data: matched }
	} catch (err) {
		err.statusCode = 500;
		return { status: 0, message: "Inbound setting not found!" }
	}
}

const inboundsEditddepAPI = async (ddepInput, CompanyCode, urlPrefix) => {
	try {
		let query = { CompanyCode: CompanyCode }
		query = { ...query, api_ddep_api: ddepInput, urlPrefix: urlPrefix };

		const inboundSetting = await itemsInboundsModel.findOne(query);

		if (!inboundSetting || inboundSetting.length === 0) {
			return { statusCode: 404, status: 0, message: "Inbound setting not found!" }
		}
		return { statusCode: 200, status: 1, message: "Inbound setting retrieved successfully!", data: inboundSetting }
	} catch (err) {
		err.statusCode = 500;
		return { statusCode: 500, status: 0, message: "Inbound setting not found!", error: err }
	}
}

const inboundsDdepInputAPI = async (ddepInput, CompanyCode) => {
	try {
		let query = { CompanyCode: CompanyCode };
		query = { ...query, api_ddep_api: new RegExp(ddepInput + ".*") };

		const inboundSetting = await itemsInboundsModel.find({
			CompanyCode: CompanyCode
		});

		const matched = inboundSetting.filter(item =>
			ddepInput.startsWith(item.api_ddep_api)
		);

		if (matched.length === 0) {
			return { statusCode: 404, status: 0, message: "Inbound setting not found!" };
		}

		return { statusCode: 200, status: 1, message: "Inbound setting retrieved successfully!", data: matched }
	} catch (err) {
		err.statusCode = 500;
		return { statusCode: 500, status: 0, message: "Inbound setting not found!", error: err }
	}
}

module.exports = { create, findOne, update, checkCodeExist, searchItemByDdepInput, findOneByDdepInput, chcekDdepPathWithUrlPrefix, chcekDdepPathUrlPrefix, inboundsEditddepAPI, inboundsDdepInputAPI };