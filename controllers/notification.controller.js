const jwtDecode = require("jwt-decode");
const config = require("../config");
const notificationModel = require("../models/notification.model");

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

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const notification = new notificationModel({
			slug: "notification",
			providerName: req.body.providerName,
			email: req.body.email,
			email_failures_return_url: req.body.email_failures_return_url || "",
			response_failures_return_url: req.body.response_failures_return_url || "",
			isInboundFtpSuccess: req.body.isInboundFtpSuccess || "off",
			isInboundFtpFail: req.body.isInboundFtpFail || "off",
			isOutboundFtpSuccess: req.body.isOutboundFtpSuccess || "off",
			isOutboundFtpFail: req.body.isOutboundFtpFail || "off",
			isInboundDdepApiSuccess: req.body.isInboundDdepApiSuccess || "off",
			isInboundDdepApiFail: req.body.isInboundDdepApiFail || "off",
			isOutboundDdepApiSuccess: req.body.isOutboundDdepApiSuccess || "off",
			isOutboundDdepApiFail: req.body.isOutboundDdepApiFail || "off",
			createdBy: userName,
			updateBy: userName,
			companyCode: companyCode,
		});

		const createdNotification = await notification.save();

		return res.status(200).send({ status: 1, message: "Notification created successfully!", id: createdNotification._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const data = req.body;
		let query = {};
		query = { ...query, slug: req.params.slug };

		if (data.companyCode != undefined && data.companyCode != "") {
			query["companyCode"] = data.companyCode;
		}

		const notification = await notificationModel.aggregate([
			{ $match: query },
			{ $limit: 1 }
		]);

		if (!notification) {
			return res.status(404).send({ status: 0, message: "Notification not found" });
		}

		return res.status(200).send({ status: 1, message: "Notification retrieved successfully!", data: notification[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const getNotificationSettings = async (companyCode, slug) => {
	try {
		const query = { slug };
		if (companyCode) {
			query.companyCode = companyCode;
		}

		const result = await notificationModel.aggregate([
			{ $match: query },
			{ $limit: 1 }
		]);

		if (!result || result.length === 0) {
			return { status: 0, message: "Notification not found" };
		}

		return {
			status: 1,
			message: "Notification retrieved successfully!",
			data: result[0]
		};
	} catch (err) {
		console.error("Error in getNotificationSettings:", err);
		return {
			status: 0,
			message: "Error retrieving notification",
			error: err.message || err
		};
	}
};


const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const updatedNotification = await notificationModel.findByIdAndUpdate(
			req.body.data_id,
			{
				providerName: req.body.providerName,
				email: req.body.email,
				email_failures_return_url: req.body.email_failures_return_url || "",
				response_failures_return_url: req.body.response_failures_return_url || "",
				isInboundFtpSuccess: req.body.isInboundFtpSuccess || "off",
				isInboundFtpFail: req.body.isInboundFtpFail || "off",
				isOutboundFtpSuccess: req.body.isOutboundFtpSuccess || "off",
				isOutboundFtpFail: req.body.isOutboundFtpFail || "off",
				isInboundDdepApiSuccess: req.body.isInboundDdepApiSuccess || "off",
				isInboundDdepApiFail: req.body.isInboundDdepApiFail || "off",
				isOutboundDdepApiSuccess: req.body.isOutboundDdepApiSuccess || "off",
				isOutboundDdepApiFail: req.body.isOutboundDdepApiFail || "off",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedNotification) {
			return res.status(404).send({ status: 0, message: "Notification not found!" });
		}

		return res.status(200).send({ status: 1, message: "Notification updated successfully!", id: updatedNotification._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findOne, update, getNotificationSettings };