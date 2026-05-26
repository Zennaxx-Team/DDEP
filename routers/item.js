const EnableGimaEnv = process.env.EnableGima;
const express = require("express");
const request = require("request");
const fs = require("fs");
const router = express.Router();
const bodyParser = require("body-parser");
const path = require("path");
const { json } = require("body-parser");
const jwtDecode = require("jwt-decode");
const ase = require("../my_modules/aes");
const config = require("../config");
const items = require("../controllers/item.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

router.post("/save", items.create);

router.put("/project-update/:id", checkCompanyCode, items.update);

router.post("/checkcodeexist", items.checkecodexsit);

router.post("/companyFullItemList", items.companyFullItemList);

router.get("/fulllist", items.fullItem);

router.get("/fulllistItem/:id", items.fulllistItem);

router.post("/fulllistItemDdepInput", items.fulllistItemDdepInput);

router.get("/editAPI/:id", items.findOne);

router.get("/add", checkAuthorization, (req, res) => {
	const ddep_api_prefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;

	let headerData = {};
	const headerJs = [
		"/assets/js/go.js"
	];

	headerData["js"] = headerJs;
	headerData["companyCode"] = config.companyCode;

	let footerData = {};
	const footerJs = [
		"/app-assets/js/scripts/mapping-gojs.js",
		"/app-assets/js/scripts/mapping-outbound-gojs.js",
		"/app-assets/js/scripts/forms/form-wizard.js"
	];

	footerData["js"] = footerJs;

	res.render("pages/add-projects", {api_prefix: ddep_api_prefix, companyCode: config.companyCode, headerData: headerData, footerData: footerData});
});

router.get("/project-list", checkAuthorization, (req, res) => {
	const inCookies = req.cookies;
	if (inCookies != undefined && inCookies.Token != undefined) {
		const decoded = jwtDecode(inCookies.Token);
		config.userName = decoded.username;
		config.companyCode = decoded.company_code;
	}

	let headerData = {};
	const headerJs = [];

	headerData["js"] = headerJs;
	headerData["companyCode"] = config.companyCode;

	let footerData = {};
	const js = [
		"/app-assets/js/item.js"
	];

	footerData["js"] = js;

	res.render("pages/list-project", {alldata: null, companyCode: config.companyCode, headerData: headerData, footerData: footerData});
});

router.post("/project-list", checkAuthorization, (req, res) => {
	const Aes = new ase();
	const inFields = req.body;
	const inCookies = req.cookies;
	const inParam = req.query;
	let access_token = "";

	if (inFields.access_token != undefined) {
		access_token = inFields.access_token;
	} else if (inCookies.Token != undefined) {
		access_token = inCookies.Token;
	} else if (inParam.access_token != undefined) {
		access_token = inParam.access_token;
	}

	if (access_token != undefined && access_token != "") {
		const tokenData = Aes.DecryptECB(access_token);
		if (tokenData != "") {
			const tokenDataToArr = tokenData.toString().split(",");
			config.userName = tokenDataToArr[1];
			config.companyCode = tokenDataToArr[tokenDataToArr.length - 2];
		}
	}

	let headerData = {};
	const headerJs = [];

	headerData["js"] = headerJs;
	headerData["companyCode"] = config.companyCode;

	let footerData = {};
	const js = [
		"/app-assets/js/item.js"
	];

	footerData["js"] = js;

	res.render("pages/list-project", {alldata: null, companyCode: config.companyCode, headerData: headerData, footerData: footerData});
});

router.get("/project-edit/:id", checkAuthorization, (req, res) => {
	request(config.domain + "/projects/editAPI/" + req.params.id, function (error, response, body) {
			let data = JSON.parse(body);
			if (response.statusCode == 200) {
				if (data.data.CompanyCode != config.companyCode && EnableGimaEnv == "true") {
					res.redirect("/404");
				} else {
					const ddep_api_prefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;

					let headerData = {};
					const headerJs = [
						"/assets/js/go.js"
					];

					headerData["js"] = headerJs;
					headerData["companyCode"] = config.companyCode;

					let footerData = {};
					const js = [
						"/app-assets/js/scripts/mapping-gojs.js",
						"/app-assets/js/scripts/mapping-outbound-gojs.js",
						"/app-assets/js/scripts/forms/form-wizard.js"
					];

					footerData["js"] = js;

					res.render("pages/add-projects", {alldata: data.data, companyCode: data.data.CompanyCode, api_prefix: ddep_api_prefix, headerData: headerData, footerData: footerData});
				}
			} else {
				return res.send(data.message);
			}
		}
	);
});

module.exports = router;