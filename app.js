const dotenv = require("dotenv").config();
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const EnableGimaEnv = process.env.EnableGima || "false";
const port = process.env.PORT || 8014;

const cluster = require("cluster");
const os = require("os");
const createError = require("http-errors");
const express = require("express");
const path = require("path");
const request = require("request");
const cors = require("cors");
const mongoose = require("mongoose");
const cron = require("node-cron");
const bodyParser = require("body-parser");
const axios = require("axios");
const cookieParser = require("cookie-parser");
const fs = require("fs");
const jwtDecode = require("jwt-decode");

const config = require("./config");
const { logFileCleanUp, initErrorConfig, databaseConnectError, exceptionErrorStore } = require("./monitor/monitor");
const upload = require("./my_modules/upload");

const indexRouter = require("./routers/index");
const itemRouter = require("./routers/item");
const inboundRouter = require("./routers/inbound");
const outboundRouter = require("./routers/outbound");
const inboundSettingRouter = require("./routers/inbound_setting");
const mappingSettingRouter = require("./routers/mapping_setting");
const mappingOutboundSettingRouter = require("./routers/mapping_outbound_setting");
const outboundSettingRouter = require("./routers/outbound_setting");
const outboundValidationRouter = require("./routers/outbound_validation");
const itemsPropRouter = require("./routers/items_prop");
const itemsPropOutboundRouter = require("./routers/items_prop_outbound");
const itemRunning = require("./routers/item_running");
const scheduleSettingRouter = require("./routers/schedule_setting");
const scheduler_job = require("./routers/scheduler_job");
const inboundHistoryRouter = require("./routers/inbound_history");
const outboundHistoryRouter = require("./routers/outbound_history");
const logHistoryRouter = require("./routers/log_history");
const DataRouter = require("./routers/datas");
const viewRouter = require("./routers/views")
const settingsRouter = require("./routers/settings");
const notificationRouter = require("./routers/notification");
const filterRouter = require("./routers/filter");
const exceptionsRouter = require("./routers/exceptions");
const project = require("./routers/project");
const usersRouter = require("./routers/users");
const dashboardRouter = require("./routers/dashboard")

const companiesRouter = require("./routers/companies");
const environmentsRouter = require("./routers/environments");
const itemsInboundsRouter = require("./routers/items-inbounds");
const itemsOutboundsRouter = require("./routers/items-outbounds");
const itemsScheduleSettingRouter = require("./routers/items-schedules");
const itemsRouter = require("./routers/items");
const mappingProfilesRouter = require("./routers/mapping_profiles");
const partiesRouter = require("./routers/parties");
const permissionsRouter = require("./routers/permissions");
const projectsRouter = require("./routers/projects");
const alertpoliciesRouter = require("./routers/alert_policies");
const alertconditionsRouter = require("./routers/alert_conditions");
const alerthistoryRouter = require("./routers/alert_history");
const alertDebughistoryRouter = require("./routers/alert_debug_history");
const diffCheckerHistoryRouter = require("./routers/diff_history");
const emailFailureRouter = require("./routers/email_failures")
const { startMailWorker, startMailActionWorker, startMailAlertnWorker } = require("./queues/workers/mailWorker");
const { logQueueCon, batchQueueCon } = require('./queues/config/queuesConfigartion');
const { startResendWorker } = require("./queues/workers/resendMailWorker");
const setupQueueEvents = require("./queues/events/queueEvents");

const app = express();

app.set('trust proxy', true);

