const express = require("express");
const router = express.Router();
const inbound_setting = require("../controllers/inbound_setting.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", inbound_setting.create);

router.put("/:id", checkCompanyCode, inbound_setting.update);

router.get("/editAPI/:id", inbound_setting.findOne);

router.post("/editddepAPI", inbound_setting.findOneByDdepInput);

router.post("/ddepInputAPI", inbound_setting.searchItemByDdepInput);

router.post("/checkddepinputexist", inbound_setting.checkddepinputexist);

router.get("/list", inbound_setting.findAll);

router.put("/update/:id", checkCompanyCode, inbound_setting.update);

module.exports = router;