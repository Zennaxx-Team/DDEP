const express = require("express");
const router = express.Router();
const outbound_history = require("../controllers/outbound_history.controller");

router.post("/save", outbound_history.create);

router.put("/:id", outbound_history.update);

router.get("/editAPI/:id", outbound_history.findOne);

router.get("/lastOne/:id", outbound_history.lastOne);

router.get("/list", outbound_history.findAll);

router.put("/update/:id", outbound_history.update);

router.get("/deleteall/:day", outbound_history.deleteAll);

module.exports = router;