if (cluster.isMaster) {
	const totalCPUs = os.cpus().length;
	console.log("Number of CPUs are " + totalCPUs);
	console.log("Master " + process.pid + " is running\n");

	// Fork workers.
	for (let i = 0; i < 1; i++) {
		cluster.fork();
	}

	// If the worker dies, restart it.
	cluster.on("exit", function (worker, code, signal) {
		console.log("Worker id " + worker.id + " died...");
		console.log("Worker process id " + worker.process.pid + " died...");
		console.log("Let's fork another worker!\n");
		cluster.fork();
	});
} else {
	let lastRequestUrl = "";
	let projectSchedulerRunning = 0;
	const outputDir = "./output";
	const logDir = outputDir + "/log/";
	const inboundDir = outputDir + "/inbounds";
	const historyDir = outputDir + "/history";
	const historyInboundDir = historyDir + "/inbounds";
	const historyOutboundDir = historyDir + "/outbounds";
	const historyConvertfailDir = historyDir + "/convertfail";
	const historyTimeoutDir = historyDir + "/timeout";
	const sendingDir = outputDir + "/sending";

	mongoose.Promise = global.Promise;

	app.post("/file/upload", async (req, res, next) => {
		upload(req, res, function (err) {
			if (err) {
				res.send({
					status: 0,
					message: "Error while file uploading : " + err,
				});
			} else {
				res.send({
					status: 1,
					message: "File uploaded successfully!",
					filename: req.file.filename
				});
			}
		});
	});

	app.set("views", path.join(__dirname, "views"));
	app.set("view engine", "ejs");
	app.set('trust proxy', true);

	app.use(cors({
		origin: process.env.GIMA_SITE_URL,
		credentials: true,                  // To allow cookies
	}));

	app.use(cookieParser());
	app.use(express.static("public"));
	app.use(express.static(path.join(__dirname, "public")));
	app.use(bodyParser.text({ type: "*" }));
	app.use(bodyParser.json({ limit: "100mb" }));
	app.use(bodyParser.urlencoded({ limit: "100mb", extended: true, parameterLimit: 100000000 }));

	app.all("*", checkCookies);
	app.use("/", indexRouter);
	// app.use("/projects", itemRouter);
	app.use("/inbound", inboundRouter);
	// app.use("/outbound", outboundRouter);
	// app.use("/inbound_setting", inboundSettingRouter);
	// app.use("/project/item/mapping", mappingSettingRouter);
	// app.use("/project/item/filter", filterRouter);
	// app.use("/project/item/mapping-outbound", mappingOutboundSettingRouter);
	// app.use("/outbound_setting", outboundSettingRouter);
	// app.use("/outbound_validation", outboundValidationRouter);
	// app.use("/project/item/properties", itemsPropRouter);
	// app.use("/project/item/properties-outbound", itemsPropOutboundRouter);
	app.use("/project/item/clear", itemsPropRouter);
	app.use("/project/item/running", itemRunning);
	// app.use("/schedule_setting", scheduleSettingRouter);
	app.use("/scheduler_job", scheduler_job);
	app.use("/inbound_history", inboundHistoryRouter);
	app.use("/outbound_history", outboundHistoryRouter);
	app.use("/logs", logHistoryRouter);
	app.use("/datas", DataRouter);
	app.use("/views", viewRouter)
	app.use("/email", settingsRouter);
	app.use("/settings", settingsRouter);
	app.use("/notifications", notificationRouter);
	app.use("/exceptions", exceptionsRouter);
	app.use("/users", usersRouter);
	// app.use("/project", project);
	// app.use("/project/item", itemRouter);
	// app.use("/project/item/inbound", inboundSettingRouter);
	// app.use("/project/item/outbound", outboundSettingRouter);
	// app.use("/project/item/schedule", scheduleSettingRouter);
	// app.use("/project/item/inbound", inboundRouter);
	// app.use("/project/item/scheduler_job", scheduler_job);
	// app.use("/project/item/inbound_history", inboundHistoryRouter);
	// app.use("/project/item/outbound_history", outboundHistoryRouter);

	app.use("/master/companies", companiesRouter);
	app.use("/master/environments", environmentsRouter);
	app.use("/projects/inbounds", itemsInboundsRouter);
	app.use("/projects/outbounds", itemsOutboundsRouter);
	app.use("/projects/schedules", itemsScheduleSettingRouter);
	app.use("/projects", itemsRouter);
	app.use("/dashboard", dashboardRouter);
	app.use("/template/mapping-profiles", mappingProfilesRouter);
	app.use("/master/parties", partiesRouter);
	app.use("/permissions", permissionsRouter);
	app.use("/master/projects", projectsRouter);
	app.use("/alerts/alert-policies", alertpoliciesRouter);
	app.use("/alerts/alert-conditions", alertconditionsRouter);
	app.use("/alerts/alert-history", alerthistoryRouter);
	app.use("/alerts/alert-history-debug", alertDebughistoryRouter);
	app.use("/diff-history", diffCheckerHistoryRouter)
	app.use("/email-failures", emailFailureRouter);

	app.use(function (req, res, next) {
		lastRequestUrl = req.originalUrl;
		next();
	});

	app.use(async function (err, req, res, next) {
		const pageUrl = lastRequestUrl;
		const stack = err.stack;
		const stackLines = stack.split("\n");

		// set locals, only providing error in development
		res.locals.message = err.message;
		res.locals.error = req.app.get("env") === "development" ? err : {};

		let functionName = "", filePath = "", lineNumber = "", columnNumber = "";
		let errorInfo = `Error message: ${err.message}`;

		for (let i = 1; i < stackLines.length; i++) {
			if (stackLines[i].includes("node_modules") || stackLines[i].includes("node:")) continue;

			const match = stackLines[i].match(/at (.+?) \((.*):(\d+):(\d+)\)/);
			if (match) {
				functionName = `at ${match[1]}`;
				filePath = match[2];
				lineNumber = match[3];
				columnNumber = match[4];
				break;
			}
		}

		if (filePath) {
			errorInfo = `Error occurred in file: ${filePath}`;

			if (lineNumber) {
				errorInfo += `, at line: ${lineNumber}`;

				if (columnNumber) {
					errorInfo += `, column: ${columnNumber}`;
				}
			}
		}

		await exceptionErrorStore(pageUrl, functionName, errorInfo, filePath, err.status || 500, config.userName, config.companyCode);

		const isBrowserRequest = req.headers.accept && req.headers.accept.includes("text/html");
		console.error(`Error message : ${err.message}`);
		console.error(err);
		if (isBrowserRequest) {
			if (err.status === 500) {
				res.status(500).redirect("/500");
			} else if (err.status === 404) {
				res.status(404).redirect("/404");
			} else {
				res.status(err.status || 500).redirect("/500");
			}
		} else {
			if (err.status === 500) {
				res.status(500).json({ status: 0, message: err?.message || "Internal Server Error!" });
			} else if (err.status === 404) {
				res.status(404).json({ status: 0, message: "Not Found!" });
			} else {
				res.status(err.status || 500).json({ status: 0, message: err?.message || "Something want wrong!" });
			}
		}
	});

	app.listen(port, function () {
		const networkInterfaces = os.networkInterfaces();
		const ipAddresses = Object.values(networkInterfaces)
			.flat()
			.filter(iface => iface.family === "IPv4" && !iface.internal)
			.map(iface => iface.address);
		const ip = ipAddresses.length > 0 ? ipAddresses[0] : "127.0.0.1";
		console.log("Server is running on PORT", port);
		console.log("Server IP address:", ip);
	});

	/* Every minute cron schedule */
	cron.schedule("* * * * *", function() {
		console.log("\n==================================================");
		console.log("\nRun public scheduler every minute");
		publicScheduler();
		updateRunningItem();
	});

	/* Every midnight cron schedule */
	cron.schedule("0 0 * * *", function () {
		// console.log("Run a cron schedule every day 00:00 hours");
		// removeLogHistories();
		// removeInOutHistories();
		// logFileCleanUp();
	});

	/* Every sunday midnight cron schedule */
	cron.schedule("* * * * 0", function () {
		// console.log("Run a cron schedule every sunday 00:00 hours");
	});

	app.get("/count/queues/logs", async (req, res) => {
		const includeDetails = true;
		const limit = parseInt(req.query.limit) || 1000; // was: maxJobs
		const pageSize = parseInt(req.query.pageSize) || 100; // was: batchSize
		try {
			const logCounts = await logQueueCon.getJobCounts();
			const batchCounts = await batchQueueCon.getJobCounts();

			const response = {
				success: true,
				logQueue: {
					counts: logCounts,
				},
				batchQueue: {
					counts: batchCounts,
				}
			};

			if (includeDetails) {
				response.logQueue.details = await getQueueDetailsEnhanced(logQueueCon, limit, pageSize);
				response.batchQueue.details = await getQueueDetailsEnhanced(batchQueueCon, limit, pageSize);
			}

			res.json(response);
		} catch (error) {
			console.error('Error fetching queue details:', error.message);
			res.status(500).json({ success: false, error: error.message });
		}
	})

	async function getQueueDetailsEnhanced(queue, limit = 1000, pageSize = 100) {
		const statuses = ['waiting', 'active', 'delayed', 'failed', 'completed'];
		const details = {};

		for (const status of statuses) {
			details[status] = {
				jobs: [],
				totalCount: 0,
				fetchedCount: 0,
				error: null,
				truncated: false
			};

			try {
				const jobCount = await queue.getJobCountByTypes(status);
				details[status].totalCount = jobCount;

				const jobsToFetch = Math.min(jobCount, limit);
				details[status].truncated = jobCount > limit;

				if (jobsToFetch > 0) {
					const totalBatches = Math.ceil(jobsToFetch / pageSize);

					for (let batch = 0; batch < totalBatches; batch++) {
						const start = batch * pageSize;
						const end = Math.min(start + pageSize - 1, jobsToFetch - 1);

						try {
							const jobs = await queue.getJobs([status], start, end, false);

							const jobDetails = jobs.map(job => ({
								id: job.id,
								name: job.name,
								data: job.data,
								timestamp: job.timestamp,
								processedOn: job.processedOn,
								finishedOn: job.finishedOn,
								attemptsMade: job.attemptsMade,
								failedReason: job.failedReason,
								returnValue: job.returnvalue
							}));

							details[status].jobs.push(...jobDetails);
							details[status].fetchedCount = details[status].jobs.length;
						} catch (batchError) {
							console.error(`Error fetching batch ${batch} for status ${status}:`, batchError.message);
						}
					}
				}
			} catch (err) {
				console.error(`Error fetching jobs for status ${status}:`, err.message);
				details[status].error = err.message;
			}
		}

		return details;
	}

	mongoose.connect(config.dburl, {
		useNewUrlParser: true,
		readPreference: "secondaryPreferred"
	}).then(() => {
		console.log("Successfully connected to the database");
		initErrorConfig();
	}).catch(async (err) => {
		console.error("Could not connect to the database. Exiting now...", err);
		await databaseConnectError("app.js", "database connect", config.userName, err);
		process.exit();
	});

	require('./queues/workers/logWorker');
	require('./queues/workers/logalertWorker');
	require('./queues/workers/logdiffWorker');

	startMailWorker();
	startMailActionWorker();
	startMailAlertnWorker();
	startResendWorker();
	setupQueueEvents();

	function checkCookies(req, res, next) {
		const inCookies = req.cookies;

		if (inCookies != undefined && inCookies.Token != undefined && EnableGimaEnv == "true") {
			let decoded = jwtDecode(inCookies.Token);
			config.userName = decoded.username;
			config.companyCode = decoded.company_code;
		}

		if (req.cookies["permissions"]) {
			try {
				res.locals.userPermissions = JSON.parse(req.cookies["permissions"]);
			} catch (err) {
				// console.error("Failed to parse permissions cookie:", err);
				res.locals.userPermissions = {};
			}
		} else {
			res.locals.userPermissions = {};
		}

		next();
	}

	function projectScheduler() {
		projectSchedulerRunning = 1;
		axios.get(config.domain + "/scheduler_job/scheduling")
			.then(response => {
				projectSchedulerRunning = 0;
				console.log("\nProject scheduler response : " + JSON.stringify(response.data));
				console.log("\nProject scheduler end");
				console.log("\n==================================================");
			}).catch(error => {
				projectSchedulerRunning = 0;
				console.log("\nProject scheduler response : " + error);
				console.log("\nProject scheduler end");
				console.log("\n==================================================");
			});
	}

	function publicScheduler() {
		if (projectSchedulerRunning == 0) {
			console.log("\nProject scheduler start");
			projectScheduler();
		} else {
			console.log("\nProject scheduler running");
			console.log("\n==================================================");
		}
	}

	function removeInOutHistories() {
		axios.get(config.domain + "/inbound_history/deleteall/3")
			.then(response => {
				console.log("\nDelete inbound history scheduler response : " + JSON.stringify(response.data));
			}).catch(error => {
				console.error("\nDelete inbound history scheduler response : " + error);
			});
		axios.get(config.domain + "/outbound_history/deleteall/3")
			.then(response => {
				console.log("\nDelete outbound history scheduler response : " + JSON.stringify(response.data));
			}).catch(error => {
				console.error("\nDelete outbound history scheduler response : " + error);
			});
	}

	function removeLogHistories() {
		axios.get(config.domain + "/logs/deleteall/3")
			.then(response => {
				console.log("\nDelete log history scheduler response : " + JSON.stringify(response.data));
			}).catch(error => {
				console.error("\nDelete log history scheduler response : " + error);
			});
	}

	function updateRunningItem() {
		axios.get(config.domain + "/project/item/running/updatemany")
			.then(response => {
				// console.log("\nRunning item update scheduler response : " + JSON.stringify(response.data));
			}).catch(error => {
				// console.error("\nRunning item update scheduler response : " + error);
			});
	}

	if (!fs.existsSync(outputDir)) {
		fs.mkdirSync(outputDir);
	}

	if (!fs.existsSync(logDir)) {
		fs.mkdirSync(logDir);
	}

	if (!fs.existsSync(inboundDir)) {
		fs.mkdirSync(inboundDir);
	}

	if (!fs.existsSync(historyDir)) {
		fs.mkdirSync(historyDir);
	}

	if (!fs.existsSync(historyInboundDir)) {
		fs.mkdirSync(historyInboundDir);
	}

	if (!fs.existsSync(historyOutboundDir)) {
		fs.mkdirSync(historyOutboundDir);
	}

	if (!fs.existsSync(historyConvertfailDir)) {
		fs.mkdirSync(historyConvertfailDir);
	}

	if (!fs.existsSync(historyTimeoutDir)) {
		fs.mkdirSync(historyTimeoutDir);
	}

	if (!fs.existsSync(sendingDir)) {
		fs.mkdirSync(sendingDir);
	}

	process.on("uncaughtException", async function (err) {
		const pageUrl = lastRequestUrl;
		const stack = err.stack;
		const stackLines = stack.split("\n");
		const statusCode = err.statusCode || 500;

		let functionName = "", filePath = "", lineNumber = "", columnNumber = "";
		let errorInfo = `Error message: ${err.message}`;

		for (let i = 1; i < stackLines.length; i++) {
			if (stackLines[i].includes("node_modules") || stackLines[i].includes("node:")) continue;

			const match = stackLines[i].match(/at (.+?) \((.*):(\d+):(\d+)\)/);
			if (match) {
				functionName = match[1];
				filePath = match[2];
				lineNumber = match[3];
				columnNumber = match[4];
				break;
			}
		}

		if (filePath) {
			errorInfo = `Error occurred in file: ${filePath}`;

			if (lineNumber) {
				errorInfo += `, at line: ${lineNumber}`;

				if (columnNumber) {
					errorInfo += `, column: ${columnNumber}`;
				}
			}
		}

		console.error("\n=== Start cluster err ===");
		await exceptionErrorStore(pageUrl, functionName, errorInfo, filePath, statusCode, config.userName, config.companyCode);
		console.error(`Error message : ${err.message}`);
		console.error(err);
		console.error("=== End cluster err ===\n");

		process.exit(1);
	});
}

module.exports = app;
