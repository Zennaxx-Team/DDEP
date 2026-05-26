const fs = require("fs").promises;
const path = require("path");
const mongoose = require("mongoose");
const tblAppErrorConfigsModel = require("../models/tbl_app_error_configs.model");
const tblAppErrorsModel = require("../models/tbl_app_errors.model");

async function initErrorConfig() {
	try {
		const data = await tblAppErrorConfigsModel.find();
		if (data.length === 0) {
			const config = new tblAppErrorConfigsModel({ Config_Cleanup_days: "7", Config_Last_date: "" });
			await config.save();
		}
	} catch (err) {
		console.error("Error initializing error config:", err);
	}
}

async function databaseConnectError(page, function_name, developer, error_description) {
	const filepath = "./output/logs/";

	try {
		await fs.mkdir(filepath, { recursive: true });
	} catch (err) {
		console.error("Failed to create directory:", err);
		return;
	}

	const currentDate = new Date();
	const formattedDate = formatDate(currentDate, "log");
	const filename = `${formattedDate}.log`;

	const content = `[${currentDate}] - [${page}] > [${function_name}] > [${developer}] > ${error_description}`;

	const fullFilePath = path.join(filepath, filename);

	try {
		if (await fileExists(fullFilePath)) {
			await fs.appendFile(fullFilePath, `\n${content}`, handleFsError);
		} else {
			await fs.writeFile(fullFilePath, content, handleFsError);
		}
	} catch (err) {
		console.error("Failed to write to log file:", err);
	}
}

async function fileExists(filePath) {
	try {
		await fs.access(filePath);
		return true;
	} catch (err) {
		return false;
	}
}

async function checkDBConnection() {
	if (mongoose.connection.readyState === 1) {
		// console.log("MongoDB connected.");
	} else {
		// console.log("MongoDB not connected.");
	}
}

async function exceptionErrorStore(error_page, error_module, error_info, error_url, error_http_status_code, error_username, error_company_code) {
	try {
		const currentDate = new Date();
		const formattedDateTime = formatDate(currentDate, "datetime");

		checkDBConnection();
		const lastError = await tblAppErrorsModel.find().sort({ createdAt: -1 }).limit(1);

		const error_id = lastError && lastError[0]?.Error_ID ? parseInt(lastError[0].Error_ID, 10) + 1 : 1;

		const app_error = new tblAppErrorsModel({
			Error_ID: error_id,
			Error_Datetime: formattedDateTime,
			Error_Page: error_page || "",
			Error_Module: error_module || "",
			Error_Info: error_info || "",
			Error_URL: error_url || "",
			Error_HTTP_status_code: error_http_status_code || "",
			Error_Username: error_username || "",
			Error_Companycode: error_company_code || ""
		});

		const createdError = await app_error.save();
	} catch (err) {
		console.error("Error storing exception:", err);
	}
}

async function logFileCleanUp() {
	try {
		const filepath = "./output/logs/";
		if (await fileExists(filepath)) {
			const files = fs.readdirSync(filepath);
			let days = 7;
			const config = await tblAppErrorConfigsModel.findOne();
			if (config) {
				days = config.Config_Cleanup_days;
			}
			const now = Date.now();
			const cleanMilliseconds = 86400000 * days; // 1 day in milliseconds

			files.forEach(file => {
				const filePath = path.join(filepath, file);
				const stat = fs.statSync(filePath);
				const fileCreationTime = new Date(stat.ctime).getTime();

				if (now - fileCreationTime > cleanMilliseconds) {
					fs.unlink(filePath, (err) => {
						if (err) return console.error("Error deleting file:", err);
						console.log(`Successfully deleted ${file}`);
					});
				}
			});
		}
	} catch (err) {
		console.error("Error during log file cleanup:", err);
	}
}

function formatDate(date, formatType) {
	const year = date.getFullYear();
	const month = (date.getMonth() + 1).toString().padStart(2, "0");
	const day = date.getDate().toString().padStart(2, "0");
	const hours = date.getHours().toString().padStart(2, "0");
	const minutes = date.getMinutes().toString().padStart(2, "0");
	const seconds = date.getSeconds().toString().padStart(2, "0");

	if (formatType === "log") {
		return `${day}_${month}_${year}`;
	}
	if (formatType === "datetime") {
		return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
	}
}

function handleFsError(err) {
	if (err) {
		console.error("File system error:", err);
	}
}

module.exports = { initErrorConfig, databaseConnectError, checkDBConnection, exceptionErrorStore, logFileCleanUp, formatDate };