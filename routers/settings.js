const EnableGimaEnv = process.env.EnableGima;
const express = require("express");
const router = express.Router();
const request = require("request");
const nodemailer = require("nodemailer");
const config = require("../config");
const settings = require("../controllers/settings.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

router.post("/save-general-settings", settings.createSettings);

router.post("/update-general-settings", checkCompanyCode, settings.updateSettings);

router.post("/save-email-smtp", settings.createEmailSmtp);

router.post("/update-email-smtp", checkCompanyCode, settings.updateEmailSmtp);

router.post("/edit/:slug", settings.findOne);

router.post("/test-email-smtp", function (req, res) {
	const data = req.body;

	let smtpSecure = false;
	if (data.smtpPort == 465) {
		smtpSecure = true;
	}

	const transporter = nodemailer.createTransport({
		host: data.smtpServer,
		port: data.smtpPort,
		secure: smtpSecure, // true for 465, false for other ports
		auth: {
			user: data.smtpAccount,
			pass: data.smtpPassword,
		},
	});

	const mailConfigurations = {
		from: "DDEP Email testing <" + data.smtpEmail + ">",
		to: data.testEmail,
		subject: data.testSubject,
		text: data.testContent,
		html: "<b>" + data.testContent + "</b>",
	};

	transporter.sendMail(mailConfigurations, function(error, info) {
		if (error) {
			return res.status(200).send({status: 0, message: "Error while sending mail : " + error});
		} else {
			return res.status(200).send({status: 1, messageId: info.messageId, message: "Test mail has been sent successfully"});
		}
	});
});

router.get("/", checkAuthorization, (req, res) => {
	let data = {};
	if (EnableGimaEnv == "true") {
		data["companyCode"] = config.companyCode;
	}

	request({"method": "POST",
		"url": config.domain + "/settings/edit/general-settings",
		"headers": {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(data),
	}, function (error, response, body) {
		const data = JSON.parse(body);
		if (response.statusCode == 200) {
			res.render("settings", {alldata: data.data, ddepVersion: config.ddepVersion, companyCode: config.companyCode, isProject: true});
		} else {
			return res.send(data.message);
		}
	});
});

router.get("/smtp", checkAuthorization, (req, res) => {
	let data = {};
	if (EnableGimaEnv == "true") {
		data["companyCode"] = config.companyCode;
	}

	request({
		"method": "POST",
		"url": config.domain + "/settings/edit/email-smtp",
		"headers": {
			"Content-Type": "application/json"
		},
		body: JSON.stringify(data),
	}, function (error, response, body) {
		const data = JSON.parse(body);
		if (response.statusCode == 200) {
			res.render("email-smtp", {alldata: data.data, ddepVersion: config.ddepVersion, companyCode: config.companyCode, isProject: true});
		} else {
			return res.send(data.message);
		}
	});
});

module.exports = router;
