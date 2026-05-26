const express = require("express");
const config = require("../config");
const alerthistoryController = require("../controllers/alert_history.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", alerthistoryController.list);
router.get("/:id", checkAuthorization, alerthistoryController.detail);
router.post("/get/:id", checkAuthorization, alerthistoryController.alertDetailsLogs)

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "alert-history-list");
});

module.exports = router;