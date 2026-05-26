const express = require("express");
const config = require("../config");
const alertpoliciesController = require("../controllers/alert_policies.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", alertpoliciesController.list);
router.post("/status/:id", alertpoliciesController.statusChange);
router.post("/create", alertpoliciesController.create);
router.get("/get/:id", alertpoliciesController.findOne);
router.put("/update/:id", checkCompanyCode, alertpoliciesController.update);
router.get("/all", alertpoliciesController.all);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "alert-policy-list");
});

module.exports = router;