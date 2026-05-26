const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const itemsOutboundsModel = require("../models/outbound_setting.model");

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

const validateOutboundInput = (body) => {
	if (!body.itemId) {
		return "Item ID not found";
	}

	if (!body.flow) {
		return "Select flow";
	}

	if (body.flow === "API" && !body.flowType) {
		return "API type is required";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const outbound = new itemsOutboundsModel({
			item_id: req.body.itemId,
			sync_type_out: req.body.flow || "",
			flowType: req.body.flowType || "",
			outbound_format: req.body.mimeType || "",
			defaultInboundMapping: req.body.defaultInboundMapping || null,
			defaultOutboundMapping: req.body.defaultOutboundMapping || null,
			defaultInboundMappingVersion : req.body.defaultInboundMappingVersion || "",
			defaultOutboundMappingVersion : req.body.defaultOutboundMappingVersion || "",
			endpoints: req.body.endpoints || [],
			globalHeaders: req.body.globalHeaders || [],
			max_file_post: req.body.maxFileDownload || "50",
			sendCollectionOnebyOne: "off",
			collections_name: "",
			disabledOutboundResponseFailuresNotice: req?.body?.disabledOutboundResponseFailuresNotice || "off",
			disabledOutboundEmailFailuresNotice: req?.body?.disabledOutboundEmailFailuresNotice || "off",
			enableLog: req?.body?.enableLog || "off",
			enableEmail : req?.body?.enableEmail || "off",
			email_endpoint_url: req?.body?.email_endpoint_url || false,
			email_log_url :  req?.body?.email_log_url || false,
			email_request_header: req?.body?.email_request_header || false,
			email_transformed_header : req?.body?.email_transformed_header || false,
			email_query_params: req?.body?.email_query_params || false,
			email_body: req?.body?.email_body || false,
			email_body_html: req?.body?.email_body_html || false,
			email_transformed_body: req?.body?.email_transformed_body || false,
			email_transformed_body_html: req?.body?.email_transformed_body_html || false,
			email_request_endpoint_url_information: req?.body?.email_request_endpoint_url_information || false,
			email_response: req?.body?.email_response || false,
			email_response_html: req?.body?.email_response_html || false,
			email_transformed_response: req?.body?.email_transformed_response || false,
			email_transformed_response_html: req?.body?.email_transformed_response_html || false,
			email_validation_message: req?.body?.email_validation_message || false,
			email_logs: req?.body?.email_logs || false,
			is_active: req?.body?.is_active || "Active",
			CompanyCode: companyCode,
			createdBy: userName,
			updateBy: userName
		});

		const createdOutbound = await outbound.save();

		return res.status(200).send({ status: 1, message: "Outbound created successfully!", id: createdOutbound._id });
	} catch (err) {
		err.statusCode = err.statusCode || 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const outbound = await itemsOutboundsModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!outbound || outbound.length === 0) {
			return res.status(200).send({ status: 0, message: "Outbound not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound retrieved successfully!", data: outbound[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateOutboundInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedOutbound = await itemsOutboundsModel.findByIdAndUpdate(
			req.params.id,
			{
				sync_type_out: req.body.flow || "",
				flowType: req.body.flowType || "",
				outbound_format: req.body.mimeType || "",
				defaultInboundMapping: req.body.defaultInboundMapping || null,
				defaultOutboundMapping: req.body.defaultOutboundMapping || null,
				defaultInboundMappingVersion : req.body.defaultInboundMappingVersion || "",
				defaultOutboundMappingVersion : req.body.defaultOutboundMappingVersion || "",
				endpoints: req.body.endpoints || [],
				globalHeaders: req.body.globalHeaders || [],
				max_file_post: req.body.maxFileDownload || "50",
				sendCollectionOnebyOne: "off",
				collections_name: "",
				disabledOutboundResponseFailuresNotice: req?.body?.disabledOutboundResponseFailuresNotice || "off",
				disabledOutboundEmailFailuresNotice: req?.body?.disabledOutboundEmailFailuresNotice || "off",
				enableLog: req?.body?.enableLog || "off",
				enableEmail : req?.body?.enableEmail || "off",
				email_endpoint_url: req?.body?.email_endpoint_url || false,
				email_log_url :  req?.body?.email_log_url || false,
				email_request_header: req?.body?.email_request_header || false,
				email_transformed_header : req?.body?.email_transformed_header || false,
				email_query_params: req?.body?.email_query_params || false,
				email_body: req?.body?.email_body || false,
				email_body_html: req?.body?.email_body_html || false,
				email_transformed_body: req?.body?.email_transformed_body || false,
				email_transformed_body_html: req?.body?.email_transformed_body_html || false,
				email_request_endpoint_url_information: req?.body?.email_request_endpoint_url_information || false,
				email_response: req?.body?.email_response || false,
				email_response_html: req?.body?.email_response_html || false,
				email_transformed_response: req?.body?.email_transformed_response || false,
				email_transformed_response_html: req?.body?.email_transformed_response_html || false,
				email_validation_message: req?.body?.email_validation_message || false,
				email_logs: req?.body?.email_logs || false,
				is_active: req?.body?.is_active || "Active",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedOutbound) {
			return res.status(404).send({ status: 0, message: "Outbound not found!" });
		}

		return res.status(200).send({ status: 1, message: "Outbound updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update };