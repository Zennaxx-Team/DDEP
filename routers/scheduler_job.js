const express = require("express");
const router = express.Router();
const path = require("path");
const { scheduling, getScheduleProjectInfo } = require("../handler/scheduler_job");

router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));
router.use(express.static("public"));

router.get("/scheduling", scheduling);
router.get("/getScheduleProjectInfo", getScheduleProjectInfo);

module.exports = router;