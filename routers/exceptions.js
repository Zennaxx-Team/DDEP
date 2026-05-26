const express = require("express");
const config = require("../config");
const { checkAuthorization } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "exception-list");
});

module.exports = router;