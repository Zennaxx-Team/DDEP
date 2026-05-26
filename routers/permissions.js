const express = require("express");
const config = require("../config");
const permissionsController = require("../controllers/permissions.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/init", permissionsController.initPermission);
router.post("/list", permissionsController.list);
router.post("/status/:id", permissionsController.statusChange);
router.post("/create", permissionsController.create);
router.get("/get/:id", permissionsController.findOne);
router.put("/update/:id", checkCompanyCode, permissionsController.update);
router.get("/all", permissionsController.all);
router.post("/get-user-permission", permissionsController.getUserPermission);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "permission-list");
});

router.get("/create", checkAuthorization, (req, res) => {
	renderPage(res, "permission-create");
});

router.get("/edit/:id", checkAuthorization, (req, res) => {
	renderPage(res, "permission-create", { id: req.params.id });
});

module.exports = router;