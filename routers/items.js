const express = require("express");
const config = require("../config");
const itemsController = require("../controllers/items.controller");
const { checkAuthorization, checkCompanyCode } = require("../middleware");
const { getCompanyByCompanyCode } = require("../controllers/companies.controller");

const router = express.Router();

const renderPage = (res, page, alldata = null, isProject) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject });

router.post("/list", itemsController.list);
router.post("/status/:id", itemsController.statusChange);
router.post("/create", itemsController.create);
router.get("/get/:id", itemsController.findOne);
router.put("/update/:id", checkCompanyCode, itemsController.update);
router.post("/check-item-code-exist", itemsController.checkCodeExist);
router.get("/fulllistItem/:id", itemsController.fulllistItem);
router.get("/fulllist", itemsController.fullItem);
router.post("/item-list", itemsController.listItem);
router.post("/item-import", itemsController.itemImport);
router.post("/item-name-list", itemsController.itemNameList);
router.post("/item-clone", itemsController.cloneItem);
router.post("/check-item-exists", itemsController.checkItemExists);

router.get("/project-list", checkAuthorization, async (req, res) => {
	const companyCode = res.locals.companyCode;
	const domainWithoutProtocol = config.domain.replace(/(^\w+:|^)\/\//, "");

	// Common cookie options
	const cookieOptions = {
		domain: domainWithoutProtocol,
		path: "/",
		secure: true,
		sameSite: "None",
		// maxAge: 10 * 60 * 60 * 1000
	};

	const { selectedCompany, selectedProject, selectedProjectName } = req.cookies;

	if (selectedCompany === "all" || selectedProject === "all") {
		if (companyCode) {
			const companiesData = await getCompanyByCompanyCode(companyCode);
			if (companiesData?.status === 1 && companiesData?.data) {
				res.cookie("selectedCompany", companiesData.data._id.toString(), cookieOptions);
				res.cookie("selectedProject", "", cookieOptions);
				res.cookie("selectedProjectName", "Default", cookieOptions);
				res.cookie("dashboardSelectedItem", "all", cookieOptions);
			}
		}
	} else {
		// res.cookie("selectedCompany", selectedCompany.toString(), cookieOptions);
		// res.cookie("selectedProject", selectedProject, cookieOptions);
		// res.cookie("selectedProjectName", selectedProjectName, cookieOptions);
	}

	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" +companyCode;
	renderPage(res, "item-list", { ddepApiPrefix }, false);
});

router.get("/create", checkAuthorization, (req, res) => {
	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;

	renderPage(res, "item-create", { ddepApiPrefix }, true);
});

router.get("/edit/:id", checkAuthorization, (req, res) => {
	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;

	renderPage(res, "item-create", { ddepApiPrefix, id: req.params.id }, true);
});

module.exports = router;