const express = require("express");
const router = express.Router();
const inbound_filter = require("../controllers/inbound_filter.controller");
const outbound_filter = require("../controllers/outbound_filter.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/inbound/save", inbound_filter.create);

router.get("/inbound/editAPI/:id", inbound_filter.findOne);

router.put("/inbound/update/:id", checkCompanyCode, inbound_filter.update);

router.put("/inbound/updateByItemId/:id", checkCompanyCode, inbound_filter.updateByItemId);

router.post("/outbound/save", outbound_filter.create);

router.get("/outbound/editAPI/:id", outbound_filter.findOne);

router.put("/outbound/update/:id", checkCompanyCode, outbound_filter.update);

router.put("/outbound/updateByItemId/:id", checkCompanyCode, outbound_filter.updateByItemId);

module.exports = router;