const express = require("express");
const config = require("../config");
const alertconditionsController = require("../controllers/alert_conditions.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", alertconditionsController.list);
router.post("/status/:id", alertconditionsController.statusChange);
router.post("/create", alertconditionsController.create);
router.get("/get/:id", alertconditionsController.findOne);
router.put("/update/:id", checkCompanyCode, alertconditionsController.update);
router.get("/all", alertconditionsController.all);
router.post("/list-by-item/:itemId", alertconditionsController.listByItemId)

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "alert-condition-list");
});

module.exports = router;