const express = require("express");
const config = require("../config");
const projectsController = require("../controllers/projects.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", projectsController.list);
router.post("/status/:id", projectsController.statusChange);
router.post("/create", projectsController.create);
router.get("/get/:id", projectsController.findOne);
router.put("/update/:id", checkCompanyCode, projectsController.update);
router.get("/all-company-project", projectsController.allCompanyProject);
router.post("/all-company-project", projectsController.allCompanyProject);
router.get("/all", projectsController.all);
router.post("/check-project-code-exist", projectsController.checkCodeExist);
router.post("/check-exists", projectsController.checkProjectExists);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "project-list");
});

module.exports = router;