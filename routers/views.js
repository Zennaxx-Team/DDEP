const express = require("express");
const config = require("../config");
const logHistory = require("../controllers/log_history.controller");
const { checkAuthorization } = require("../middleware");

const router = express.Router();
const renderPage = (res, page, alldata = null,) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, isProject: true, alldata});

router.get("/", checkAuthorization, (req, res) => {
	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;
	renderPage(res, "view-list", { ddepApiPrefix, isProject: false} );
});

module.exports = router;