const express = require("express");
const config = require("../config");
const mappingProfilesController = require("../controllers/mapping_profiles.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.post("/list", mappingProfilesController.list);
router.post("/status/:id", mappingProfilesController.statusChange);
router.post("/create", mappingProfilesController.create);
router.get("/get/:mappingProfileId/:mappingProfileHistoryId", mappingProfilesController.findOne);
router.put("/update/:id/:mappingProfileHistoryId", checkCompanyCode, mappingProfilesController.update);
router.post("/version/:mappingProfileId/:mappingProfileHistoryId", mappingProfilesController.versionChange);
router.get("/all", mappingProfilesController.all);
router.post("/all-project-mapping-profile", mappingProfilesController.allProjectMappingProfile);
router.post("/get-mapping-profile-history", mappingProfilesController.getMappingProfileHistoryId);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "mapping-profile-list");
});

router.get("/create", checkAuthorization, (req, res) => {
	renderPage(res, "mapping-profile-create");
});

router.get("/edit/:mappingProfileId/:mappingProfileHistoryId", checkAuthorization, (req, res) => {
	renderPage(res, "mapping-profile-create", { mappingProfileId: req.params.mappingProfileId, mappingProfileHistoryId: req.params.mappingProfileHistoryId });
});

module.exports = router;