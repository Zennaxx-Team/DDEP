const express = require("express");
const config = require("../config");
const diffHistoryController = require("../controllers/diff_history.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", diffHistoryController.list);
router.get("/:id", checkAuthorization, diffHistoryController.detail);
router.post("/get/:id", checkAuthorization, diffHistoryController.diff_checker_details)

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "diff-history-list");
});

module.exports = router;