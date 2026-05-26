const express = require("express");
const config = require("../config");
const logHistory = require("../controllers/log_history.controller");
const { checkAuthorization } = require("../middleware");

const router = express.Router();

const renderPage = (res, page, alldata = null,) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, isProject: true, alldata});

router.post("/save", logHistory.create);

router.put("/update/missingId/itemId/:itemId", logHistory.updateLogByItemId);

router.put("/update/requestId/itemId/:itemId", logHistory.updateLogByItemIdwithRequestId);

router.post("/request_by_log", logHistory.getRequest)

router.put("/update/missingId/uniqueId/:unique_id", logHistory.updateLogByUniqueId);

router.put("/update/missingId/bulk", logHistory.updateLogsBulkMissingId);

router.post("/logFullList", logHistory.findAll);

router.post("/logGroupFullList", logHistory.findAllGroup);

router.post("/logViewFullList", logHistory.findAllView);

router.post("/logNewViewFullList", logHistory.findAllNewView);

router.post("/lastLogByUniqueId", logHistory.findByUniqueIdLog);

router.get("/export", logHistory.exportAll);

router.post("/import", logHistory.importAll);

router.get("/deleteall/:day", logHistory.deleteAll);

router.post("/logFullListUniqueId", logHistory.findAllLogFullListUniqueId);

router.post("/logFullListUniqueIdForFTP", logHistory.findAllLogFullListUniqueIdForFTPlogs);

router.post("/logNewViewFullListForftp", logHistory.findAllNewViewForFtpLogs);

router.post("/favourite/save", logHistory.saveFavourite);

router.post("/recent-search/save", logHistory.saveRecentHistory);

router.put("/favourite/update/:id", logHistory.updateFavourite);

router.get("/favourite", logHistory.getMyFavourites);

router.get("/favourite/:id", logHistory.getFavouriteById);

router.get("/log-queries", logHistory.getLogQueries);

router.get("/recent-search", logHistory.getRecentSearchHistory);

router.get("/log-queries/:id", logHistory.getLogQuery);

router.get("/recent-search/:id", logHistory.getRecentSearchHistoryById);

router.delete("/favourite/:id", logHistory.deleteFavourite);

router.post('/update-log-description', logHistory.updateLogHistory);

router.post("/review/save", logHistory.addReview);

router.get("/review/:uniqueId", logHistory.getReviewed);

router.post("/update-all-outbound-inbound", logHistory.updateAllOutboundToInbound);

router.post("/update-last-inbound-outbound", logHistory.updateInboundAfterOutboundResponse);

router.get("/", checkAuthorization, (req, res) => {
	const ddepApiPrefix = config.domain + "/" + config.ddepPrefix + "/" + config.companyCode;
	renderPage(res, "log-list", { ddepApiPrefix, isProject: false} );
});

router.get("/list", checkAuthorization, (req, res) => {
	let headerData = {};
	const headerJs = [];

	headerData["js"] = headerJs;
	headerData["companyCode"] = config.companyCode;

	let footerData = {};
	const js = [
		"/app-assets/js/logs.js"
	];

	footerData["js"] = js;

	res.render("pages/list-log", {companyCode: config.companyCode, headerData: headerData, footerData: footerData, isProject: true});
});

router.get("/:unique_id", checkAuthorization, (req, res) => {
	renderPage(res, "view-log", { unique_id: req.params.unique_id, isProject: true });
});

module.exports = router;