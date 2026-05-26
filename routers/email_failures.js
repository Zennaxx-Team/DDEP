const express = require("express");
const config = require("../config");
const { checkAuthorization } = require("../middleware");
const { getEmailFailures, resendFailedEmails, deleteFailedEmails } = require("../controllers/email_failures.controller");

const router = express.Router();
const renderPage = (res, page, alldata = null,) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, isProject: true, alldata});

router.get("/", checkAuthorization, (req, res) => {
	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;
	renderPage(res, "email-failures-list", { ddepApiPrefix, isProject: false} );
});

router.post("/list", getEmailFailures);

router.post("/resend", resendFailedEmails);

router.post("/delete", deleteFailedEmails);

module.exports = router;