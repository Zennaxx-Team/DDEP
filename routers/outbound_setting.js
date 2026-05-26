const express = require("express");
const router = express.Router();
const outbound_setting = require("../controllers/outbound_setting.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", outbound_setting.create);

router.put("/:id", outbound_setting.update);

router.get("/editAPI/:id", outbound_setting.findOne);

router.get("/list", outbound_setting.findAll);

router.put("/update/:id", checkCompanyCode, outbound_setting.update);

module.exports = router;