const express = require("express");
const config = require("../config");
const { checkAuthorization } = require("../middleware");
const { getThroughput, getExceptionChart, getNetworkUsage, getThroughputHistoryByPickPoint, getExceptionHistoryByPickPoint, getTransactionsList, getSlowestTransactions, getExceptionList } = require("../controllers/dashboard.controller");

const router = express.Router();

const renderPage = (res, page, alldata = null, isProject) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject });

router.post("/throughput", getThroughput);

router.post("/exception", getExceptionChart);

router.post("/network", getNetworkUsage);

router.post("/throughput/throughput-history-by-pick-point", getThroughputHistoryByPickPoint);

router.post("/exception/exception-history-by-pick-point", getExceptionHistoryByPickPoint);

router.post("/transactions/list", getTransactionsList);

router.post("/transactions/slowest", getSlowestTransactions);

router.post("/transactions/exception", getExceptionList);

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "dashboard", null, false);
});


module.exports = router;