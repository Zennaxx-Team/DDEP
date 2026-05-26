const express = require("express");
const config = require("../config");
const alertDebugHistoryController = require("../controllers/alert_debug_history.controller");
const { checkAuthorization } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", alertDebugHistoryController.list);
router.get("/:id", checkAuthorization, alertDebugHistoryController.detail);
router.post("/get/:id", checkAuthorization, alertDebugHistoryController.alertDetailsLogs)

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "alert-debug-history-list");
});

module.exports = router;