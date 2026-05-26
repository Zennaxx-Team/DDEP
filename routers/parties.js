const express = require("express");
const config = require("../config");
const partiesController = require("../controllers/parties.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", partiesController.list);
router.post("/status/:id", partiesController.statusChange);
router.post("/create", partiesController.create);
router.get("/get/:id", partiesController.findOne);
router.put("/update/:id", checkCompanyCode, partiesController.update);
router.get("/all", partiesController.all);
router.post("/all-project-parties", partiesController.allProjectParties);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "party-list");
});

module.exports = router;