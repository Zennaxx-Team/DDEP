const express = require("express");
const items_schedule_setting = require("../controllers/items-schedules.controller");
const { checkCompanyCode } = require("../middleware");

const router = express.Router();

router.post("/create", items_schedule_setting.create);
router.get("/get/:id", items_schedule_setting.findOne);
router.put("/update/:id", checkCompanyCode, items_schedule_setting.update);

module.exports = router;