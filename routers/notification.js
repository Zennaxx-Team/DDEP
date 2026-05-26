const EnableGimaEnv = process.env.EnableGima;
const express = require("express");
const router = express.Router();
const request = require("request");
const config = require("../config");
const notification = require("../controllers/notification.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

router.post("/save", notification.create);

router.post("/edit/:slug", notification.findOne);

router.post("/update", checkCompanyCode, notification.update);

router.get("/", checkAuthorization, async (req, res, next) => {
	try {
		let data = {};
		if (EnableGimaEnv == "true") {
			data["companyCode"] = config.companyCode;
		}

		request({"method": "POST",
			"url": config.domain + "/notifications/edit/notification",
			"headers": {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(data),
		}, function (error, response, body) {
			const data = JSON.parse(body);
			if (response.statusCode == 200) {
				let headerData = {};
				const headerJs = [];

				headerData["js"] = headerJs;
				headerData["companyCode"] = config.companyCode;

				let footerData = {};
				const js = [
					"/app-assets/js/notification.js"
				];

				footerData["js"] = js;

				res.render("pages/notification", {alldata: data.data, companyCode: config.companyCode, headerData: headerData, footerData: footerData, isProject: true});
			} else if (response.statusCode == 404) {
				res.redirect("/404");
			} else  {
				res.redirect("/500");
			}
		});
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
});

module.exports = router;