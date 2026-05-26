const express = require("express");
const router = express.Router();
const outbound_validation = require("../controllers/outbound_validation.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", outbound_validation.create);

router.put("/:id", outbound_validation.update);

router.get("/editAPI/:id", outbound_validation.findOne);

router.get("/list", outbound_validation.findAll);

router.put("/update/:id", checkCompanyCode, outbound_validation.update);

module.exports = router;