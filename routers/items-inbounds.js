const express = require("express");
const itemsInboundsController = require("../controllers/items-inbounds.controller");
const { checkCompanyCode } = require("../middleware");

const router = express.Router();

router.post("/create", itemsInboundsController.create);
router.get("/get/:id", itemsInboundsController.findOne);
router.put("/update/:id", checkCompanyCode, itemsInboundsController.update);
router.post("/check-ddep-endpoint-exist", itemsInboundsController.checkCodeExist);
router.post("/editddepAPI", itemsInboundsController.findOneByDdepInput);
router.post("/ddepInputAPI", itemsInboundsController.searchItemByDdepInput);

module.exports = router;