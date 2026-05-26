const express = require("express");
const router = express.Router();
const mapping_setting = require("../controllers/mapping_outbound_setting.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", mapping_setting.create);

router.get("/editAPI/:id", mapping_setting.findOne);

router.put("/update/:id", checkCompanyCode, mapping_setting.update);

router.put("/updateByItemId/:id", checkCompanyCode, mapping_setting.updateByItemId);

module.exports = router;