const express = require("express");
const itemsOutboundsController = require("../controllers/items-outbounds.controller");
const { checkCompanyCode } = require("../middleware");

const router = express.Router();

router.post("/create", itemsOutboundsController.create);
router.get("/get/:id", itemsOutboundsController.findOne);
router.put("/update/:id", checkCompanyCode, itemsOutboundsController.update);

module.exports = router;