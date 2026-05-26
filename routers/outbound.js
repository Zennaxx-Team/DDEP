const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const path = require("path");
const request = require("request");
const config = require("../config");

router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));
router.use(express.static("public"));

module.exports = router;