const express = require("express");
const router = express.Router();
const path = require("path");
const { inboundrun, outboundrun, checkFtpConnection, convertxmltojson } = require("../handler/inbound");

router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));
router.use(express.static("public"));

router.post("/inboundrun", inboundrun);
router.post("/outboundrun", outboundrun);
router.post("/check-ftp-connection", checkFtpConnection);
router.post("/convertxmltojson", convertxmltojson);

module.exports = router;