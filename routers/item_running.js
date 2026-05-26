const express = require("express");
const router = express.Router();
const itemRunning = require("../controllers/ItemRunningSetting.controller");

router.post("/save", itemRunning.create);

router.get("/editAPI/:id", itemRunning.findOne);

router.put("/update/:id", itemRunning.update);

router.get("/updatemany", itemRunning.updateMany);

module.exports = router;