const express = require("express");
const config = require("../config");
const environmentsController = require("../controllers/environments.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", environmentsController.list);
router.post("/status/:id", environmentsController.statusChange);
router.post("/create", environmentsController.create);
router.get("/get/:id", environmentsController.findOne);
router.put("/update/:id", checkCompanyCode, environmentsController.update);
router.post("/all-project-environment", environmentsController.allProjectEnvironment);
router.get("/all", environmentsController.all);
router.post("/check-ddep-api-exist", environmentsController.checkDdepApiPrefixExist);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "environment-list");
});

module.exports = router;