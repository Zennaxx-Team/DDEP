const express = require("express");
const router = express.Router();
const items_prop = require("../controllers/items_prop.controller");
const { checkCompanyCode } = require("../middleware");

router.post("/save", items_prop.create);

router.put("/:id", items_prop.update);

router.get("/editAPI/:id", items_prop.findOne);

router.put("/update/:id", checkCompanyCode, items_prop.update);

router.put("/updateByItemId/:id", checkCompanyCode, items_prop.updateByItemId);

router.get("/props/:id", items_prop.clear);

module.exports = router;