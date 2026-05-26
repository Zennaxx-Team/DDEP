const express = require("express");
const router = express.Router();
const schedule_setting = require("../controllers/schedule_setting.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", schedule_setting.create);

router.put("/:id", schedule_setting.update);

router.get("/editAPI/:id", schedule_setting.findOne);

router.get("/list", schedule_setting.findAll);

router.put("/update/:id", checkCompanyCode, schedule_setting.update);

module.exports = router;