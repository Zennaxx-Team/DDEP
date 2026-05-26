const express = require("express");
const router = express.Router();
const inbound_history = require("../controllers/inbound_history.controller");

router.post("/save", inbound_history.create);

router.put("/:id", inbound_history.update);

router.get("/editAPI/:id", inbound_history.findOne);

router.get("/lastOne/:id", inbound_history.lastOne);

router.get("/list", inbound_history.findAll);

router.put("/update/:id", inbound_history.update);

router.get("/deleteall/:day", inbound_history.deleteAll);

module.exports = router;