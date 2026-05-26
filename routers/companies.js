const express = require("express");
const config = require("../config");
const companiesController = require("../controllers/companies.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", companiesController.list);
router.post("/status/:id", companiesController.statusChange);
router.post("/create", companiesController.create);
router.get("/get/:id", companiesController.findOne);
router.put("/update/:id", checkCompanyCode, companiesController.update);
router.get("/all", companiesController.all);
router.get("/getcompany/:companyCode", companiesController.getCompany);
router.post("/check-company-code-exist", companiesController.checkCodeExist);
router.post("/check-exists", companiesController.checkCompanyExists);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "company-list");
});

module.exports = router;