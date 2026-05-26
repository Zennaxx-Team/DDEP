const request = require("request");
const xpath = require("xpath");
const xmldom = require("xmldom");
const parseString = require("xml2js").parseString;
const xml2js = require("xml2js");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const nodemailer = require("nodemailer");
const path = require("path");
const Client = require("ftp");
const SFTPClient = require('ssh2-sftp-client');
const { transform } = require("camaro");
const { getGeneralSettings } = require("../my_modules/item_api_functions");
const config = require("../config");
const ase = require("../my_modules/aes");
const axios = require("axios");
const { findMappingProfileHistoryById } = require("../controllers/mapping_profiles.controller");
const { findPartyById } = require("../controllers/parties.controller");
const { inboundMappingHandler, addToLogQueue, inboundFilterHandler, outboundValidationHandler, outboundFilterHandler, outboundMappingHandler, writelog, generateCurlCommand, replacePlaceholders, formulaGetValue, handleOutboundFailure } = require("../common/common");
const { findProject } = require("../controllers/projects.controller");
const { mailQueue } = require("../queues/config/queuesConfigartion.js");
const mailQueueConfig = require('../queues/config/email.config.js');
const { fullItemGet } = require("../controllers/items.controller");
const { updateItemRunning, createItemRunning } = require("../controllers/ItemRunningSetting.controller");
const { findAllLogFullListUniqueIdForFTPlogsFn } = require("../controllers/log_history.controller");
const { getGeneralSetting } = require("../controllers/settings.controller");
const { getNotificationSettings } = require("../controllers/notification.controller");
const { safeJSONWithOutStringify, safeJSONStringify } = require("../my_modules/checkSize");
const { checkItemMonitoring } = require("./monitoring/monitoring.js");
const log_historyModel = require("../models/log_history.model.js");

let globalfilelength = 1;
let globallistfilelength = 1;
let globalsuccess = 1;
let globalmsg = "Execute Outbound Error";
let outboundFormatDataParentKey = [];
let dataArrayReviseParentKey = [];
let dataArrayReviseArr = {}
let filterParentKey = [];
let filterTrueDataKeys = [];
let filterFalseDataKeys = [];
let schedulerUniqueId = "";
let enableLogs = "off";
let enableFullLogs = "off";
let mappingArrayMerged = [];
let afterGlobalLogDescription = [];

async function scheduling(req, res) {
	enableLogs = "off";
	enableFullLogs = "off";

	const todaydate = new Date();
	const logdatefilename = "log_" + todaydate.getDate() + "_" + parseInt(todaydate.getMonth() + 1) + "_" + todaydate.getFullYear() + ".txt";
	const logdir = "./output/log/";

	if (!fs.existsSync(logdir)) {
		fs.mkdirSync(logdir, { recursive: true });
	}

	fs.access(logdir + logdatefilename, fs.constants.F_OK, (err) => {
		if (err) {
			fs.writeFile(logdir + logdatefilename, "==================== Log of Date " + todaydate + " ====================\n", (err) => {
				if (err) {
					console.error("\nError creating log file:", err);
				}
			});
		}
	});

	const milliseconds = (h, m, s) => ((h * 60 * 60 + m * 60 + s) * 1000);

	try {
		const response = await fullItemGet();
		const data = response.data;

		const inpromise = new Promise(async function (resolve, reject) {
			if (response.status !== undefined && response.status === 1) {
				console.log("\nScanning total project start : " + data.length);
				const prelog = "[" + new Date() + "] - [/routers/scheduler_job.js] > [/scheduling] > [keywords]";
				const prelogtest = prelog.replace("keywords", "not defined");
				writelog(logdir + logdatefilename, prelogtest + " > Scanning total project > " + data.length + "\n");

				const itemslistarrreponse = await createitemslistarr(data, logdir, prelog, logdatefilename, milliseconds);

				console.log("\nScanning total project completed : " + data.length);
				resolve();
			} else {
				resolve();
			}
		});

		inpromise.then(() => {
			console.log("\nScheduling API completed successfully");
			return res.send({ message: "Scheduling API Run Completed..." });
		}).catch((err) => {
			console.error("\nScheduling error:", err.message);
			return res.status(500).send({ message: "Scheduling API failed", error: err.message });
		});
	} catch (error) {
		console.log("\nError while getting project fulllist : ", error.message);
		return res.status(500).send({ message: "Error calling full list API", error: error.message });
	}
}

async function getScheduleProjectInfo(req, res) {
	enableLogs = "off";
	enableFullLogs = "off";

	const todaydate = new Date();
	const logdatefilename = "log_" + todaydate.getDate() + "_" + parseInt(todaydate.getMonth() + 1) + "_" + todaydate.getFullYear() + ".txt";
	const logdir = "./output/log/";

	if (!fs.existsSync(logdir)) {
		fs.mkdirSync(logdir, { recursive: true });
	}

	fs.open(logdir + logdatefilename, "r", function (fileExists, file) {
		if (fileExists) {
			fs.writeFile(logdir + logdatefilename, "==================== Log of Date " + todaydate + " ====================\n", (err) => {
			});
		}
	});

	const milliseconds = (h, m, s) => ((h * 60 * 60 + m * 60 + s) * 1000);
	request(config.domain + "/projects/fulllist", async function (error, response, body) {
		const data = JSON.parse(body);
		const inpromise = new Promise(async function (resolve, reject) {
			if (response.statusCode != undefined && response.statusCode == 200) {
				console.log("\nScanning total project start : " + data.data.length);
				const prelog = "[" + new Date() + "] - [/routers/scheduler_job.js] > [/scheduling] > [keywords]";
				const prelogtest = prelog.replace("keywords", "not defined");
				await writelog(logdir + logdatefilename, prelogtest + " > Scanning total project > " + data.data.length + "\n");

				const itemslistarrreponse = await createitemslistarr(data.data, logdir, prelog, logdatefilename, milliseconds);

				console.log("\nScanning total project completed : " + data.data.length);
				resolve();
			} else {
				resolve();
			}
		});

		inpromise.then(function (result) {
			return res.send({ message: "Scheduling API Run Completed..." });
		});
	});
}

function sleep(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function addGlobalMsg(msg) {
	return globalmsg = msg;
}

function addGlobalSuccess(msg) {
	return globalsuccess = msg;
}

function createitemslistarr(data, logdir, prelog, logdatefilename, milliseconds) {
	return new Promise((resolve) => {
		if (data.length > 0) {
			let datacounter = 0;
			(async function () {
				for (let i = 0; i < data.length; i++) {
					schedulerUniqueId = uuidv4();
					await callback(data[i], milliseconds, logdir, prelog, logdatefilename)
					console.log("======== Check Monitoring Rule ========");
					await checkItemMonitoring(data[i], schedulerUniqueId, data[i].CompanyCode);
				};
			})().then((v) => {
				resolve({ status: 1, response: "" });
			});
		} else {
			console.log("\nNo project found in list");
			resolve({ status: 0, response: "" });
		}
	});
}

function callback(item, milliseconds, logdir, prelog, logdatefilename) {
	return new Promise((resolve) => {
		afterGlobalLogDescription = [];
		if (item.schedule_setting != undefined && item.inbound_setting != undefined && item.outbound_setting != undefined && item.isActive == 1) {
			const companyCode = item.CompanyCode;
			enableLogs = "off";
			enableFullLogs = "off";

			(async function (x) {
				return await getGeneralSettings(companyCode);
			})(0).then((logData) => {
				const generalSettings = JSON.parse(logData);
				if (generalSettings != undefined && generalSettings.status != undefined && generalSettings.status == 1) {
					const generalSettingsData = generalSettings?.data?.data[0];
					if (generalSettingsData != undefined && generalSettingsData.enableLogs != undefined && generalSettingsData.enableLogs == "on") {
						enableLogs = generalSettingsData.enableLogs;
					}

					if (generalSettingsData != undefined && generalSettingsData.enableFullLogs != undefined && generalSettingsData.enableFullLogs == "on") {
						enableFullLogs = generalSettingsData.enableFullLogs;
					}
				}

				const todaydate = new Date();
				todaydate.setSeconds(0);
				todaydate.setMilliseconds(0);

				const static_date = new Date();
				static_date.setHours(0);
				static_date.setMinutes(0);
				static_date.setSeconds(0);
				static_date.setMilliseconds(0);

				let current_time_milisecond = parseInt(todaydate.getTime());
				let next_date_milisecond = parseInt(item.schedule_setting.next_date_inbound);
				let next_date_milisecond_outbound = parseInt(item.schedule_setting.next_date_outbound);
				let new_next_date_milisecond = next_date_milisecond;
				let new_next_date_milisecond_outbound = next_date_milisecond_outbound;
				const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
				const outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";
				const scheduleEnableLog = (item.schedule_setting.enableLog != undefined) ? item.schedule_setting.enableLog : "off";

				const inpromise = new Promise(async function (resolve, reject) {
					if ((item.inbound_setting.is_active == "Active" && item.inbound_setting.sync_type != "API") || (item.inbound_setting.is_active == "Active" && item.inbound_setting.sync_type == "API" && item.inbound_setting.api_type != "DDEP_API")) {
						if (item.item_running_setting == undefined || (item.item_running_setting != undefined && item.item_running_setting.is_inbound_running != undefined && item.item_running_setting.is_inbound_running == 0 && item.item_running_setting.is_outbound_running != undefined && item.item_running_setting.is_outbound_running == 0)) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Inbound active setting found : " + item._id });

							console.log("\n==================================================");
							console.log("\nInbound active setting found : " + item._id);
							if (item.schedule_setting.Schedule_configure_inbound != "click_by_user") {
								if (item.schedule_setting.schedule_type_inbound == "Recurring") {
									let end_date = "";
									let end_date_milisecond = "";
									if (item.schedule_setting.duration_inbound_is_end_date == "yes_end_date") {
										if (item.schedule_setting.duration_inbound_end_date != "" && item.schedule_setting.duration_inbound_end_date != undefined) {
											end_date = new Date(item.schedule_setting.duration_inbound_end_date);
											end_date_milisecond = parseInt(end_date.getTime());
											console.log("\nEnd date found in inbound schedule setting");

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check end date", description: "End date found in inbound schedule setting" });
										}
									}

									if (end_date_milisecond == "" || (end_date_milisecond >= next_date_milisecond)) {
										if (new_next_date_milisecond == current_time_milisecond || new_next_date_milisecond <= parseInt(todaydate.getTime()) - 20000) {
											if (item.schedule_setting.occurs_inbound == "daily") {
												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs Once At") {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check run date time", description: "Occers once found in inbound schedule setting" });

													console.log("\nOccers once found in inbound schedule setting");
													const inbound_time = item.schedule_setting.daily_frequency_once_time_inbound;
													const inbound_parts = inbound_time.split(":");
													const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
													new_next_date_milisecond = parseInt(static_date.getTime() + (item.schedule_setting.day_frequency_inbound_count * 24 * 60 * 60 * 1000) + result_inbound);
												}

												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs every") {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check run date time", description: "Occurs every found in inbound schedule setting" });

													console.log("\nOccurs every found in inbound schedule setting");
													const inbound_time = item.schedule_setting.daily_frequency_every_time_count_start_inbound
													const inbound_parts = inbound_time.split(":");
													const result_inbound = milliseconds(inbound_parts[0], inbound_parts[1], 0);
													const inbound_time_end = item.schedule_setting.daily_frequency_every_time_count_end_inbound;
													const inbound_end_parts = inbound_time_end.split(":");
													const result_inbound_end = milliseconds(inbound_end_parts[0], inbound_end_parts[1], 0);
													const inbuond_end_time_final = parseInt(static_date.getTime() + result_inbound_end);
													console.log("\nInbuond end time final : " + inbuond_end_time_final);

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "New end date time", description: "Inbound end time final : " + inbuond_end_time_final });

													if (new_next_date_milisecond <= inbuond_end_time_final) {
														if (item.schedule_setting.daily_frequency_every_time_unit_inbound == "hour") {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Hour", description: "Occurs every hour found in inbound schedule setting" });

															console.log("\nOccurs every hour found in inbound schedule setting");
															const prelogtest = prelog.replace("keywords", "not defined");
															await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Occurs every hour found in inbound schedule setting]\n");
															const hourInterval = parseInt(item.schedule_setting.daily_frequency_every_time_count_inbound);
															if ((new_next_date_milisecond + hourInterval * 60 * 60 * 1000) >= inbuond_end_time_final) {
																new_next_date_milisecond = parseInt(static_date.getTime() + item.schedule_setting.day_frequency_inbound_count * 24 * 60 * 60 * 1000) + result_inbound;
															} else {
																new_next_date_milisecond = parseInt(todaydate.getTime() + (item.schedule_setting.daily_frequency_every_time_count_inbound * 60 * 60 * 1000));
															}
														} else {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Minutes", description: "Occurs every minute found in inbound schedule setting" });

															console.log("\nOccurs every minute found in inbound schedule setting");
															const prelogtest = prelog.replace("keywords", "not defined");
															await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Occurs every minute found in inbound schedule setting]\n");
															const minuteInterval = parseInt(item.schedule_setting.daily_frequency_every_time_count_inbound);
															if ((new_next_date_milisecond + minuteInterval * 60 * 1000) >= inbuond_end_time_final) {
																new_next_date_milisecond = parseInt(static_date.getTime() + item.schedule_setting.day_frequency_inbound_count * 24 * 60 * 60 * 1000) + result_inbound;
															} else {
																new_next_date_milisecond = parseInt(todaydate.getTime() + (item.schedule_setting.daily_frequency_every_time_count_inbound * 60 * 1000));
															}
														}
													} else {
														new_next_date_milisecond = static_date.getTime() + (item.schedule_setting.day_frequency_inbound_count * 24 * 60 * 60 * 1000) + result_inbound;
													}
												}
											}

											if (item.schedule_setting.occurs_inbound == "monthly") {
												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs Once At") {
												}
												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs every") {
												}
											}

											if (item.schedule_setting.occurs_inbound == "weekly") {
												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs Once At") {
												}
												if (item.schedule_setting.daily_frequency_type_inbound == "Occurs every") {
												}
											}

											item.schedule_setting.next_date_inbound = new_next_date_milisecond.toString();

											if (item.inbound_setting.item_id != undefined && item.inbound_setting.item_id != "") {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Run", description: "Inbound run for project : " + item._id });

												console.log("\nInbound run for project : " + item._id);

												try {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Data", description: "Get data and run inbound" });

													console.log("\nGet data and run inbound");

													(async function () {
														return await inboundrun(companyCode, item, logdir, logdatefilename);
													})().then((inboundResult) => {
														addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule" });

														console.log("\nEnd inbound schedule");
														console.log("\n==================================================");
														resolve(inboundResult);
													});
												} catch (err) {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Run", description: "End inbound schedule with error catch : " + err, exception_type: "System Error", item: item.ItemName, detail_exception: "End inbound schedule with error catch : " + err });

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule with error catch : " + err });

													console.log("\nInbound run error catch : " + err);
													console.log("\nEnd inbound schedule");
													console.log("\n==================================================");
													resolve();
												}
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule" });

												console.log("\nEnd inbound schedule");
												console.log("\n==================================================");
												resolve();
											}
										} else {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Current time does not match with inbound schedule setting! Inbound schedule time is " + new Date(parseInt(new_next_date_milisecond)).toString() + " and Current time is " + new Date(parseInt(current_time_milisecond)).toString() });

											const prelogtest = prelog.replace("keywords", "not defined");
											await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Current time does not match with inbound schedule setting]\n");
											console.log("\nCurrent time does not match with inbound schedule setting");
											console.log("\nInbound next schedule time is " + new Date(parseInt(new_next_date_milisecond)).toString());
											console.log("\nCurrent time is " + new Date(parseInt(current_time_milisecond)).toString());
											console.log("\nInbound next schedule time in milliseconds is " + new_next_date_milisecond);
											console.log("\nCurrent time in milliseconds is " + current_time_milisecond);
											console.log("\nEnd inbound schedule");
											console.log("\n==================================================");

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule" });

											resolve();
										}
									} else {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Current date does not match with inbound schedule setting end date" });

										console.log("\nCurrent date does not match with inbound schedule setting end date");
										console.log("\nEnd inbound schedule");
										console.log("\n==================================================");
										resolve();
									}
								} else {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule with schedule type is one time" });

									console.log("\nEnd inbound schedule");
									console.log("\n==================================================");
									resolve();
								}
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End inbound schedule with type is click by user" });

								console.log("\nEnd inbound schedule");
								console.log("\n==================================================");
								resolve();
							}
						} else {
							if (item.item_running_setting != undefined && item.item_running_setting.is_inbound_running != undefined && item.item_running_setting.is_inbound_running == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Currently this item inbound running" });

								const prelogtest = prelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Currently this item inbound running" + "\n");
							}

							if (item.item_running_setting != undefined && item.item_running_setting.is_outbound_running != undefined && item.item_running_setting.is_outbound_running == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Currently this item outbound running" });

								const prelogtest = prelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Currently this item outbound running" + "\n");
							}

							resolve();
						}
					} else {
						resolve();
					}
				});

				inpromise.then(async function (result) {
					const inboundResult = result;
					if (item.outbound_setting.is_active == "Active" && item.inbound_setting.sync_type != "API") {
						if (item.item_running_setting == undefined || (item.item_running_setting != undefined && item.item_running_setting.is_inbound_running != undefined && item.item_running_setting.is_inbound_running == 0 && item.item_running_setting.is_outbound_running != undefined && item.item_running_setting.is_outbound_running == 0)) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Outbound active setting found : " + item._id });

							console.log("\n==================================================");
							console.log("\nOutbound active setting found : " + item._id);

							if (item.schedule_setting.Schedule_configure_outbound != "click_by_user") {
								if (item.schedule_setting.schedule_type_outbound == "Recurring") {
									let end_date = "";
									let end_date_milisecond = "";
									if (item.schedule_setting.duration_outbound_is_end_date == "yes_end_date") {
										if (item.schedule_setting.duration_outbound_end_date != "" && item.schedule_setting.duration_outbound_end_date != undefined) {
											end_date = new Date(item.schedule_setting.duration_outbound_end_date);
											end_date_milisecond = parseInt(end_date.getTime());
											console.log("\nEnd date found in outbound schedule setting");

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check end date", description: "End date found in outbound schedule setting" });
										}
									}

									if (end_date_milisecond == "" || (end_date_milisecond >= next_date_milisecond_outbound)) {
										if (new_next_date_milisecond_outbound == current_time_milisecond || new_next_date_milisecond_outbound <= parseInt(todaydate.getTime()) - 20000) {
											if (item.schedule_setting.occurs_outbound == "daily") {
												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs Once At") {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check run date time", description: "Occers once found in outbound schedule setting" });

													console.log("\nOccers once found in outbound schedule setting");
													const outbound_time = item.schedule_setting.daily_frequency_once_time_outbound;
													const outbound_parts = outbound_time.split(":");
													const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
													new_next_date_milisecond_outbound = parseInt(static_date.getTime() + (item.schedule_setting.day_frequency_outbound_count * 24 * 60 * 60 * 1000) + result_outbound);
												}

												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs every") {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check run date time", description: "Occurs every found in outbound schedule setting" });

													console.log("\nOccurs every found in outbound schedule setting");
													const outbound_time = item.schedule_setting.daily_frequency_every_time_count_start_outbound
													const outbound_parts = outbound_time.split(":");
													const result_outbound = milliseconds(outbound_parts[0], outbound_parts[1], 0);
													const outbound_time_end = item.schedule_setting.daily_frequency_every_time_count_end_outbound;
													const outbound_end_parts = outbound_time_end.split(":");
													const result_outbound_end = milliseconds(outbound_end_parts[0], outbound_end_parts[1], 0);
													const outbuond_end_time_final = parseInt(static_date.getTime() + result_outbound_end);
													console.log("\nOutbuond end time final => " + outbuond_end_time_final);

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "New end date time", description: "Outbuond end time final : " + outbuond_end_time_final });

													if (new_next_date_milisecond_outbound <= outbuond_end_time_final) {
														if (item.schedule_setting.daily_frequency_every_time_unit_outbound == "hour") {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Hour", description: "Ocurs every hour found in outbound schedule setting" });

															console.log("\nOcurs every hour found in outbound schedule setting");
															const prelogtest = prelog.replace("keywords", "not defined");
															await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Ocurs every hour found in outbound schedule setting]\n");

															if ((new_next_date_milisecond_outbound + item.schedule_setting.daily_frequency_every_time_count_outbound * 60 * 60 * 1000) >= outbuond_end_time_final) {
																new_next_date_milisecond_outbound = parseInt(static_date.getTime() + (item.schedule_setting.day_frequency_outbound_count * 24 * 60 * 60 * 1000) + result_outbound);
															} else {
																new_next_date_milisecond_outbound = parseInt(todaydate.getTime() + (item.schedule_setting.daily_frequency_every_time_count_outbound * 60 * 60 * 1000));
															}
														} else {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Minutes", description: "Ocurs every minute found in outbound schedule setting" });

															console.log("\nOcurs every minute found in outbound schedule setting");
															const prelogtest = prelog.replace("keywords", "not defined");
															await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Ocurs every minute found in outbound schedule setting]\n");

															if ((new_next_date_milisecond_outbound + item.schedule_setting.daily_frequency_every_time_count_outbound * 60 * 1000) >= outbuond_end_time_final) {
																new_next_date_milisecond_outbound = parseInt(static_date.getTime() + item.schedule_setting.day_frequency_outbound_count * 24 * 60 * 60 * 1000) + result_outbound;
															} else {
																new_next_date_milisecond_outbound = parseInt(todaydate.getTime() + (item.schedule_setting.daily_frequency_every_time_count_outbound * 60 * 1000));
															}
														}
													} else {
														new_next_date_milisecond_outbound = next_date_milisecond + (item.schedule_setting.day_frequency_outbound_count * 24 * 60 * 60 * 1000);
													}
												}
											}

											if (item.schedule_setting.occurs_outbound == "monthly") {
												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs Once At") {
												}
												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs every") {
												}
											}

											if (item.schedule_setting.occurs_outbound == "weekly") {
												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs Once At") {
												}
												if (item.schedule_setting.daily_frequency_type_outbound == "Occurs every") {
												}
											}

											item.schedule_setting.next_date_outbound = new_next_date_milisecond_outbound.toString();

											if (item.outbound_setting.item_id != undefined && item.outbound_setting.item_id != "") {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Run", description: "Outbound run for project : " + item._id });

												console.log("\nOutbound run for project : " + item._id);

												try {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Data", description: "Get data and run outbound" });

													console.log("\nGet data and run outbound");

													(async function () {
														return await outboundrun(companyCode, item, logdir, logdatefilename, inboundResult, afterGlobalLogDescription);
													})().then((v) => {
														addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End outbound schedule" });

														console.log("\nEnd outbound schedule");
														console.log("\n==================================================");

														resolve({ code: "1", response: "" });
													});
												} catch (err) {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: "End outbound schedule with error catch : " + err, exception_type: "System Error", item: item.ItemName, detail_exception: "End outbound schedule with error catch : " + err });

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End outbound schedule with error catch : " + err });

													console.log("\nOutbound run error catch : " + err);
													console.log("\nEnd outbound schedule");
													console.log("\n==================================================");

													resolve({ code: "1", response: "" });
												}
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End outbound schedule" });

												console.log("\nEnd outbound schedule");
												console.log("\n==================================================");

												resolve({ code: "1", response: "" });
											}
										} else {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Current time does not match with outbound schedule setting! Outbound schedule time is " + new Date(parseInt(new_next_date_milisecond_outbound)).toString() });

											const prelogtest = prelog.replace("keywords", "not defined");
											await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Current time does not match with outbound schedule setting]\n");
											console.log("\nCurrent time does not match with outbound schedule setting");
											console.log("\nOutbound next schedule time is " + new Date(parseInt(new_next_date_milisecond_outbound)).toString());
											console.log("\nCurrent time is " + new Date(parseInt(current_time_milisecond)).toString());
											console.log("\nOutbound next schedule time in milliseconds is " + new_next_date_milisecond_outbound);
											console.log("\nCurrent time in milliseconds is " + new Date(parseInt(current_time_milisecond)).toString());
											console.log("\nEnd outbound schedule");
											console.log("\n==================================================");

											resolve({ code: "1", response: "" });
										}
									} else {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Current date does not match with outbound schedule setting end date" });

										console.log("\nCurrent date does not match with outbound schedule setting end date");
										console.log("\nEnd outbound schedule");
										console.log("\n==================================================");

										resolve({ code: "1", response: "" });
									}
								} else {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End outbound schedule with schedule type is one time" });

									console.log("\nEnd outbound schedule");
									console.log("\n==================================================");

									resolve({ code: "1", response: "" });
								}
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "End outbound schedule with type is click by user" });

								console.log("\nEnd outbound schedule");
								console.log("\n==================================================");

								resolve({ code: "1", response: "" });
							}
						} else {
							if (item.item_running_setting != undefined && item.item_running_setting.is_inbound_running != undefined && item.item_running_setting.is_inbound_running == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Currently this item inbound running" });

								const prelogtest = prelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Currently this item inbound running" + "\n");
							}

							if (item.item_running_setting != undefined && item.item_running_setting.is_outbound_running != undefined && item.item_running_setting.is_outbound_running == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "End", description: "Currently this item outbound running" });

								const prelogtest = prelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Currently this item outbound running" + "\n");
							}

							resolve({ code: "1", response: "" });
						}
					} else {
						resolve({ code: "1", response: "" });
					}
				});
			});
		} else {
			resolve({ code: "1", response: "" });
		}
	});
}

async function inboundrun(companyCode, item, logdir, logdatefilename) {
	return new Promise(async (resolve) => {
		const Aes = new ase();
		const item_id = item._id;
		const ItemName = item.ItemName;
		const item_code = item.ItemCode;
		const companyCode = item.CompanyCode;
		const todaydate = new Date();
		const inboundprelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/inboundrun] > [keywords] > [Project Id] > " + item_id + " > ";

		item.inbound_setting.CompanyCode = (item.inbound_setting.CompanyCode == undefined) ? companyCode : item.inbound_setting.CompanyCode;
		const inboundSettingData = item.inbound_setting;
		const inbound_format = inboundSettingData.inbound_format;
		let inboundFilterData = item.inbound_filter;
		let propertiesSettingData = item.items_props;
		let mappingSettingData = item.mapping_setting;
		let outboundValidationSettingData = item.outbound_validation;
		let outboundSettingData = item.outbound_setting;
		let outboundFilterData = item.outbound_filter;
		let propertiesOutboundSettingData = item.items_prop_outbounds;
		let mappingOutboundSettingData = item.mapping_outbound_setting;
		const itemRunningSettingData = item.item_running_setting;
		const inboundEnableLog = (inboundSettingData.enableLog != undefined) ? inboundSettingData.enableLog : "off";
		const outboundEnableLog = (outboundSettingData.enableLog != undefined) ? outboundSettingData.enableLog : "off";

		let isRunningDataId = "";
		if (itemRunningSettingData != undefined && itemRunningSettingData.is_inbound_running != undefined && itemRunningSettingData.is_inbound_running == 0) {
			isRunningDataId = itemRunningSettingData._id;
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start inbound" });

		let prelogtest = inboundprelog.replace("keywords", "startinbound");
		await writelog(logdir + logdatefilename, prelogtest + item_id + "\n");

		if (inboundSettingData.sync_type == "FTP" || inboundSettingData.sync_type == "SFTP") {
			(async function (x) {
				return await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "1", "0");
			})(0).then(async (itemrundata) => {
				let prelogtest = inboundprelog.replace("keywords", "startinbound");
				await writelog(logdir + logdatefilename, prelogtest + "itemrundata" + " : " + itemrundata + "\n");
				if (itemrundata.status === 1 && isRunningDataId === "") {
					isRunningDataId = itemrundata.id;
				}
			});

			const max_file_download = (inboundSettingData.max_file_download == undefined && inboundSettingData.max_file_download != 0) ? 50 : inboundSettingData.max_file_download;
			const inbounddir = "./output/inbounds";

			const itemdir = item_id;
			if (!fs.existsSync(inbounddir + "/" + itemdir)) {
				fs.mkdirSync(inbounddir + "/" + itemdir);
			}

			const folderpath = inboundSettingData.ftp_folder;
			let backup_folder = inboundSettingData.ftp_backup_folder
			if (backup_folder == "" || backup_folder == undefined) {
				backup_folder = "backup";
			}

			if (inboundSettingData.sync_type == "FTP") {
				console.log(Aes.Decrypt(inboundSettingData.ftp_password), "Aes.Decrypt(inboundSettingData.ftp_password)")
				const settings = {
					host: inboundSettingData.ftp_server_link,
					user: inboundSettingData.ftp_login_name,
					password: Aes.Decrypt(inboundSettingData.ftp_password),
					port: inboundSettingData.ftp_port,
					secure: false,
					connTimeout: 36000000,
					pasvTimeout: 36000000,
					keepalive: 36000000,
					autoReconnect: true,
					preserveCwd: true
				}

				const ftp = new Client();
				try {
					prelogtest = inboundprelog.replace("keywords", "not defined");
					await writelog(logdir + logdatefilename, prelogtest + "Below FTP Details Found in this project" + "\n");
					await writelog(logdir + logdatefilename, prelogtest + "connecting FTP with below detail\n");
					await writelog(logdir + logdatefilename, prelogtest + "host : " + settings.host + "\n");
					await writelog(logdir + logdatefilename, prelogtest + "username : " + settings.user + "\n");
					await writelog(logdir + logdatefilename, prelogtest + "folder path : " + folderpath + "\n");

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start FTP", path: folderpath });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Entrypoint Get", description: `${inboundSettingData.sync_type}://${settings.host}:${settings.port}` });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connecting", description: "Inbound FTP connecting" });

					prelogtest = inboundprelog.replace("keywords", "ftpconnected");
					await writelog(logdir + logdatefilename, prelogtest + "Connecting with FTP..." + "\n");

					ftp.on("ready", function () {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connected", description: "Inbound FTP connected" });

						ftp.mkdir(folderpath + "/" + backup_folder, async function (err) {
							if (err) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Backup", description: "Backup folder founded" });

								console.log("\nBackup folder founded");
								prelogtest = inboundprelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Backup folder founded in FTP" + "\n");
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Backup", description: "Backup folder created" });

								console.log("\nBackup folder created");
								prelogtest = inboundprelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Backup folder Created in FTP" + "\n");
							}
						});

						ftp.list(folderpath, async function (err, list) {
							if (err) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Error while getting files list : " + err });

								console.log("\nError while getting files list : " + err);
								prelogtest = inboundprelog.replace("keywords", "not defined");
								await writelog(logdir + logdatefilename, prelogtest + "Error while getting files list : " + err + "\n");

								(async function (x) {
									const result = { Status: 1, Msg: "Error while getting files list : " + err, Data: [] };
									const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
									return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 0, filescounter = 0, totaldownload = 0, inboundSettingData.sync_type);
								})(0).then((v) => {
									ftp.on("close", async function (hadErr) {
										if (hadErr) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "Error while closing FTP" });

											console.log("\nError while closing FTP");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											await writelog(logdir + logdatefilename, prelogtest + "Error while closing FTP" + "\n");
										} else {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "FTP close Successful" });

											console.log("\nFTP close Successful");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											await writelog(logdir + logdatefilename, prelogtest + "FTP close Successful" + "\n");
										}
									});

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Getting files list", description: "Error while getting files list : " + err });

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

									ftp.destroy();
									ftp.end();

									resolve({ isRunningDataId });
								});
							} else {
								if (list.length <= 0) {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "File does not found in FTP folder path" });

									console.log("\nFile does not found in FTP folder path");
									prelogtest = inboundprelog.replace("keywords", "not defined");
									await writelog(logdir + logdatefilename, prelogtest + "File does not found in FTP folder path" + "\n");
								}

								list = list.filter((file) => file.type === "-");

								globallistfilelength = (max_file_download != undefined && max_file_download != 0 && max_file_download < list.length) ? max_file_download : list.length;

								let name = [];
								let fileSize = [];
								let itemscounter = [];
								let indexcounter = 0;
								let filescounter = 0;
								let filefailcounter = 0;
								let filedownloadcounter = 0;
								let filebackupcounter = 0;
								let fileothertypecounter = 0;
								let ressendjsoncounter = 0;

								const looplistlength = (max_file_download != undefined && max_file_download < list.length) ? max_file_download : list.length;

								let folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Check FTP Total Files", description: "Scan FTP Total Files : " + looplistlength });

								for (let index = 0; index < looplistlength; index++) {
									itemscounter[index] = [];
									indexcounter = index + 1;
									if (list[index].type === "-") {
										list[index].name = Buffer.from(list[index].name, "binary").toString("utf8");
										let fileText = getFileText(list[index].name.split('.').pop().toLowerCase());
										let date_ob = todaydate;
										let date = ("0" + date_ob.getDate()).slice(-2);
										let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
										let year = date_ob.getFullYear();
										let hours = date_ob.getHours();
										let minutes = date_ob.getMinutes();
										let seconds = date_ob.getSeconds();
										let milliseconds = date_ob.getMilliseconds();
										name[index] = list[index].name.split(".").slice(0, -1).join(".") + "_" + year + month + date + hours + minutes + seconds + milliseconds;
										fileSize[index] = (list[index].size / 1024).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];

										try {
											filescounter++;
											itemscounter[index]["filedownload"] = (itemscounter[index]["filedownload"] != undefined) ? itemscounter[index]["filedownload"] : 0;
											itemscounter[index]["filebackup"] = (itemscounter[index]["filebackup"] != undefined) ? itemscounter[index]["filebackup"] : 0;
											itemscounter[index]["filename"] = list[index].name;
											itemscounter[index]["newfilename"] = name[index];

											const inboundfiledownloadmoveresponse = await inboundfiledownloadmoveforFtp(companyCode, ftp, folderpath, list[index].name, itemscounter[index]["filedownload"], inboundprelog, logdir, logdatefilename, name[index], index, inbounddir, itemdir, filedownloadcounter, backup_folder, filebackupcounter, itemscounter[index]["filebackup"], item_id, fileSize[index], item);

											if (inboundfiledownloadmoveresponse.code == "0") {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Response FTP timeout : " + inboundfiledownloadmoveresponse.response });

												console.log("\nResponse FTP timeout : " + inboundfiledownloadmoveresponse.response);
												prelogtest = inboundprelog.replace("keywords", "not defined");
												await writelog(logdir + logdatefilename, prelogtest + "Response FTP Timeout : " + inboundfiledownloadmoveresponse.response + "\n");
											}

											itemscounter[index]["filedownload"] = inboundfiledownloadmoveresponse.itemscounterindexfiledownload;
											itemscounter[index]["filebackup"] = inboundfiledownloadmoveresponse.itemscounterindexfilebackup;
											filedownloadcounter = inboundfiledownloadmoveresponse.filedownloadcounter;
											filebackupcounter = inboundfiledownloadmoveresponse.filebackupcounter;

											if ((index + 1) >= looplistlength) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + ((filedownloadcounter + 1) - fileothertypecounter) });

												folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

												prelogtest = inboundprelog.replace("keywords", "ftpdownloaded");
												await writelog(logdir + logdatefilename, prelogtest + "Total files download completed : " + ((filedownloadcounter + 1) - fileothertypecounter) + "\n");

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) });

												prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
												await writelog(logdir + logdatefilename, prelogtest + "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) + "\n");

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: `${fileText} files saved in inbound successfully` });

												console.log(`\n${fileText} files saved in inbound successfully`);
												prelogtest = inboundprelog.replace("keywords", "not defined");
												await writelog(logdir + logdatefilename, prelogtest + `${fileText} files saved in inbound successfully` + "\n");

												(async function () {
													const downloadtotal = (filedownloadcounter + 1) - fileothertypecounter;
													await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
													await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, downloadtotal, inboundSettingData.sync_type);

													await new Promise((resolveClose, rejectClose) => {
														ftp.on("close", async function (hadErr) {
															if (hadErr) {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "Error while closing FTP" });

																console.log("\nError while closing FTP");
																prelogtest = inboundprelog.replace("keywords", "not defined");
																await writelog(logdir + logdatefilename, prelogtest + "Error while closing FTP" + "\n");
																rejectClose(new Error("FTP close encountered an error."));
															} else {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "FTP close Successful" });

																console.log("\nFTP close Successful");
																prelogtest = inboundprelog.replace("keywords", "not defined");
																await writelog(logdir + logdatefilename, prelogtest + "FTP close Successful" + "\n");
																resolveClose();
															}
														});

														ftp.destroy();
														ftp.end();
													});

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

													resolve({ isRunningDataId });
												})();
											}
										} catch (err) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while download file : " + err });

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + folderpath + "/" + list[index].name });

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + err });

											console.log("\nError catch while download file : " + err);
											prelogtest = inboundprelog.replace("keywords", "ftpdownloading-error");
											await writelog(logdir + logdatefilename, prelogtest + "Error catch while download file : " + folderpath + "/" + list[index].name + "\n");
											await writelog(logdir + logdatefilename, prelogtest + err + "\n");

											if ((index + 1) >= looplistlength) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + ((filedownloadcounter + 1) - fileothertypecounter) });

												folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

												prelogtest = inboundprelog.replace("keywords", "ftpdownloaded");
												await writelog(logdir + logdatefilename, prelogtest + "Total files download completed : " + ((filedownloadcounter + 1) - fileothertypecounter) + "\n");

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) });

												prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
												await writelog(logdir + logdatefilename, prelogtest + "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) + "\n");

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: `${fileText} files saved in inbound successfully` });

												console.log(`\ ${fileText} files saved in inbound successfully`);
												prelogtest = inboundprelog.replace("keywords", "not defined");
												await writelog(logdir + logdatefilename, prelogtest + `${fileText} files saved in inbound successfully` + "\n");

												(async function () {
													const downloadtotal = (filedownloadcounter + 1) - fileothertypecounter;
													await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
													await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, downloadtotal, inboundSettingData.sync_type);

													await new Promise((resolveClose, rejectClose) => {
														ftp.on("close", async function (hadErr) {
															if (hadErr) {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "Error while closing FTP" });

																console.log("\nError while closing FTP");
																prelogtest = inboundprelog.replace("keywords", "not defined");
																await writelog(logdir + logdatefilename, prelogtest + "Error while closing FTP" + "\n");
																rejectClose(new Error("FTP close encountered an error."));
															} else {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "FTP close Successful" });

																console.log("\nFTP close Successful");
																prelogtest = inboundprelog.replace("keywords", "not defined");
																await writelog(logdir + logdatefilename, prelogtest + "FTP close Successful" + "\n");
																resolveClose();
															}
														});

														ftp.destroy();
														ftp.end();
													});

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

													resolve({ isRunningDataId });
												})();
											}
										}
									} else {
										fileothertypecounter++;
									}
									indexcounter = index;
								}

								(async function (x) {
									const total = (globallistfilelength + 1) - fileothertypecounter;
									const seconds = (total == 0) ? 2000 : total * 2000;
									const p1 = sleep(seconds);
									return x + await p1;
								})(0).then(async (v) => {
									if (indexcounter == 0) {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + filedownloadcounter });

										(async function (x) {
											folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);
										})();

										prelogtest = inboundprelog.replace("keywords", "ftpdownloaded");
										await writelog(logdir + logdatefilename, prelogtest + "Total Files download Completed : " + filedownloadcounter + "\n");

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + filebackupcounter });

										prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
										await writelog(logdir + logdatefilename, prelogtest + "Total Files backup Completed : " + filebackupcounter + "\n");
									}

									if (filescounter == 0) {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: "File does not found in FTP" });

										console.log("\nFile does not found in FTP");
										prelogtest = inboundprelog.replace("keywords", "not defined");
										await writelog(logdir + logdatefilename, prelogtest + "File does not found in FTP connection close" + "\n");

										(async function (x) {
											const downloadtotal = filedownloadcounter;
											const result = { Status: 0, Msg: "File does not found in FTP!", Data: [] };
											const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
											return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, totaldownload = downloadtotal, inboundSettingData.sync_type);
										})(0).then(async (v) => {
											ftp.on("close", async function (hadErr) {
												if (hadErr) {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "Error while closing FTP" });

													console.log("\nError while closing FTP");
													prelogtest = inboundprelog.replace("keywords", "not defined");
													await writelog(logdir + logdatefilename, prelogtest + "Error while closing FTP" + "\n");
												} else {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "FTP Close", description: "FTP close Successful" });

													console.log("\nFTP close Successful");
													prelogtest = inboundprelog.replace("keywords", "not defined");
													await writelog(logdir + logdatefilename, prelogtest + "FTP close Successful" + "\n");
												}
											});

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

											ftp.destroy();
											ftp.end();

											resolve({ isRunningDataId });
										});
									}
								});
							}
						});
					});
					ftp.connect(settings);
				} catch (err) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connection", description: "Error catch while connection time out : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while connection time out : " + err });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connection", description: "Error catch while connection time out : " + err });

					console.log("\nError catch while connection time out : " + err);
					prelogtest = inboundprelog.replace("keywords", "not defined");
					await writelog(logdir + logdatefilename, prelogtest + "error catch while connection time out : " + err + "\n");

					(async function (x) {
						const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
						return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 0, filescounter = 0, totaldownload = 0, inboundSettingData.sync_type);
					})(0).then(async (v) => {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

						resolve({ isRunningDataId });
					});
				}
			} else {
				const sftpSettings = {
					host: inboundSettingData.ftp_server_link,
					username: inboundSettingData.ftp_login_name,
					password: Aes.Decrypt(inboundSettingData.ftp_password),
					port: inboundSettingData.ftp_port,
					readyTimeout: 36000000,
					keepaliveInterval: 36000000,
				}

				let sftp = new SFTPClient();

				prelogtest = inboundprelog.replace("keywords", "not defined");
				await writelog(logdir + logdatefilename, prelogtest + "Below SFTP Details Found in this project" + "\n");
				await writelog(logdir + logdatefilename, prelogtest + "connecting SFTP with below detail\n");
				await writelog(logdir + logdatefilename, prelogtest + "host : " + sftpSettings.host + "\n");
				await writelog(logdir + logdatefilename, prelogtest + "username : " + sftpSettings.username + "\n");
				await writelog(logdir + logdatefilename, prelogtest + "folder path : " + folderpath + "\n");

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start SFTP", path: folderpath });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Entrypoint Get", description: `${inboundSettingData.sync_type}://${sftpSettings.host}:${sftpSettings.port}` });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connecting", description: "Inbound SFTP connecting" });

				prelogtest = inboundprelog.replace("keywords", "Sftpconnected");
				await writelog(logdir + logdatefilename, prelogtest + "Connecting with SFTP..." + "\n");

				await sftp.connect(sftpSettings);

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Connected", description: "Inbound SFTP connected" });

				try {
					const folderExists = await sftp.exists(folderpath + "/" + backup_folder);

					if (folderExists) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Backup", description: "Backup folder found" });

						console.log("\nBackup folder found");
						prelogtest = inboundprelog.replace("keywords", "not defined");
						await writelog(logdir + logdatefilename, `${prelogtest} Backup folder found in SFTP\n`);
					} else {
						await sftp.mkdir(folderpath + "/" + backup_folder, true);

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Backup", description: "Backup folder created" });

						console.log("\nBackup folder created");
						prelogtest = inboundprelog.replace("keywords", "not defined");
						await writelog(logdir + logdatefilename, `${prelogtest} Backup folder created in SFTP\n`);
					}
				} catch (err) {
					console.error("\nError during backup folder operation:", err.message);
					await writelog(`${logdir}${logdatefilename}`, `Error during backup folder operation: ${err.message}\n`);
				}

				try {
					let list = await sftp.list(folderpath);

					if (list.length <= 0) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "File does not found in FTP folder path" });

						console.log("\nFile does not found in SFTP folder path");
						prelogtest = inboundprelog.replace("keywords", "not defined");
						writelog(logdir + logdatefilename, prelogtest + "File does not found in SFTP folder path" + "\n");
					}

					list = list.filter((file) => file.type === "-");
					globallistfilelength = (max_file_download != undefined && max_file_download != 0 && max_file_download < list.length) ? max_file_download : list.length;

					let name = [];
					let fileSize = [];
					let itemscounter = [];
					let indexcounter = 0;
					let filescounter = 0;
					let filefailcounter = 0;
					let filedownloadcounter = 0;
					let filebackupcounter = 0;
					let fileothertypecounter = 0;
					let ressendjsoncounter = 0;

					const looplistlength = (max_file_download != undefined && max_file_download < list.length) ? max_file_download : list.length;

					let folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: `Check SFTP Total Files`, description: `Scan SFTP Total Files : ` + looplistlength });

					for (let index = 0; index < looplistlength; index++) {
						itemscounter[index] = [];
						indexcounter = index + 1;
						if (list[index].type === "-") {
							list[index].name = Buffer.from(list[index].name, "binary").toString("utf8");
							let fileText = getFileText(list[index].name.split('.').pop().toLowerCase());
							let date_ob = todaydate;
							let date = ("0" + date_ob.getDate()).slice(-2);
							let month = ("0" + (date_ob.getMonth() + 1)).slice(-2);
							let year = date_ob.getFullYear();
							let hours = date_ob.getHours();
							let minutes = date_ob.getMinutes();
							let seconds = date_ob.getSeconds();
							let milliseconds = date_ob.getMilliseconds();
							name[index] = list[index].name.split(".").slice(0, -1).join(".") + "_" + year + month + date + hours + minutes + seconds + milliseconds;
							fileSize[index] = (list[index].size / 1024).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];

							try {
								filescounter++;
								itemscounter[index]["filedownload"] = (itemscounter[index]["filedownload"] != undefined) ? itemscounter[index]["filedownload"] : 0;
								itemscounter[index]["filebackup"] = (itemscounter[index]["filebackup"] != undefined) ? itemscounter[index]["filebackup"] : 0;
								itemscounter[index]["filename"] = list[index].name;
								itemscounter[index]["newfilename"] = name[index];

								const inboundfiledownloadmoveresponse = await inboundfiledownloadmoveForSftp(companyCode, sftp, folderpath, list[index].name, itemscounter[index]["filedownload"], inboundprelog, logdir, logdatefilename, name[index], index, inbounddir, itemdir, filedownloadcounter, backup_folder, filebackupcounter, itemscounter[index]["filebackup"], item_id, fileSize[index], item);

								if (inboundfiledownloadmoveresponse.code == "0") {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Response SFTP timeout : " + inboundfiledownloadmoveresponse.response });

									console.log("\nResponse FTP timeout : " + inboundfiledownloadmoveresponse.response);
									prelogtest = inboundprelog.replace("keywords", "not defined");
									writelog(logdir + logdatefilename, prelogtest + "Response SFTP Timeout : " + inboundfiledownloadmoveresponse.response + "\n");
								}

								itemscounter[index]["filedownload"] = inboundfiledownloadmoveresponse.itemscounterindexfiledownload;
								itemscounter[index]["filebackup"] = inboundfiledownloadmoveresponse.itemscounterindexfilebackup;
								filedownloadcounter = inboundfiledownloadmoveresponse.filedownloadcounter;
								filebackupcounter = inboundfiledownloadmoveresponse.filebackupcounter;

								if ((index + 1) >= looplistlength) {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + ((filedownloadcounter + 1) - fileothertypecounter) });

									folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

									prelogtest = inboundprelog.replace("keywords", "sftpdownloaded");
									writelog(logdir + logdatefilename, prelogtest + "Total files download completed : " + ((filedownloadcounter + 1) - fileothertypecounter) + "\n");

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) });

									prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
									writelog(logdir + logdatefilename, prelogtest + "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) + "\n");

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: `${fileText} files saved in inbound successfully` });

									console.log(`\n${fileText} files saved in inbound successfully`);
									prelogtest = inboundprelog.replace("keywords", "not defined");
									writelog(logdir + logdatefilename, prelogtest + `${fileText} files saved in inbound successfully` + "\n");

									(async function () {
										const downloadtotal = (filedownloadcounter + 1) - fileothertypecounter;
										await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
										await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, downloadtotal, inboundSettingData.sync_type);

										try {
											await sftp.end();
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "SFTP close Successful" });

											console.log("\nSFTP close Successful");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogtest + "SFTP close Successful" + "\n");
										} catch (err) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "Error while closing SFTP" });

											console.log("\nError while closing SFTP");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogtest + "Error while closing SFTP" + "\n");
										}


										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });
										sftp.end();

										resolve({ isRunningDataId });
									})();
								}
							} catch (err) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while download file : " + err });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + folderpath + "/" + list[index].name });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch while download file : " + err });

								console.log("\nError catch while download file : " + err);
								prelogtest = inboundprelog.replace("keywords", "ftpdownloading-error");
								writelog(logdir + logdatefilename, prelogtest + "Error catch while download file : " + folderpath + "/" + list[index].name + "\n");
								writelog(logdir + logdatefilename, prelogtest + err + "\n");

								if ((index + 1) >= looplistlength) {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + ((filedownloadcounter + 1) - fileothertypecounter) });

									folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);

									prelogtest = inboundprelog.replace("keywords", "ftpdownloaded");
									writelog(logdir + logdatefilename, prelogtest + "Total files download completed : " + ((filedownloadcounter + 1) - fileothertypecounter) + "\n");

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) });

									prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
									writelog(logdir + logdatefilename, prelogtest + "Total files backup completed : " + ((filebackupcounter + 1) - fileothertypecounter) + "\n");

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Inbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: `${fileText} files saved in inbound successfully` });

									console.log(`\N${fileText} files saved in inbound successfully`);
									prelogtest = inboundprelog.replace("keywords", "not defined");
									writelog(logdir + logdatefilename, prelogtest + `${fileText} files saved in inbound successfully` + "\n");

									(async function () {
										const downloadtotal = (filedownloadcounter + 1) - fileothertypecounter;
										await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
										await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, downloadtotal, inboundSettingData.sync_type);

										try {
											sftp.end();
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "SFTP close Successful" });

											console.log("\nSFTP close Successful");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogtest + "SFTP close Successful" + "\n");
										} catch (err) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "Error while closing SFTP" });

											console.log("\nError while closing SFTP");
											prelogtest = inboundprelog.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogtest + "Error while closing SFTP" + "\n");
										}

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

										resolve({ isRunningDataId });
									})();
								}
							}
						} else {
							fileothertypecounter++;
						}
					}

					(async function (x) {
						const total = (globallistfilelength + 1) - fileothertypecounter;
						const seconds = (total == 0) ? 2000 : total * 2000;
						const p1 = sleep(seconds);
						return x + await p1;
					})(0).then((v) => {
						if (indexcounter == 0) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total download", description: "Total Files download Completed : " + filedownloadcounter });

							(async function (x) {
								folderFilesCountsRes = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, inboundSettingData.sync_type);
							})();

							prelogtest = inboundprelog.replace("keywords", "ftpdownloaded");
							writelog(logdir + logdatefilename, prelogtest + "Total Files download Completed : " + filedownloadcounter + "\n");

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total backup", description: "Total files backup completed : " + filebackupcounter });

							prelogtest = inboundprelog.replace("keywords", "inboundfilebackup");
							writelog(logdir + logdatefilename, prelogtest + "Total Files backup Completed : " + filebackupcounter + "\n");
						}

						if (filescounter == 0) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Completed", description: "File does not found in SFTP" });

							console.log("\nFile does not found in SFTP");
							prelogtest = inboundprelog.replace("keywords", "not defined");
							writelog(logdir + logdatefilename, prelogtest + "File does not found in SFTP connection close" + "\n");

							(async function (x) {
								const downloadtotal = filedownloadcounter;
								const result = { Status: 0, Msg: "File does not found in SFTP!", Data: [] };
								const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
								return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter, totaldownload = downloadtotal, inboundSettingData.sync_type);
							})(0).then(async (v) => {
								try {
									sftp.end();
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "SFTP close Successful" });

									console.log("\nSFTP close Successful");
									prelogtest = inboundprelog.replace("keywords", "not defined");
									writelog(logdir + logdatefilename, prelogtest + "SFTP close Successful" + "\n");
								} catch (err) {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "Error while closing SFTP" });

									console.log("\nError while closing SFTP");
									prelogtest = inboundprelog.replace("keywords", "not defined");
									writelog(logdir + logdatefilename, prelogtest + "Error while closing SFTP" + "\n");
								}

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

								resolve({ isRunningDataId })
							});
						}
					});
				} catch (err) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Error while getting files list : " + JSON.stringify(err) });

					console.log("\nError while getting files list : " + err);
					prelogtest = inboundprelog.replace("keywords", "not defined");
					writelog(logdir + logdatefilename, prelogtest + "Error while getting files list : " + err + "\n");

					(async function (x) {
						const result = { Status: 1, Msg: "Error while getting files list : " + err, Data: [] };
						const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
						return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 0, filescounter = 0, totaldownload = 0, inboundSettingData.sync_type);
					})(0).then(async (v) => {
						try {
							await sftp.end();
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "SFTP close Successful" });

							console.log("\nSFTP close Successful");
							prelogtest = inboundprelog.replace("keywords", "not defined");
							writelog(logdir + logdatefilename, prelogtest + "SFTP close Successful" + "\n");
						} catch (endErr) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "SFTP Close", description: "Error while closing SFTP" });

							console.log("\nError while closing SFTP");
							prelogtest = inboundprelog.replace("keywords", "not defined");
							writelog(logdir + logdatefilename, prelogtest + "Error while closing SFTP" + "\n");
						}


						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Getting files list", description: "Error while getting files list : " + err });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

						resolve({ isRunningDataId });
					});
				}
			}
		} else if (inboundSettingData.sync_type == "API" && inboundSettingData.api_type == "User_API") {
			(async function (x) {
				return await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "1", "0");
			})(0).then((itemrundata) => {
				if (itemrundata.status === 1 && isRunningDataId === "") {
					isRunningDataId = itemrundata.id;
				}
			});

			const inbound_url = inboundSettingData.api_user_api;
			request(inbound_url, async function (error, response, inbody) {
				if (error) {
					(async function (x) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound API Data", description: JSON.stringify(error) });

						const result = { Status: 0, Msg: "No data found!", Data: [] };
						const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
						return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter = 0, totaldownload = 0);
					})(0).then((v) => {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

						resolve({ isRunningDataId });
					});
				} else {
					var OutboundFormatData = {};
					var nodeDataArray = [];
					var linkDataArray = [];
					var outboundMappedData = {};
					var outboundPostDataFormat = "json";
					var outboundResponseDataFormat = "json";
					var inboundFormatData = {};
					var inboundPostDataUnkeyArr = false;
					var outboundPostDataUnkeyArr = false;
					var outboundResponseDataUnkeyArr = false;

					(async function (x) {
						if (inbound_format == "json") {
							var object = JSON.parse(inbody);
							let inboundPostData = object;
							let inboundPostDataFormat = "json";
							let returnDataPost = { status: 0 }

							if (inbound_format == "json") {
								try {
									inboundPostData = JSON.parse(JSON.stringify(object));
									returnDataPost = { status: 0, data: inboundPostData };
								} catch (err) {
									returnDataPost = { status: 1, message: err.message };
								}
							}
							return returnDataPost;
						} else {
							const template2 = [
								"//WebOrder", {
									OrderHandling: [
										"//POHeader/OrderHandling/Variable", {
											ID: "ID",
											Data: "Data"
										}
									],
									CustRef: [
										"//POHeader/CustRef/Variable", {
											ID: "ID",
											Data: "Data"
										}
									],
									SupplierDetail: [
										"//POHeader/SupplierDetail/Variable", {
											ID: "ID",
											Data: "Data"
										}
									],
									ItemRefs: [
										"//POHeader/ItemRefs/Variable", {
											ID: "ID",
											Data: "Data"
										}
									],
									EDIHeader: {
										EDIVariables: [
											"//EDIHeader/EDIVariables/Variable", {
												ID: "ID",
												Data: "Data"
											}
										],
										EDICareandContent: {
											Fibres: {
												FibreComponents_1: [
													"//EDIHeader/EDICareandContent/Fibre/FibreComponents[1]/Variable", {
														ID: "ID",
														Data: "Data"
													}
												],
												FibreComponents_2: [
													"//EDIHeader/EDICareandContent/Fibre/FibreComponents[2]/Variable", {
														ID: "ID",
														Data: "Data"
													}
												],
											},
											FrabricStatments: [
												"//EDIHeader/EDICareandContent/FrabricStatments/Variable", {
													ID: "ID",
													Data: "Data"
												}
											],
											CareSymbolMappingID: [
												"//EDIHeader/EDICareandContent/CareSymbolMappingID/Variable", {
													ID: "ID",
													Data: "Data"
												}
											]
										}
									},
									EDISizeDetail: {
										EDISize: [
											"//EDISizeDetail/EDISize", {
												Variable: [
													"//EDISizeDetail/EDISize/Variable", {
														ID: "ID",
														Data: "Data"
													}
												],
												MatrixDetail: [
													"//EDISizeDetail/EDISize/MatrixDetail/Variable", {
														ID: "ID",
														Data: "Data"
													}
												]
											}
										]
									}
								}
							];
							let returnDataPost = { status: 0 }

							const parser = new xmldom.DOMParser();
							const root = parser.parseFromString(inbody, "text/xml");
							let result = "`" + inbody + "`";

							(async function () {
								try {
									result = await transform(inbody, template2);
									let data = result;
									const nodes = xpath.select("//EDIHeader/EDICareandContent/Fibre/FibreComponents", root);
									let counter = 1;
									let fibres = {};

									nodes.forEach(function (item, i) {
										let fibrecomponents = "";

										fibrecomponents = nodes[i].localName + "_" + counter;

										const Variablenodes = xpath.select("//EDIHeader/EDICareandContent/Fibre/FibreComponents[" + counter + "]/Variable", root);
										let node_variable_counter = 1;
										fibres[fibrecomponents] = [];
										Variablenodes.forEach(function (item, j) {
											const id = xpath.select("//EDIHeader/EDICareandContent/Fibre/FibreComponents[" + counter + "]/Variable[" + node_variable_counter + "]/ID", root);
											data = xpath.select("//EDIHeader/EDICareandContent/Fibre/FibreComponents[" + counter + "]/Variable[" + node_variable_counter + "]/Data", root);

											fibres[fibrecomponents][j] = { ID: id[0].firstChild.data, Data: data[0].firstChild.data };
											node_variable_counter++;
										})
										counter++;
									});

									data[0].SupplierDetail.push({ ID: "Brand", Data: item_code });

									if (fibres.length > 0) {
										data[0].EDIHeader.EDICareandContent.Fibres = fibres;
									}

									if ((data[0].EDISizeDetail.EDISize.length == undefined || data[0].EDISizeDetail.EDISize.length == 0) && (data[0].EDISizeDetail.MatrixDetail == undefined || data[0].EDISizeDetail.MatrixDetail.length == 0)) {
										delete data[0].EDISizeDetail;
									}

									if ((data[0].OrderHandeling == undefined || data[0].OrderHandeling.length == 0)) {
										delete data[0].OrderHandeling;
									}

									if ((data[0].ItemRefs == undefined || data[0].ItemRefs.length == 0)) {
										delete data[0].ItemRefs;
									}

									if ((data[0].CustRef == undefined || data[0].CustRef.length == 0)) {
										delete data[0].CustRef;
									}

									if ((data[0].SupplierDetail == undefined || data[0].SupplierDetail.length == 0)) {
										delete data[0].SupplierDetail;
									}

									if (data[0].EDIHeader.EDICareandContent.Fibres == undefined || data[0].EDIHeader.EDICareandContent.Fibres.length == 0) {
										delete data[0].EDIHeader.EDICareandContent.Fibres;
									}

									if (data[0].EDIHeader.EDICareandContent.FrabricStatments == undefined || data[0].EDIHeader.EDICareandContent.FrabricStatments.length == 0) {
										delete data[0].EDIHeader.EDICareandContent.FrabricStatments;
									}

									if (data[0].EDIHeader.EDICareandContent.CareSymbolMappingID == undefined || data[0].EDIHeader.EDICareandContent.CareSymbolMappingID.length == 0) {
										delete data[0].EDIHeader.EDICareandContent.CareSymbolMappingID;
									}

									returnDataPost = { status: 0, data: inboundPostData };
								} catch (err) {
									returnDataPost = { status: 1, message: err.message };
								}

								return returnDataPost;
							})()
						}
					})(0).then(async (data) => {
						if (data.status == 0) {
							inbody = data.data;
							let object = JSON.parse(JSON.stringify(inbody));
							let currentBodyReq = object;
							let currentReqBody = object;
							let inboundPostData = object;
							let inboundFilterEnableLog = "off";

							const inboundFilterHandlerRes = await inboundFilterHandler(enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, currentReqBody, inboundPostData, inboundPostDataUnkeyArr, inboundFilterData, item, inboundFilterEnableLog, currentBodyReq, outboundMappedData, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, "no", {}, {}, [], [], [], [], {}, "User API");

							if (inboundFilterHandlerRes.code == 1) {
								return res.status(200).send(inboundFilterHandlerRes);
							} else {
								inboundPostData = inboundFilterHandlerRes.inboundPostData;
								inboundPostDataUnkeyArr = inboundFilterHandlerRes.inboundPostDataUnkeyArr;
								currentBodyReq = inboundFilterHandlerRes.bodyreq;
								currentReqBody = inboundFilterHandlerRes.reqBody;
							}

							const inboundMappingHandlerRes = await inboundMappingHandler(outboundSettingData, enableLogs, enableFullLogs, companyCode, schedulerUniqueId, inboundEnableLog, outboundEnableLog, item_id, item, currentReqBody, currentBodyReq, mappingSettingData, inboundFormatData, inboundPostData, propertiesSettingData, inboundFormatDataUnkeyArr, outboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, outboundPostDataFormat, nodeDataArray, linkDataArray, outboundMappedData, OutboundFormatData, ItemName, "", outboundApiUrls, outboundLastPath = "", dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString = "", "true", "no", {}, {}, [], [], [], [], {}, "User API", logdir, logdatefilename);

							if (inboundMappingHandlerRes.code == 1) {
								(async function (x) {
									const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
								})(0).then((data) => {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Mapping Fail", httpStatus: "200" });

									resolve({ isRunningDataId });
								});

							} else {
								currentReqBody = inboundMappingHandlerRes.reqBody;
								currentBodyReq = inboundMappingHandlerRes.bodyreq;
								inboundFormatData = inboundMappingHandlerRes.inboundFormatData;
								inboundFormatDataUnkeyArr = inboundMappingHandlerRes.inboundFormatDataUnkeyArr;
								outboundPostDataUnkeyArr = inboundMappingHandlerRes.outboundPostDataUnkeyArr;
								outboundFormatDataUnkeyArr = inboundMappingHandlerRes.outboundFormatDataUnkeyArr;
								outboundPostDataFormat = inboundMappingHandlerRes.outboundPostDataFormat;
								nodeDataArray = inboundMappingHandlerRes.nodeDataArray;
								linkDataArray = inboundMappingHandlerRes.linkDataArray;
								outboundMappedData = inboundMappingHandlerRes.outboundMappedData;
								OutboundFormatData = inboundMappingHandlerRes.OutboundFormatData;
							}

							(async function (x) {
								await listarrinboundrun(companyCode, logdir, logdatefilename, item, 1, filescounter = 0, totaldownload = 0, inboundSettingData.sync_type);
								return await ddepInboundEmailSend(companyCode, item, 1, schedulerUniqueId);
							})(0).then(async (v) => {
								try {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start DDEP Outbound" });

									let outboundValidationHandlerRes = await outboundValidationHandler(outboundValidationSettingData, currentReqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, "no", item, {}, {}, [], [], [], [], {}, '', "User API", logdir, logdatefilename);

									if (outboundValidationHandlerRes.code == 1) {

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Validation Error : " + outboundValidation.longMsg });

										(async function (x) {
											const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
										})(0).then((data) => {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Validation Fail", httpStatus: "200" });

											resolve({ isRunningDataId });
										});
									}

									try {
										const outbound_api_url = outboundSettingData.api_url;
										let outbound_format = outboundSettingData.outbound_format;
										const outbound_send_collection_one_by_one = (outboundSettingData.sendCollectionOnebyOne != undefined) ? outboundSettingData.sendCollectionOnebyOne : "off";
										let outbound_collections_name = (outboundSettingData.collections_name != undefined) ? outboundSettingData.collections_name : "";
										let isCollectionExist = false;

										if (outbound_send_collection_one_by_one != "off" && outbound_collections_name != "") {
											outbound_collections_name = outbound_collections_name.replace("@Out{", "").replace("@out{", "").replace("@In{", "").replace("@in{", "").replace("}", "");
											const outbound_collections_name_arr = outbound_collections_name.split(".");

											if (outbound_collections_name_arr.length > 0) {
												if (outbound_collections_name_arr.length == 1 && object[outbound_collections_name_arr[0]] != undefined) {
													isCollectionExist = true;
													object = object[outbound_collections_name_arr[0]];
												} else {
													if (outbound_collections_name_arr[0] != undefined && object[outbound_collections_name_arr[0]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[0]];
													}

													if (outbound_collections_name_arr[1] != undefined && object[outbound_collections_name_arr[1]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[1]];
													}

													if (outbound_collections_name_arr[2] != undefined && object[outbound_collections_name_arr[2]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[2]];
													}

													if (outbound_collections_name_arr[3] != undefined && object[outbound_collections_name_arr[3]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[3]];
													}

													if (outbound_collections_name_arr[4] != undefined && object[outbound_collections_name_arr[4]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[4]];
													}

													if (outbound_collections_name_arr[5] != undefined && object[outbound_collections_name_arr[5]] != undefined) {
														isCollectionExist = true;
														object = object[outbound_collections_name_arr[5]];
													}
												}
											}
										}

										if (outbound_send_collection_one_by_one == "on" && !isCollectionExist) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound send collections not found." });

											(async function (x) {
												const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
											})(0).then((data) => {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

												resolve({ isRunningDataId });
											});
										} else {
											let outbound_api_options = {
												method: "post",
												url: outbound_api_url,
												headers: {
													"Content-Type": "text/plain",
													"DDEP_item_id": item_id,
													"DDEP_item_name": ItemName,
													"DDEP_post_time": new Date(),
												}
											};

											if (outbound_send_collection_one_by_one == "on" && outboundPostDataUnkeyArr && object.items != undefined) {
												object = object.items;
												outboundPostDataUnkeyArr = false;
											} else if (outbound_send_collection_one_by_one == "on" && !outboundPostDataUnkeyArr && inboundPostDataUnkeyArr && object.items != undefined) {
												object = object.items;
												inboundPostDataUnkeyArr = false;
											}

											let newobject = object;
											if (!Array.isArray(object)) {
												let objectArr = [];
												objectArr.push(object);
												newobject = objectArr;
											}

											if (newobject.length > 0) {
												let outboundBobyCount = 0;
												for (let iobject = 0; iobject < newobject.length; iobject++) {
													object = newobject[iobject];

													outbound_api_options["formData"] = { "TuuJson": JSON.stringify(object) };

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Post Data", description: "Posting Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify({ ...outbound_api_options, body: safeJSONWithOutStringify(outbound_api_options.body, config.dataSize) }) : "" });

													request(outbound_api_options, function (error, response, body) {
														outboundBobyCount++;
														let newobjectlenght = (newobject.length == 1) ? 1 : (newobject.length - 1);
														if (outboundBobyCount == newobjectlenght) {
															if (error) {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: error.message, httpStatus: response.statusCode + " " + response.statusMessage });

																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: "Connect Outbound API Timeout (" + outbound_api_url + ")", exception_type: "Connection Error", item: ItemName, detail_exception: error.message, httpStatus: response.statusCode + " " + response.statusMessage });

																(async function (x) {
																	const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
																})(0).then((data) => {
																	addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Outbound Timeout", httpStatus: response.statusCode + " " + response.statusMessage });

																	resolve({ isRunningDataId });
																});
															} else {
																try {
																	if (response.statusCode == 200 || response.statusCode == 201 || response.statusCode == 202 || response.statusCode == 203 || response.statusCode == 204 || response.statusCode == 205 || response.statusCode == 206 || response.statusCode == 207 || response.statusCode == 208 || response.statusCode == 226 || response.statusCode == 301 || response.statusCode == 302 || response.statusCode == 303) {
																		let outboundResponseData = {};
																		try {
																			outboundResponseData = JSON.parse(body);
																		} catch (err) {
																			parseString(body, function (err, result) {
																				outboundResponseData = jsonOriginal(result);
																			});
																			outboundResponseDataFormat = "xml";
																		}

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(outboundResponseData) : "", httpStatus: response.statusCode + " " + response.statusMessage });

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound" });

																		(async function (x) {
																			const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
																			await listarroutboundrun(companyCode, logdir, logdatefilename, item, 1, 1, 1);
																			return await ddepOutboundEmailSend(companyCode, item, 1, schedulerUniqueId);
																		})(0).then((v) => {
																			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200 OK" });

																			resolve({ isRunningDataId });
																		});
																	} else {
																		try {
																			body = JSON.parse(body);
																		} catch (err) {
																			body = body;
																		}

																		let parsedData = safeJSONStringify(body, config.dataSize);

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", httpStatus: response.statusCode + " " + response.statusMessage });

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: JSON.stringify({ "message": response.statusMessage, "http_status_code": response.statusCode }) });

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: parsedData, exception_type: "Connection Error", item: ItemName, detail_exception: "Outbound API responsed status : " + response.statusCode + " : " + response.statusMessage, httpStatus: response.statusCode + " " + response.statusMessage });

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound" });

																		(async function (x) {
																			const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
																			await listarroutboundrun(companyCode, logdir, logdatefilename, item, 0, 1, 1);
																			return await ddepOutboundEmailSend(companyCode, item, 0, schedulerUniqueId);
																		})(0).then((v) => {
																			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200 OK" });

																			resolve({ isRunningDataId });
																		});
																	}
																} catch (err) {
																	(async function (x) {
																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while outbound post data." });

																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data." });

																		const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
																		return await listarroutboundrun(companyCode, logdir, logdatefilename, item, 0, 0, 0);
																	})(0).then((v) => {
																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

																		resolve({ isRunningDataId });
																	});
																}
															}
														}
													});
												}
											} else {
												(async function (x) {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound post data is empty." });

													const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
													return await listarroutboundrun(companyCode, logdir, logdatefilename, item, 0, 0, 0);
												})(0).then((v) => {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

													resolve({ isRunningDataId });
												});
											}
										}
									} catch (err) {
										(async function (x) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while checking outbound setting.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound setting." });

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while checking outbound setting." });

											const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
											return await listarroutboundrun(companyCode, logdir, logdatefilename, item, 0, 0, 0);
										})(0).then((v) => {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

											resolve({ isRunningDataId });
										});
									}
								} catch (err) {
									(async function (x) {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while checking outbound validation setting.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound validation setting." });

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while checking outbound validation setting." });

										const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
										return await listarroutboundrun(companyCode, logdir, logdatefilename, item, 0, 0, 0);
									})(0).then((v) => {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

										resolve({ isRunningDataId });
									});
								}
							});
						} else {
							(async function (x) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound API Data", description: "Please post a valid JSON Format" });

								const itemrundata = await setCurrentRunningItem(logdir, inboundprelog, logdatefilename, isRunningDataId, item_id, "0", "0");
								return await listarrinboundrun(companyCode, logdir, logdatefilename, item, 0, filescounter = 0, totaldownload = 0, inboundSettingData.sync_type);
							})(0).then((v) => {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "User API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

								resolve({ isRunningDataId });
							});
						}
					});
				}
			});
		} else {
			resolve();
		}
	});
}

function inboundfiledownloadmoveForSftp(companyCode, sftp, folderpath, listindexname, itemscounterindexfiledownload, prelog, logdir, logdatefilename, nameindex, index, inbounddir, itemdir, filedownloadcounter, backup_folder, filebackupcounter, itemscounterindexfilebackup, item_id, fileSizeindex, item) {
	return new Promise(async (resolve) => {
		console.log("\nFolder path found : " + folderpath + "/" + listindexname);
		const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
		const ItemName = item.ItemName;
		let prelogtest = "";

		try {
			let data = await sftp.get(folderpath + "/" + listindexname);
			if (itemscounterindexfiledownload != 1) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "File size : " + fileSizeindex + "kb \r\n Downloading File : " + folderpath + "/" + listindexname });

				prelogtest = prelog.replace("keywords", "ftpdownloading");
				writelog(logdir + logdatefilename, prelogtest + "Downloading File : " + folderpath + "/" + listindexname + "\n");

				try {
					let fileExtension = path.extname(listindexname).substring(1);
					console.log("\nFilename : " + nameindex + "." + fileExtension);
					if (Buffer.isBuffer(data)) {
						fs.writeFileSync(inbounddir + "/" + itemdir + "/" + nameindex + "." + fileExtension, data);
					} else if (data.pipe) {
						const writeStream = fs.createWriteStream(inbounddir + "/" + itemdir + "/" + nameindex + "." + fileExtension);
						data.pipe(writeStream);
						await new Promise((resolve, reject) => {
							writeStream.on('finish', resolve);
							writeStream.on('error', reject);
						});
					}

					try {
						filedownloadcounter = index;
						itemscounterindexfiledownload = 1;

						try {
							await sftp.rename(folderpath + "/" + listindexname, folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension);

							filebackupcounter = index;
							itemscounterindexfilebackup = 1;

							console.log("\nFile moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension);

							let stat = fs.statSync(inbounddir + "/" + itemdir + "/" + nameindex + "." + fileExtension);
							let downloadedFileSize = (stat.size / 1024).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloaded", description: "File size : " + downloadedFileSize + "kb \r\n Download completed : " + folderpath + "/" + nameindex + "." + fileExtension });

							prelogtest = prelog.replace("keywords", "downloadcompleted");
							writelog(logdir + logdatefilename, prelogtest + "Download completed : " + folderpath + "/" + nameindex + "." + fileExtension + "\n");

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "File moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension });

							prelogtest = prelog.replace("keywords", "movingtobackup");
							writelog(logdir + logdatefilename, prelogtest + "File moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension + "\n");
						} catch (error) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error while move file to backup folder with name : " + folderpath + "/" + "/" + listindexname });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error while move file to backup folder with name : " + err });

							console.log("\nError while move file to backup folder with name : " + folderpath + "/" + listindexname);

							prelogtest = prelog.replace("keywords", "inboundfilebackup");
							writelog(logdir + logdatefilename, prelogtest + "Error while move file to backup folder with name : " + folderpath + "/" + listindexname + "\n");
							writelog(logdir + logdatefilename, prelogtest + err + "\n");

							resolve({ code: "1", response: "", itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
						}

						resolve({ code: "1", response: "", itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });


					} catch (err) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while move file to backup folder : " + err });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder with name : " + folderpath + "/" + listindexname });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder : " + err });

						console.log("\nError catch while move file to backup folder with name : " + folderpath + "/" + listindexname);
						console.log("\nError catch while move file to backup folder : " + err);

						prelogtest = prelog.replace("keywords", "not defined");
						writelog(logdir + logdatefilename, prelogtest + "Error catch while move file to backup folder with name : " + folderpath + "/" + listindexname + "\n");
						writelog(logdir + logdatefilename, prelogtest + err + "\n");

						resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
					}
				} catch (err) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch in stream file : " + err });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file name : " + folderpath + "/" + "/" + listindexname });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file : " + err });

					console.log("\nError catch in stream file : " + folderpath + "/" + listindexname);
					console.log("\nError catch in stream file : " + err);

					prelogtest = prelog.replace("keywords", "not defined");
					writelog(logdir + logdatefilename, prelogtest + "Error catch in stream file : " + folderpath + "/" + listindexname + "\n");
					writelog(logdir + logdatefilename, prelogtest + err + "\n");

					resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
				}
			} else {
				resolve({ code: "0", response: "", itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
			}
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Download fail", description: "Error in download file : " + folderpath + "/" + listindexname });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "SFTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Download fail", description: "Error in download file : " + err });

			prelogtest = prelog.replace("keywords", "ftpdownloading-error");
			writelog(logdir + logdatefilename, prelogtest + "Error in download file : " + folderpath + "/" + listindexname + "\n");
			writelog(logdir + logdatefilename, prelogtest + err + "\n");
			resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
		}
	});
}

function inboundfiledownloadmoveforFtp(companyCode, ftp, folderpath, listindexname, itemscounterindexfiledownload, prelog, logdir, logdatefilename, nameindex, index, inbounddir, itemdir, filedownloadcounter, backup_folder, filebackupcounter, itemscounterindexfilebackup, item_id, fileSizeindex, item) {
	return new Promise((resolve) => {
		console.log("\nFolder path found : " + folderpath + "/" + listindexname);
		const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
		const ItemName = item.ItemName;
		let prelogtest = "";

		try {
			ftp.get(folderpath + "/" + listindexname, async function (err, stream) {
				if (itemscounterindexfiledownload != 1) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "File size : " + fileSizeindex + "kb \r\n Downloading File : " + folderpath + "/" + listindexname });

					prelogtest = prelog.replace("keywords", "ftpdownloading");
					writelog(logdir + logdatefilename, prelogtest + "Downloading File : " + folderpath + "/" + listindexname + "\n");

					if (err) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Download fail", description: "Error in download file : " + folderpath + "/" + listindexname });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Download fail", description: "Error in download file : " + err });

						prelogtest = prelog.replace("keywords", "ftpdownloading-error");
						writelog(logdir + logdatefilename, prelogtest + "Error in download file : " + folderpath + "/" + listindexname + "\n");
						writelog(logdir + logdatefilename, prelogtest + err + "\n");
						resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
					} else {
						try {
							let fileExtension = path.extname(listindexname).substring(1);
							console.log("\nFilename : " + nameindex + "." + fileExtension);
							await stream.pipe(fs.createWriteStream(inbounddir + "/" + itemdir + "/" + nameindex + "." + fileExtension));

							try {
								filedownloadcounter = index;
								itemscounterindexfiledownload = 1;

								await ftp.rename(folderpath + "/" + listindexname, folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension, async function (err) {
									if (err) {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error while move file to backup folder with name : " + folderpath + "/" + "/" + listindexname });

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error while move file to backup folder with name : " + err });

										console.log("\nError while move file to backup folder with name : " + folderpath + "/" + listindexname);

										prelogtest = prelog.replace("keywords", "inboundfilebackup");
										writelog(logdir + logdatefilename, prelogtest + "Error while move file to backup folder with name : " + folderpath + "/" + listindexname + "\n");
										writelog(logdir + logdatefilename, prelogtest + err + "\n");
									} else {
										filebackupcounter = index;
										itemscounterindexfilebackup = 1;

										console.log("\nFile moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension);

										let stat = fs.statSync(inbounddir + "/" + itemdir + "/" + nameindex + "." + fileExtension);
										let downloadedFileSize = (stat.size / 1024).toString().match(/^-?\d+(?:\.\d{0,2})?/)[0];

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloaded", description: "File size : " + downloadedFileSize + "kb \r\n Download completed : " + folderpath + "/" + nameindex + "." + fileExtension });

										prelogtest = prelog.replace("keywords", "downloadcompleted");
										writelog(logdir + logdatefilename, prelogtest + "Download completed : " + folderpath + "/" + nameindex + "." + fileExtension + "\n");

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "File moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension });

										prelogtest = prelog.replace("keywords", "movingtobackup");
										writelog(logdir + logdatefilename, prelogtest + "File moved to backup folder with name : " + folderpath + "/" + backup_folder + "/" + nameindex + "." + fileExtension + "\n");
									}
									resolve({ code: "1", response: "", itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
								});
							} catch (err) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while move file to backup folder : " + err });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder with name : " + folderpath + "/" + listindexname });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Move file", description: "Error catch while move file to backup folder : " + err });

								console.log("\nError catch while move file to backup folder with name : " + folderpath + "/" + listindexname);
								console.log("\nError catch while move file to backup folder : " + err);

								prelogtest = prelog.replace("keywords", "not defined");
								writelog(logdir + logdatefilename, prelogtest + "Error catch while move file to backup folder with name : " + folderpath + "/" + listindexname + "\n");
								writelog(logdir + logdatefilename, prelogtest + err + "\n");

								resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
							}
						} catch (err) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch in stream file : " + err });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file name : " + folderpath + "/" + "/" + listindexname });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Downloading", description: "Error catch in stream file : " + err });

							console.log("\nError catch in stream file : " + folderpath + "/" + listindexname);
							console.log("\nError catch in stream file : " + err);

							prelogtest = prelog.replace("keywords", "not defined");
							writelog(logdir + logdatefilename, prelogtest + "Error catch in stream file : " + folderpath + "/" + listindexname + "\n");
							writelog(logdir + logdatefilename, prelogtest + err + "\n");

							resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
						}
					}
				} else {
					resolve({ code: "0", response: "", itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
				}
			});
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Error catch in get file : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch in get file : " + err });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Error catch in get file name : " + folderpath + "/" + "/" + listindexname });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "FTP", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "File", description: "Error catch in get file : " + err });

			console.log("\nError catch in get file name : " + folderpath + "/" + listindexname);
			console.log("\nError catch in get file : " + err);

			prelogtest = prelog.replace("keywords", "not defined");
			writelog(logdir + logdatefilename, prelogtest + "Error catch in get file : " + folderpath + "/" + listindexname + "\n");
			writelog(logdir + logdatefilename, prelogtest + err + "\n");

			resolve({ code: "0", response: err, itemscounterindexfiledownload: itemscounterindexfiledownload, filedownloadcounter: filedownloadcounter, filebackupcounter: filebackupcounter, itemscounterindexfilebackup: itemscounterindexfilebackup });
		}
	});
}

function listarrinboundrun(companyCode, logdir, logdatefilename, item, result, filescounter, totaldownload, sync_type) {
	return new Promise((resolve) => {
		const prelog = "[" + new Date() + "] - [/routers/scheduler_job.js] > [/scheduling] > [keywords]";
		console.log("\nInbound result : " + JSON.stringify(result));
		const newschedulesetting = {
			...item.schedule_setting,
			companyCode: item.schedule_setting.CompanyCode
		};
		const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";

		let prelogtest = prelog.replace("keywords", "not defined");
		writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > " + JSON.stringify(result) + "\n");

		let historyStatus = "fail";
		if (result != undefined && result == 1) {
			historyStatus = "success";
		}

		const schedule_setting_options = {
			method: "put",
			url: config.domain + "/projects/schedules/update/" + item.schedule_setting._id,
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(newschedulesetting)
		};
		request(schedule_setting_options, function (error, response) {
			if (error) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Update schedule setting error schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString() });

				prelogtest = prelog.replace("keywords", "not defined");
				console.log("\nUpdate schedule setting error schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString());
				writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [update schedule setting error schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString() + "]\n");
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Update schedule setting Schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString() });

				console.log("\nUpdate schedule setting schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString());
				prelogtest = prelog.replace("keywords", "not defined");
				writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [update schedule setting schedule time inbound is " + new Date(parseInt(newschedulesetting.next_date_inbound)).toString() + "]\n");
			}

			const inbound_history_options = {
				method: "post",
				url: config.domain + "/inbound_history/save",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					"item_id": item._id,
					"status": historyStatus
				})
			};
			request(inbound_history_options, function (error, response) {
				if (error) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Error while save inbound history " + error });

					console.log("\nError while save inbound history " + error);
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Inbound history saved successfully" });

					console.log("\nInbound history saved successfully");
					const prelogtest = prelog.replace("keywords", "not defined");
					writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Inbound history saved successfully]\n");
				}

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "Inbound successfully run" });

				console.log("\nInbound successfully run");
				if (filescounter != 0 && result != undefined) {
					(async function (x) {
						return await inboundEmailSend(companyCode, logdir, logdatefilename, item, totaldownload, result, sync_type);
					})(0).then((v) => {
						resolve({ code: "1", response: "" });
					});
				} else {
					resolve({ code: "1", response: "" });
				}
			});
		});
	});
}

function inboundEmailSend(companyCode, logdir, logdatefilename, item, totaldownload, result, sync_type) {
	return new Promise(async (resolve) => {
		const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
		if (smtpResult.status === 1) {
			const item_id = item._id;
			const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
			if (smtpResult?.data?.smtpActive == "1") {
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
					const isInboundFtpSuccess = (notification?.status == 1 && notification?.data?.isInboundFtpSuccess == "on") ? "Enabled" : "Disabled";
					const isInboundFtpFail = (notification?.status == 1 && notification?.data?.isInboundFtpFail == "on") ? "Enabled" : "Disabled";
					if (result == 1) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: `${sync_type} > Inbound Successful : ` + isInboundFtpSuccess });
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: `${sync_type} > Inbound Fail : ` + isInboundFtpFail });
					}
					let isSend = notification?.data?.isInboundFtpSuccess;
					if (result != 1) {
						isSend = notification?.data?.isInboundFtpFail;
					}

					if (notification.status == 1 && isSend == "on") {
						let folderFilesCountsResult = await folderFilesCounts(companyCode, item, item_id, inboundEnableLog, sync_type);
						const logHistoriesResult = await getLoghistories(item_id, schedulerUniqueId, "Inbound");
						const item_code = item.ItemCode;
						const item_name = item.ItemName;
						const inboundSetting = item.inbound_setting;
						const projectDetails = await findProject(item.ProjectId);
						let usertoMail = "";
						let userTitle = "";
						if (projectDetails.status == 1) {
							usertoMail = projectDetails?.data?.email;
							userTitle = projectDetails?.data?.emailTitle;
						}
						const serverName = inboundSetting.ftp_server_link;
						const outboundSetting = item.outbound_setting;
						const outboundApiUrl = outboundSetting.api_url;
						const totalDownload = totaldownload;
						const providerName = notification.data.providerName;
						const toEmail = notification.data.email;
						let EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") Inbound Successful";
						if (result != 1) {
							EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") Inbound Fail";
						}

						let userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''} - Inbound Successful - ${item_code} - ${item_name}`;
						if (result !== 1) {
							userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''} - Inbound Failure - ${item_code} - ${item_name}`;
						}

						const logHistoriesResults = logHistoriesResult;
						const logHistoriesResultsData = logHistoriesResults.data;

						let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Inbound Successful</title><style type="text/css">td, th {border: 1px solid #ddd;}</style></head><body style="background-color:#F4F4F4;"><center><table class="container600" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:calc(100%);max-width:calc(100%);margin: 0 auto;"><tr><td width="100%" style="text-align: left;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>${sync_type}:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + serverName;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Outbound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + outboundApiUrl;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Total Downloaded:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + totalDownload;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Phyiscal File Check:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += folderFilesCountsResult.in_dir + "<br>";
						mailContent += folderFilesCountsResult.in_month_folder + "<br>";
						mailContent += folderFilesCountsResult.convertfail_dir + "<br>";
						// mailContent += folderFilesCountsResult.out_month_folder + "<br>";
						mailContent += folderFilesCountsResult.sending_dir + "<br>";
						// mailContent += folderFilesCountsResult.timeout_dir + "<br><br>";
						mailContent += `</td></tr>`;
						mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Event:</strong></td></tr><tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;

						let logEvents = ``;
						if (logHistoriesResultsData.length > 0) {
							logEvents += `<table class="smarttable" width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
							logEvents += `<thead>`;
							logEvents += `<tr>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Item ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Unique ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Type</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Action</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Description</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Created At</th>`;
							logEvents += `</tr>`;
							logEvents += `</thead>`;
							logEvents += `<tbody>`;
							for (let i = 0; i < logHistoriesResultsData.length; i++) {
								logEvents += `<tr>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i]._id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].item_id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].unique_id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].type + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].action + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].description + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].createdAt + `</td>`;
								logEvents += `</tr>`;
							}
							logEvents += `</tbody>`;
							logEvents += `</table>`;
						}

						mailContent += logEvents + `<br>`;
						mailContent += `</td></tr>`;
						mailContent += `</table></td></tr></table></center></body></html>`;

						let smtpSecure = false;
						if (smtpResult.data.smtpPort == 465) {
							smtpSecure = true;
						}

						const queueId = uuidv4();
						const takenSubject = userEmailSubject;
						const combinedTo = usertoMail ? `${toEmail},${usertoMail}` : toEmail;

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Connect", description: "Queuing", queueId });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Send", description: "Queuing", queueId });

						const queue = mailQueue;

						const mockJobData = {
							queueId,
							smtpConfig: {
								host: smtpResult.data.smtpServer,
								port: smtpResult.data.smtpPort,
								secure: smtpSecure,
								auth: {
									user: smtpResult.data.smtpAccount,
									pass: smtpResult.data.smtpPassword,
								},
								family: 4,
								pool: true,
								maxConnections: 20,
								maxMessages: 500,
								rateLimit: 10
							},
							mailConfig: {
								from: providerName + " <" + smtpResult.data.smtpEmail + ">",
								to: combinedTo,
								subject: takenSubject,
								html: mailContent,
							},
							logDataConnect: {
								action: "Inbound Email Connect",
								description: "SMTP " + smtpResult.data.smtpServer + " connected"
							},
							logDataSend: {
								action: "Inbound Email Send",
							},
							successDescription: item_id + " > Sent Inbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Success",
							errorDescription: item_id + " > Sent Inbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Fail : Error : "
						}

						await queue.add(mailQueueConfig.name, mockJobData, { jobId: queueId, delay: 0, removeOnComplete: 10, removeOnFail: 10 });
						resolve();
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: `Inbound ${item.inbound_setting.sync_type} Success Notification Disabled` });

						resolve();
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: notification.message + " - Some error occurred while getting the notification setting." });

					resolve();
				}
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "SMTP setting not active." });

				resolve();
			}
		} else {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: error + " - Some error occurred while getting the SMTP setting." });

			resolve();
		}
	});
}

function jsonOriginal(data) {
	let mainObject = {};
	let secondObject = {};
	let merged1 = {};

	Object.entries(data).forEach(([key, value]) => {
		if (!Array.isArray(value) && value != null && typeof (value) == "object") {
			let objfirst = {};
			let returnval = jsonOriginal(value);
			objfirst[key] = returnval;
			merged1 = Object.assign(secondObject, secondObject, objfirst);
		}
		if (Array.isArray(value) && value != null && typeof (value) == "object") {
			let returnval = jsonOriginal(value);

			let objfirst = {};
			if (!Array.isArray(returnval) && returnval != null && typeof (returnval) != "object") {
				if (key >= 0) {
					mainObject = returnval;
				} else {
					objfirst[key] = returnval;
					merged1 = Object.assign(secondObject, secondObject, objfirst);
				}
			} else if (!Array.isArray(returnval) && returnval != null && typeof (returnval) == "object") {
				let returnvalarr = [];
				Object.entries(returnval).forEach(([returnvalkey, returnvalvalue]) => {
					if (returnvalkey >= 0) {
						returnvalarr.push(returnvalvalue);
					}
				});
				objfirst[key] = returnvalarr;
				merged1 = Object.assign(secondObject, secondObject, objfirst);
			} else {
				if (key >= 0) {
					mainObject = returnval;
				} else {
					let newArr = [];
					newArr.push(returnval);
					objfirst[key] = newArr;
					merged1 = Object.assign(secondObject, secondObject, objfirst);
				}
			}
		}
		if (!Array.isArray(value) && value != null && typeof (value) != "object") {
			if (key >= 0) {
				mainObject = value;
			} else {
				let objfirst = {};
				objfirst[key] = value;
				merged1 = Object.assign(secondObject, secondObject, objfirst);
			}
		}
	});

	let merged = {};
	Object.entries(secondObject).forEach(([key, value]) => {
		merged = Object.assign({}, mainObject, secondObject);
	});

	if (Object.entries(merged).length === 0) {
		merged = mainObject;
	}

	return merged;
}

const getNestedValue = (obj, pathParts, indexShift) => {
	if (!obj || pathParts.length === 0) return undefined;

	let key = pathParts.shift();

	// If the key has a number suffix (e.g., name2 -> name[1])
	if (Array.isArray(obj)) {
		let match = key.match(/^(.+?)(\d+)$/);

		if (match) {
			let baseKey = match[1]; // Extract key part (e.g., "name")
			let index = parseInt(match[2]) - indexShift; // Convert to zero-based index

			if (index >= 0 && index < obj.length) {
				key = baseKey;
				obj = obj[index]; // Get indexed element
			} else {
				return undefined; // Return undefined if index is out of range
			}
		} else {
			obj = obj[0]; // Normal object key access
		}
	}

	return pathParts.length === 0 ? obj[key] : getNestedValue(obj[key], pathParts, indexShift);
};

function ddepInboundEmailSend(companyCode, item, result, schedulerUniqueId) {
	return new Promise((resolve) => {
		const smtp_options = {
			method: "post",
			url: config.domain + "/settings/edit/email-smtp",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ data: { "companyCode": companyCode } })
		};
		request(smtp_options, function (error, response, body) {
			if (response?.statusCode == 200) {
				const item_id = item._id;
				const CompanyCode = item.inbound_setting.CompanyCode;
				const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
				const smtpResult = JSON.parse(body);

				if (smtpResult.data.smtpActive == "1") {
					const notification_options = {
						method: "post",
						url: config.domain + "/notifications/edit/notification",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ data: { "companyCode": companyCode } })
					};
					request(notification_options, function (error, response, body) {
						if (response?.statusCode == 200) {
							const notification = JSON.parse(body);
							const isInboundDdepApiSuccess = (notification.status == 1 && notification.data.isInboundDdepApiSuccess == "on") ? "Enabled" : "Disabled";
							const isInboundDdepApiFail = (notification.status == 1 && notification.data.isInboundDdepApiFail == "on") ? "Enabled" : "Disabled";

							if (result == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: "FTP/SFTP > DDEP Inbound Successful : " + isInboundDdepApiSuccess });
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: "FTP/SFTP > DDEP Inbound Fail : " + isInboundDdepApiFail });
							}

							let isSend = notification.data.isInboundDdepApiSuccess;
							if (result != 1) {
								isSend = notification.data.isInboundDdepApiFail;
							}

							if (notification.status == 1 && isSend == "on") {
								(async function (x) {
									return await getLoghistories(item_id, schedulerUniqueId, "DDEP Inbound");
								})(0).then((logHistoriesResult) => {
									const item_code = item.ItemCode;
									const item_name = item.ItemName;
									const inboundSetting = item.inbound_setting;
									const serverName = config.domain + "/" + config.ddepPrefix + "/" + CompanyCode + inboundSetting.api_ddep_api;
									const outboundSetting = item.outbound_setting;
									const outboundApiUrl = outboundSetting.api_url;
									const providerName = notification.data.providerName;
									const toEmail = notification.data.email;

									let EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") DDEP Inbound Successful";
									if (result != 1) {
										EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") DDEP Inbound Fail";
									}

									const logHistoriesResults = logHistoriesResult;
									const logHistoriesResultsData = logHistoriesResults.data;

									let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DDEP Inbound Successful</title><style type="text/css">td, th {border: 1px solid #ddd;}</style></head><body style="background-color:#F4F4F4;"><center><table class="container600" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:calc(100%);max-width:calc(100%);margin: 0 auto;"><tr><td width="100%" style="text-align: left;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
									mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>OutBound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + serverName;
									mailContent += `</td></tr>`;
									mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>Outbound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + outboundApiUrl;
									mailContent += `</td></tr>`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>Event:</strong></td></tr><tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;

									let logEvents = ``;
									if (logHistoriesResultsData.length > 0) {
										logEvents += `<table class="smarttable" width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
										logEvents += `<thead>`;
										logEvents += `<tr>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Item ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Unique ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Type</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Action</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Description</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Created At</th>`;
										logEvents += `</tr>`;
										logEvents += `</thead>`;
										logEvents += `<tbody>`;

										for (let i = 0; i < logHistoriesResultsData.length; i++) {
											logEvents += `<tr>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i]._id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].item_id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].unique_id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].type + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].action + `</td>`;

											try {
												const jsonparse = JSON.parse(logHistoriesResultsData[i].description);
												if (jsonparse.inbound_setting != undefined && jsonparse.inbound_setting.ftp_password != undefined) {
													delete jsonparse.inbound_setting.ftp_password;
												}

												if (jsonparse.ftp_password != undefined) {
													delete jsonparse.ftp_password;
												}

												jsonstringify = JSON.stringify(jsonparse, null, "&nbsp;").split("\n").join("<br>");
												logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + jsonstringify + `</td>`;
											} catch (err) {
												logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].description + `</td>`;
											}

											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].createdAt + `</td>`;
											logEvents += `</tr>`;
										}

										logEvents += `</tbody>`;
										logEvents += `</table>`;
									}

									mailContent += logEvents + `<br>`;
									mailContent += `</td></tr>`;
									mailContent += `</table></td></tr></table></center></body></html>`;

									let smtpSecure = false;
									if (smtpResult.data.smtpPort == 465) {
										smtpSecure = true;
									}

									const transporter = nodemailer.createTransport({
										host: smtpResult.data.smtpServer,
										port: smtpResult.data.smtpPort,
										secure: smtpSecure,
										auth: {
											user: smtpResult.data.smtpAccount,
											pass: smtpResult.data.smtpPassword,
										},
										family: 4,
										maxConnections: 20,   // Respect per-domain limit
										maxMessages: 500,     // Optional, recycle connection after this
										rateLimit: 10         // Optional, messages per second
									});

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Connect", description: "SMTP " + smtpResult.data.smtpServer + " connected" });

									const mailConfigurations = {
										from: providerName + " <" + smtpResult.data.smtpEmail + ">",
										to: toEmail,
										subject: EmailSubject,
										html: mailContent,
									};

									transporter.sendMail(mailConfigurations, function (error, info) {
										if (error) {
											if (result == 1) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Send", description: item_id + " > Sent DDEP Inbound Successful Email to " + toEmail + " : Fail : Error : " + error });
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, action: "Inbound Email Send", description: item_id + " > Sent DDEP Inbound Fail Email to " + toEmail + " : Fail : Error : " + error });
											}
										} else {
											if (result == 1) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Send", description: item_id + " > Sent DDEP Inbound Successful Email to " + toEmail + " : Success" });
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Send", description: item_id + " > Sent DDEP Inbound Fail Email to " + toEmail + " : Success" });
											}
										}

										resolve({ code: "1", response: "" });
									});
								});
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "Inbound OutBound Success Notification Disabled" });

								resolve();
							}
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: error + " - Some error occurred while getting the notification setting." });

							resolve();
						}
					});
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "SMTP setting not active." });

					resolve();
				}
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: error + " - Some error occurred while getting the SMTP setting." });

				resolve();
			}
		});
	});
}

function ddepOutboundEmailSend(companyCode, item, result, schedulerUniqueId) {
	return new Promise((resolve) => {
		const smtp_options = {
			method: "post",
			url: config.domain + "/settings/edit/email-smtp",
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify({ data: { "companyCode": companyCode } })
		};
		request(smtp_options, function (error, response, body) {
			if (response?.statusCode == 200) {
				const item_id = item._id;
				const CompanyCode = item.inbound_setting.CompanyCode;
				const outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";
				const smtpResult = JSON.parse(body);

				if (smtpResult.data.smtpActive == "1") {
					const notification_options = {
						method: "post",
						url: config.domain + "/notifications/edit/notification",
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ data: { "companyCode": companyCode } })
					};
					request(notification_options, function (error, response, body) {
						if (response?.statusCode == 200) {
							const notification = JSON.parse(body);
							const isOutboundDdepApiSuccess = (notification?.status == 1 && notification?.data?.isOutboundDdepApiSuccess == "on") ? "Enabled" : "Disabled";
							const isOutboundDdepApiFail = (notification?.status == 1 && notification?.data?.isOutboundDdepApiFail == "on") ? "Enabled" : "Disabled";

							if (result == 1) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Option", description: "FTP/SFTP > DDEP Outbound Successful : " + isOutboundDdepApiSuccess });
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Option", description: "FTP/SFTP > DDEP Outbound Fail : " + isOutboundDdepApiFail });
							}

							let isSend = notification?.data?.isOutboundDdepApiSuccess;
							if (result != 1) {
								isSend = notification?.data?.isOutboundDdepApiFail;
							}

							if (notification?.status == 1 && isSend == "on") {
								(async function (x) {
									return await getLoghistories(item_id, schedulerUniqueId, "DDEP Outbound");
								})(0).then((logHistoriesResult) => {
									const item_code = item.ItemCode;
									const item_name = item.ItemName;
									const inboundSetting = item.inbound_setting;
									const serverName = config.domain + "/" + config.ddepPrefix + "/" + CompanyCode + inboundSetting.api_ddep_api;
									const outboundSetting = item.outbound_setting;
									const outboundApiUrl = outboundSetting.api_url;
									const providerName = notification.data.providerName;
									const toEmail = notification.data.email;

									let EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") DDEP Outbound Successful";
									if (result != 1) {
										EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") DDEP Outbound Fail";
									}

									const logHistoriesResults = logHistoriesResult;
									const logHistoriesResultsData = logHistoriesResults.data;

									let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DDEP Outbound Successful</title><style type="text/css">td, th {border: 1px solid #ddd;}</style></head><body style="background-color:#F4F4F4;"><center><table class="container600" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:calc(100%);max-width:calc(100%);margin: 0 auto;"><tr><td width="100%" style="text-align: left;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
									mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>OutBound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + serverName;
									mailContent += `</td></tr>`;
									mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>Outbound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + outboundApiUrl;
									mailContent += `</td></tr>`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
									mailContent += `<strong>Event:</strong></td></tr><tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;

									let logEvents = ``;
									if (logHistoriesResultsData.length > 0) {
										logEvents += `<table class="smarttable" width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
										logEvents += `<thead>`;
										logEvents += `<tr>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Item ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Unique ID</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Type</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Action</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Description</th>`;
										logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Created At</th>`;
										logEvents += `</tr>`;
										logEvents += `</thead>`;
										logEvents += `<tbody>`;

										for (let i = 0; i < logHistoriesResultsData.length; i++) {
											logEvents += `<tr>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i]._id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].item_id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].unique_id + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].type + `</td>`;
											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].action + `</td>`;

											try {
												const jsonparse = JSON.parse(logHistoriesResultsData[i].description);
												if (jsonparse.inbound_setting != undefined && jsonparse.inbound_setting.ftp_password != undefined) {
													delete jsonparse.inbound_setting.ftp_password;
												}

												if (jsonparse.ftp_password != undefined) {
													delete jsonparse.ftp_password;
												}

												jsonstringify = JSON.stringify(jsonparse, null, "&nbsp;").split("\n").join("<br>");
												logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + jsonstringify + `</td>`;
											} catch (err) {
												logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].description + `</td>`;
											}

											logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].createdAt + `</td>`;
											logEvents += `</tr>`;
										}

										logEvents += `</tbody>`;
										logEvents += `</table>`;
									}

									mailContent += logEvents + `<br>`;
									mailContent += `</td></tr>`;
									mailContent += `</table></td></tr></table></center></body></html>`;

									let smtpSecure = false;
									if (smtpResult.data.smtpPort == 465) {
										smtpSecure = true;
									}

									const transporter = nodemailer.createTransport({
										host: smtpResult.data.smtpServer,
										port: smtpResult.data.smtpPort,
										secure: smtpSecure,
										auth: {
											user: smtpResult.data.smtpAccount,
											pass: smtpResult.data.smtpPassword,
										},
										family: 4,
										maxConnections: 20,   // Respect per-domain limit
										maxMessages: 500,     // Optional, recycle connection after this
										rateLimit: 10         // Optional, messages per second
									});

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Connect", description: "SMTP " + smtpResult.data.smtpServer + " connected" });

									const mailConfigurations = {
										from: providerName + " <" + smtpResult.data.smtpEmail + ">",
										to: toEmail,
										subject: EmailSubject,
										html: mailContent,
									};

									transporter.sendMail(mailConfigurations, function (error, info) {
										if (error) {
											if (result == 1) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: item_id + " > Sent DDEP Outbound Successful Email to " + toEmail + " : Fail : Error : " + error });
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: item_id + " > Sent DDEP Outbound Fail Email to " + toEmail + " : Fail : Error : " + error });
											}
										} else {
											if (result == 1) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: item_id + " > Sent DDEP Outbound Successful Email to " + toEmail + " : Success" });
											} else {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: item_id + " > Sent DDEP Outbound Fail Email to " + toEmail + " : Success" });
											}
										}
										resolve({ code: "1", response: "" });
									});
								});
							} else {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "Outbound OutBound Success Notification Disabled" });

								resolve();
							}
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: error + " - Some error occurred while getting the notification setting." });

							resolve();
						}
					});
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "SMTP setting not active." });

					resolve();
				}
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: error + " - Some error occurred while getting the SMTP setting." });

				resolve();
			}
		});
	});
}

async function processOutboundApiUrls({ outboundApiUrls, outboundLastPath = "", queryString = "", enableLogs = "off", outboundEnableLog = "off", enableFullLogs = "off", companyCode, schedulerUniqueId, item, request_id }) {
	for (let l = 0; l < outboundApiUrls.length; l++) {
		let outbound_api_url = outboundApiUrls[l];

		if (outboundLastPath !== "") {
			outbound_api_url += outboundLastPath;
		}

		if (queryString !== "") {
			if (outbound_api_url.includes("?")) {
				outbound_api_url += "&" + queryString;
			} else {
				outbound_api_url += "?" + queryString;
			}
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id: item._id || item.item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "EndPoint URL", description: outbound_api_url, request_id });
	}
}

async function outboundrun(companyCode, item, logdir, logdatefilename, inboundResult, afterGlobalLogDescription) {
	return new Promise((resolve) => {
		const item_id = item._id;
		const item_code = item.ItemCode;
		const ItemName = item.ItemName;
		let inboundSettingData = item.inbound_setting;
		let outboundSettingData = item.outbound_setting;
		let inboundFilterData = item.inbound_filter;
		let propertiesSettingData = item.items_props;
		let mappingSettingData = item.mapping_setting;
		let mappingOutboundSettingData = item.mapping_outbound_setting;
		let propertiesOutboundSettingData = item.items_prop_outbounds;
		let outboundValidationSettingData = item.outbound_validation;
		let inboundEnableLog = (inboundSettingData.enableLog != undefined) ? inboundSettingData.enableLog : "off";
		let outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";

		let disabledOutboundResponseFailuresNotice = (outboundSettingData != undefined && outboundSettingData.disabledOutboundResponseFailuresNotice != undefined) ? outboundSettingData.disabledOutboundResponseFailuresNotice : "off";

		const todaydate = new Date();
		const prelogoutbound = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > ";

		const itemRunningSettingData = item.item_running_setting;
		let isRunningDataId = (inboundResult != undefined && inboundResult.isRunningDataId != undefined) ? inboundResult.isRunningDataId : "";
		if (itemRunningSettingData != undefined && itemRunningSettingData.is_inbound_running != undefined && itemRunningSettingData.is_inbound_running == 0 && itemRunningSettingData.is_outbound_running == 0) {
			isRunningDataId = itemRunningSettingData._id;
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start outbound" });

		let prelogoutboundtest = prelogoutbound.replace("keywords", "startoutbound");
		writelog(logdir + logdatefilename, prelogoutboundtest + item_id + "\n");

		(async function (x) {
			return await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "1");
		})(0).then((itemrundata) => {
			if (itemrundata.status === 1 && isRunningDataId === "") {
				isRunningDataId = itemrundata.id;
			}
		});

		const outboundsetting = item.outbound_setting;
		const max_file_post = (outboundsetting.max_file_post == undefined && outboundsetting.max_file_post != 0) ? 50 : outboundsetting.max_file_post;

		const outputdir = "./output";
		const directoryPath = outputdir + "/inbounds/" + item_id;
		const historydir = outputdir + "/history";
		const in_dir = historydir + "/inbounds";
		const in_itemdir = in_dir + "/" + item_id;
		const in_yearfolder = in_itemdir + "/" + todaydate.getFullYear();
		const in_month_folder = in_yearfolder + "/" + parseInt(todaydate.getMonth() + 1);
		const out_dir = historydir + "/outbounds";
		const convertfaildir = historydir + "/convertfail";
		const out_convertfaildir = convertfaildir + "/" + item_id;
		const sendingdir = outputdir + "/sending";
		const sending_dir = sendingdir + "/" + item_id;

		if (!fs.existsSync(in_itemdir)) {
			fs.mkdirSync(in_itemdir);
		}

		if (!fs.existsSync(in_yearfolder)) {
			fs.mkdirSync(in_yearfolder);
		}

		if (!fs.existsSync(in_month_folder)) {
			fs.mkdirSync(in_month_folder);
		}

		if (!fs.existsSync(out_convertfaildir)) {
			fs.mkdirSync(out_convertfaildir);
		}

		if (!fs.existsSync(sending_dir)) {
			fs.mkdirSync(sending_dir);
		}

		try {
			let filescounter = 0;
			let filescompletecounter = 0;
			let filesendcounter = 0;
			let timedouterr = 0;
			let newmsgglob = "Execute Outbound Error!";

			fs.readdir(directoryPath, async function (err, files) {
				if (err) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Scan", description: "Unable to scan directory " + directoryPath + " error : " + err });

					console.log("\nUnable to scan directory : " + err);
					prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
					writelog(logdir + logdatefilename, prelogoutboundtest + "Unable to scan directory : " + err + "\n");

					newmsgglob = "Unable to scan directory";
					const p1 = addGlobalMsg(newmsgglob);
					const p2 = addGlobalSuccess(0);

					(async function (x) {
						const result = { Status: globalsuccess, Msg: globalmsg, data: files };
						const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
						return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, "");
					})(0).then((v) => {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

						resolve({ Status: globalsuccess, Msg: newmsgglob });
					});
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Scan", description: "Scan " + directoryPath + " directory of project : " + item_id });

					console.log("\nScan " + directoryPath + " directory of project : " + item_id);
					prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
					writelog(logdir + logdatefilename, prelogoutboundtest + "Scan " + directoryPath + " directory of project : " + item_id + "\n");

					if (files.length == 0) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Scan", description: "Scan " + directoryPath + " directory no JSON file found" });

						prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
						writelog(logdir + logdatefilename, prelogoutboundtest + "No JSON file found" + "\n");

						globalfilelength = 1;
						newmsgglob = "No JSON file found";
						const p1 = addGlobalMsg(newmsgglob);
						const p2 = addGlobalSuccess(1);
					} else {
						globalfilelength = (max_file_post != undefined && max_file_post != 0 && max_file_post < files.length) ? max_file_post : files.length;

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Converting", description: "max_file_post : " + globalfilelength });

						let file = [];
						let filenames = [];
						for (let index = 0; index < globalfilelength; index++) {
							file[index] = files[index];
							filenames[index] = file[index].split(".").slice(0, -1).join(".") + "_" + todaydate.getFullYear() + parseInt(todaydate.getMonth() + 1) + todaydate.getDate() + todaydate.getHours() + todaydate.getMinutes() + todaydate.getSeconds();
							const fileExtension = file[index].split('.').pop().toLowerCase();
							const fileText = getFileText(fileExtension);

							try {
								filescounter++;

								prelogoutboundtest = prelogoutbound.replace("keywords", "converting2Json");
								writelog(logdir + logdatefilename, prelogoutboundtest + "Converting to Json File : " + directoryPath + "/" + file[index] + "\n");

								fs.copyFileSync(directoryPath + "/" + file[index], sending_dir + "/" + file[index], fs.constants.COPYFILE_EXCL);
								fs.unlinkSync(directoryPath + "/" + file[index]);

								try {

									let endpoints = [];
									let defaultInboundMapping = "";
									let defaultOutboundMapping = "";
									let defaultInboundMappingVersion = "";
									let defaultOutboundMappingVersion = "";
									let outboundResponse = "";
									let inboundFilterEnableLog = "off";
									let outboundFilterEnableLog = "off";
									let outboundFilterData = [];
									let outboundLastPath = "";
									let queryString = "";
									let currentHeader = { "content-type": "application/json" };
									let enabledebug = "no";
									let inboundEnableEmail = (inboundSettingData != undefined && inboundSettingData.enableEmail != undefined) ? inboundSettingData.enableEmail : "off";
									endpoints = outboundSettingData.endpoints;
									defaultInboundMapping = outboundSettingData.defaultInboundMapping;
									defaultOutboundMapping = outboundSettingData.defaultOutboundMapping;
									defaultInboundMappingVersion = outboundSettingData.defaultInboundMappingVersion;
									defaultOutboundMappingVersion = outboundSettingData.defaultOutboundMappingVersion;

									const newReqBody = {
										file: fs.readFileSync(sending_dir + "/" + file[index]).toString("base64"),
										extension: fileExtension
									};
									const newBodyReq = {
										file: fs.readFileSync(sending_dir + "/" + file[index]).toString("base64"),
										extension: fileExtension
									};

									let responseBody = { headers: {}, method: "POST", url: "", reqBody: newBodyReq };

									let request_id = '';
									let endpoint_count = 0;
									try {
										for (let i = 0; i < endpoints.length; i++) {
											if (endpoints[i].status) {
												request_id = uuidv4();
												endpoint_count = i == 0 ? 0 : endpoint_count + 1;
												inboundFilterData = [];
												propertiesSettingData = [];
												inboundFilterEnableLog = "off";
												mappingSettingData = {};
												item.mapping_setting = {};
												outboundFilterData = [];
												propertiesOutboundSettingData = [];
												if (!outboundValidationSettingData) {
													outboundValidationSettingData = endpoints[i]?.triggerRules || [];
												}
												outboundFilterEnableLog = "off";
												outboundSettingData = item.outbound_setting;
												mappingOutboundSettingData = {};
												item.mapping_outbound_setting = {};
												const endpoint = endpoints[i].endpoint || null;
												const partyId = endpoints[i].party || null;
												const inboundMappingId = endpoints[i].inboundMapping || defaultInboundMapping;
												const outboundMappingId = endpoints[i].outboundMapping || defaultOutboundMapping;
												const inboundMappingVersion = endpoints[i].inboundMappingVersion || defaultInboundMappingVersion;
												const outboundMappingVersion = endpoints[i].outboundMappingVersion || defaultOutboundMappingVersion;
												const specifyHeaders = endpoints[i].specifyHeaders || null;
												outboundSettingData.specifyHeaders = specifyHeaders;
												let outboundApiUrls = [];

												if (partyId) {
													const party = await findPartyById(partyId, item.environmentId);
													const environments = party.data.environments;

													for (let i = 0; i < environments.length; i++) {
														outboundApiUrls.push(environments[i].domainPrefix + environments[i].domain + endpoint)
													}
												}

												mappingSettingData = {
													enableLog: inboundEnableLog,
													enableEmail: inboundEnableEmail,
												}

												if (inboundMappingId) {
													const inboundMapping = await findMappingProfileHistoryById(inboundMappingId, inboundMappingVersion, item.ProjectId);

													inboundFilterData = {
														is_active: (inboundMapping.data?.isActive) ? "Active" : "Inactive",
														inbound_filter: inboundMapping.data?.filters || []
													};
													propertiesSettingData = { item_properties: inboundMapping.data?.properties || [] };
													inboundFilterEnableLog = inboundEnableLog;
													mappingSettingData = {
														...mappingSettingData,
														inbound_format: inboundMapping.data?.inboundFormatData || "",
														outbound_format: inboundMapping.data?.outboundFormatData || "",
														mapping_data: inboundMapping.data?.mappingData || "",
														is_active: (inboundMapping.data?.isActive) ? "Active" : "Inactive",
														returnUrl: inboundMapping.data?.returnUrl || "",
														enableLog: inboundEnableLog,
														enableEmail: inboundEnableEmail,
													};
													item.mapping_setting = mappingSettingData;
													outboundSettingData.sendCollectionOnebyOne = (inboundMapping.data?.sendCollectionOnebyOne) ? "on" : "off";
													outboundSettingData.collections_name = (inboundMapping.data?.collectionsName) ? inboundMapping.data?.collectionsName : "";
												}

												if (outboundMappingId) {
													const outboundMapping = await findMappingProfileHistoryById(outboundMappingId, outboundMappingVersion, item.ProjectId);
													outboundFilterData = {
														is_active: (outboundMapping.data?.isActive) ? "Active" : "Inactive",
														outbound_filter: outboundMapping.data?.filters || []
													};
													propertiesOutboundSettingData = { item_properties: outboundMapping.data?.properties || [] };
													outboundValidationSettingData = endpoints[i]?.triggerRules || [];
													outboundFilterEnableLog = outboundEnableLog;
													outboundSettingData.outbound_format = item?.outbound_setting?.outbound_format || ["json"];
													mappingOutboundSettingData = {
														inbound_format: outboundMapping.data?.inboundFormatData || "",
														outbound_format: outboundMapping.data?.outboundFormatData || "",
														mapping_data: outboundMapping.data?.mappingData || "",
														is_active: (outboundMapping.data?.isActive) ? "Active" : "Inactive",
														returnUrl: outboundMapping.data?.returnUrl || "",
														enableLog: outboundEnableLog
													}
													item.mapping_outbound_setting = mappingOutboundSettingData;
												}

												let currentReqBody = newReqBody;
												let currentBodyReq = newBodyReq;
												let inboundPostData = newReqBody;
												let OutboundFormatData = {};
												let nodeDataArray = [];
												let linkDataArray = [];
												let outboundMappedData = {};
												let outboundPostDataFormat = "json";
												let outboundResponseDataFormat = "json";
												let inboundFormatData = {};
												let inboundPostDataUnkeyArr = false;
												let outboundPostDataUnkeyArr = false;
												let outboundResponseDataUnkeyArr = false;
												let inboundFormatDataUnkeyArr = false;
												let outboundFormatDataUnkeyArr = false;
												let reqMethod = "POST"

												const inboundFilterHandlerRes = await inboundFilterHandler(enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, currentReqBody, inboundPostData, inboundPostDataUnkeyArr, inboundFilterData, item, inboundFilterEnableLog, currentBodyReq, outboundMappedData, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, "no", {}, {}, [], [], [], [], {}, request_id, reqMethod, "Scheduler", logdir, logdatefilename);

												if (inboundFilterHandlerRes.code == 1) {
													const specificEmail = specifyHeaders?.notificationEmail || '';
													await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });

													prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
													writelog(logdir + logdatefilename, prelogoutboundtest + "Inbound Filter Error : " + inboundFilterHandlerRes.LongMsg + "\n");

													filescompletecounter++;

													newmsgglob = inboundFilterHandlerRes.LongMsg;
													const p1 = addGlobalMsg(newmsgglob);
													const p2 = addGlobalSuccess(0);

													if (filescompletecounter >= globalfilelength) {
														(async function (x) {
															const seconds = 3000;
															const p1 = sleep(seconds);
															return x + await p1;
														})(0).then((v) => {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

															prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
															writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

															newmsgglob = "Execute Outbound Successful";
															const p1 = addGlobalMsg(newmsgglob);
															const p2 = addGlobalSuccess(1);

															(async function (x) {
																const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
															})(0).then((v) => {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

																resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
															});
														});
													}

													continue;
												} else {
													inboundPostData = inboundFilterHandlerRes.inboundPostData;
													inboundPostDataUnkeyArr = inboundFilterHandlerRes.inboundPostDataUnkeyArr;
													currentBodyReq = inboundFilterHandlerRes.bodyreq;
													currentReqBody = inboundFilterHandlerRes.reqBody;
												}

												let request_method = specifyHeaders?.request_method || 'DEFAULT';
												if (request_method == 'DEFAULT') {
													request_method = reqMethod;
												}

												let endpointMeta = { url: "", method: request_method, headers: {}, querystrings: {}, row: endpoint_count, error: false, errorMessage: '', statusCode: '', responseTimeMs: 0 }
												let generalValues = { inboundPostData: inboundPostData, inboundMappingData: currentBodyReq }

												const inboundMappingHandlerRes = await inboundMappingHandler(outboundSettingData, enableLogs, enableFullLogs, companyCode, schedulerUniqueId, inboundEnableLog, outboundEnableLog, item_id, item, currentReqBody, currentBodyReq, mappingSettingData, inboundFormatData, inboundPostData, propertiesSettingData, inboundFormatDataUnkeyArr, outboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, outboundPostDataFormat, nodeDataArray, linkDataArray, outboundMappedData, OutboundFormatData, ItemName, "", outboundApiUrls, outboundLastPath = "", dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString = "", "true", "no", {}, {}, [], [], [], [], {}, request_id, reqMethod, endpointMeta, generalValues, "Scheduler", logdir, logdatefilename);

												if (inboundMappingHandlerRes.code == 1) {
													const specificEmail = specifyHeaders?.notificationEmail || '';
													await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });

													prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
													writelog(logdir + logdatefilename, prelogoutboundtest + inboundMappingHandlerRes.logMsg + inboundMappingHandlerRes.LongMsg + "\n");

													filescompletecounter++;

													newmsgglob = inboundMappingHandlerRes.LongMsg;
													const p1 = addGlobalMsg(newmsgglob);
													const p2 = addGlobalSuccess(0);

													if (filescompletecounter >= globalfilelength) {
														(async function (x) {
															const seconds = 3000;
															const p1 = sleep(seconds);
															return x + await p1;
														})(0).then((v) => {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

															prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
															writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

															newmsgglob = "Execute Outbound Successful";
															const p1 = addGlobalMsg(newmsgglob);
															const p2 = addGlobalSuccess(1);

															(async function (x) {
																const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
															})(0).then((v) => {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

																resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
															});
														});
													}

													continue;
												} else {
													currentReqBody = inboundMappingHandlerRes.reqBody;
													currentBodyReq = inboundMappingHandlerRes.bodyreq;
													inboundFormatData = inboundMappingHandlerRes.inboundFormatData;
													inboundFormatDataUnkeyArr = inboundMappingHandlerRes.inboundFormatDataUnkeyArr;
													outboundPostDataUnkeyArr = inboundMappingHandlerRes.outboundPostDataUnkeyArr;
													outboundFormatDataUnkeyArr = inboundMappingHandlerRes.outboundFormatDataUnkeyArr;
													outboundPostDataFormat = inboundMappingHandlerRes.outboundPostDataFormat;
													nodeDataArray = inboundMappingHandlerRes.nodeDataArray;
													linkDataArray = inboundMappingHandlerRes.linkDataArray;
													outboundMappedData = inboundMappingHandlerRes.outboundMappedData;
													OutboundFormatData = inboundMappingHandlerRes.OutboundFormatData;
												}

												if (mappingSettingData?.returnUrl && inboundMappingHandlerRes.code == 0) {
													const returnUrlResponse = await sendResponseToReturnUrl(request_method, mappingSettingData?.returnUrl, outboundMappedData, enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, item_id, request_id, logdir, logdatefilename);

													if (returnUrlResponse.code == 1) {
														const specificEmail = specifyHeaders?.notificationEmail || '';
														await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });

														prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
														writelog(logdir + logdatefilename, prelogoutboundtest + "Return Url Posting Error:" + returnUrlResponse.LongMsg + "\n");

														filescompletecounter++;

														newmsgglob = inboundMappingHandlerRes.LongMsg;
														const p1 = addGlobalMsg(newmsgglob);
														const p2 = addGlobalSuccess(0);

														if (filescompletecounter >= globalfilelength) {
															(async function (x) {
																const seconds = 3000;
																const p1 = sleep(seconds);
																return x + await p1;
															})(0).then((v) => {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

																prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
																writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

																newmsgglob = "Execute Outbound Successful";
																const p1 = addGlobalMsg(newmsgglob);
																const p2 = addGlobalSuccess(1);

																(async function (x) {
																	const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																	const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																	return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
																})(0).then((v) => {
																	addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

																	resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
																});
															});
														}

														continue;
													}
												}

												try {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start Outbound", request_id });

													prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
													writelog(logdir + logdatefilename, prelogoutboundtest + "Start Outbound" + "\n");

													let outboundValidationHandlerRes = await outboundValidationHandler(outboundValidationSettingData, currentReqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, "no", item, {}, {}, [], [], [], [], {}, request_id, request_method, endpointMeta, inboundPostData, outboundMappedData, {}, {}, "Scheduler", logdir, logdatefilename);

													if (outboundValidationHandlerRes.code == 1) {
														const specificEmail = specifyHeaders?.notificationEmail || '';
														await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });

														prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
														writelog(logdir + logdatefilename, prelogoutboundtest + outboundValidationHandlerRes.logQueueMsg + outboundValidationHandlerRes.LongMsg + "\n");

														filescompletecounter++;

														newmsgglob = outboundValidationHandlerRes.LongMsg;
														const p1 = addGlobalMsg(newmsgglob);
														const p2 = addGlobalSuccess(0);

														if (filescompletecounter >= globalfilelength) {
															(async function (x) {
																const seconds = 3000;
																const p1 = sleep(seconds);
																return x + await p1;
															})(0).then((v) => {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

																prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
																writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

																newmsgglob = "Execute Outbound Successful";
																const p1 = addGlobalMsg(newmsgglob);
																const p2 = addGlobalSuccess(1);

																(async function (x) {
																	const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																	const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																	return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
																})(0).then((v) => {
																	addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

																	resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
																});
															});
														}

														continue;
													}

													for (let l = 0; l < outboundApiUrls.length; l++) {
														outboundSettingData.api_url = outboundApiUrls[l];
														outboundSettingData.specifyHeaders = specifyHeaders;
														outboundSettingData.outbound_format = item.outbound_setting.outbound_format;
														outboundSettingData.disabledOutboundResponseFailuresNotice = disabledOutboundResponseFailuresNotice

														const outboundHandlerRes = await outboundHandler(inboundPostData, outboundSettingData, currentReqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, outboundLastPath, queryString, currentHeader, responseBody, outboundPostDataUnkeyArr, inboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, currentBodyReq, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundMappedData, outboundResponseDataFormat, inboundFormatDataUnkeyArr, inboundEnableLog, inboundFilterEnableLog, request_id, request_method, logdir, logdatefilename, afterGlobalLogDescription, endpoint_count);

														outboundResponse = outboundHandlerRes;

														if (mappingOutboundSettingData?.returnUrl && outboundResponse.code == 0) {
															const returnUrlResponse = await sendResponseToReturnUrl(request_method, mappingOutboundSettingData.returnUrl, outboundResponse.data, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, item_id, logdir, logdatefilename);

															if (returnUrlResponse.code == 1) {
																const specificEmail = specifyHeaders?.notificationEmail || '';
																prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
																writelog(logdir + logdatefilename, prelogoutboundtest + "Return Url Posting Error:" + returnUrlResponse.LongMsg + "\n");

																filescompletecounter++;

																newmsgglob = inboundMappingHandlerRes.LongMsg;
																const p1 = addGlobalMsg(newmsgglob);
																const p2 = addGlobalSuccess(0);

																if (filescompletecounter >= globalfilelength) {
																	(async function (x) {
																		const seconds = 3000;
																		const p1 = sleep(seconds);
																		return x + await p1;
																	})(0).then((v) => {
																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter });

																		prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
																		writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

																		newmsgglob = "Execute Outbound Successful";
																		const p1 = addGlobalMsg(newmsgglob);
																		const p2 = addGlobalSuccess(1);

																		(async function (x) {
																			const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																			const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																			return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
																		})(0).then((v) => {
																			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

																			resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
																		});
																	});
																}

																continue;
															}
														}

														if (outboundHandlerRes.code == 1) {
															const specificEmail = specifyHeaders?.notificationEmail || '';
															prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
															writelog(logdir + logdatefilename, prelogoutboundtest + outboundHandlerRes.logMsg + outboundHandlerRes.LongMsg + "\n");

															filescompletecounter++;

															newmsgglob = outboundHandlerRes.LongMsg;
															const p1 = addGlobalMsg(newmsgglob);
															const p2 = addGlobalSuccess(0);

															if (filescompletecounter >= globalfilelength) {
																(async function (x) {
																	const seconds = 3000;
																	const p1 = sleep(seconds);
																	return x + await p1;
																})(0).then((v) => {
																	addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter });

																	prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
																	writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

																	newmsgglob = "Execute Outbound Successful";
																	const p1 = addGlobalMsg(newmsgglob);
																	const p2 = addGlobalSuccess(1);

																	(async function (x) {
																		const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																		const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																		return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
																	})(0).then((v) => {
																		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

																		resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
																	});
																});
															}

															continue;
														}
													}

													if (outboundResponse.code == 1) {
														continue;
													}
												} catch (err) {
													const specificEmail = specifyHeaders?.notificationEmail || '';
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound validation setting.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound validation setting." });

													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound validation setting." });

													prelogoutboundtest = prelogoutbound.replace("keywords", "converted2Json-error");
													writelog(logdir + logdatefilename, prelogoutboundtest + "Some error occurred while checking outbound validation setting : " + directoryPath + "/" + file[index] + "\n");
													writelog(logdir + logdatefilename, prelogoutboundtest + "Some error occurred while checking outbound validation setting : " + err + "\n");

													fs.copyFileSync(directoryPath + "/" + file[index], out_convertfaildir + "/" + filenames[index] + "." + fileExtension, fs.constants.COPYFILE_EXCL);
													fs.unlinkSync(directoryPath + "/" + file[index]);

													filescompletecounter++;

													const p1 = addGlobalMsg(newmsgglob);
													const p2 = addGlobalSuccess(0);

													if (filescompletecounter >= globalfilelength) {
														(async function (x) {
															const seconds = 3000;
															const p1 = sleep(seconds);
															return x + await p1;
														})(0).then((v) => {
															addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter });

															prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
															writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

															newmsgglob = "Execute Outbound Successful";
															const p1 = addGlobalMsg(newmsgglob);
															const p2 = addGlobalSuccess(1);

															(async function (x) {
																const result = { Status: globalsuccess, Msg: globalmsg, data: files };
																const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
																return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, specificEmail);
															})(0).then((v) => {
																addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

																resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
															});
														});
													}
												}
											}
										}
									} catch (err) {
										filescompletecounter++;

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Error", description: "catch " + err + " - Some error occurred while run mapping function.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while run mapping function.", request_id });

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Error", description: "catch " + err + " - Some error occurred while run mapping function.", request_id });

										newmsgglob = "catch " + err + " - Some error occurred while run mapping function.";
										const p1 = addGlobalMsg(newmsgglob);
										const p2 = addGlobalSuccess(0);

										if (filescompletecounter >= globalfilelength) {
											(async function (x) {
												const seconds = 3000;
												const p1 = sleep(seconds);
												return x + await p1;
											})(0).then((v) => {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

												prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
												writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

												newmsgglob = "Execute Outbound Successful";
												const p1 = addGlobalMsg(newmsgglob);
												const p2 = addGlobalSuccess(1);

												(async function (x) {
													const result = { Status: globalsuccess, Msg: globalmsg, data: files };
													const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
													return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, "");
												})(0).then((v) => {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

													resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
												});
											});
										}
									} finally {
										filescompletecounter++;
										if (filescompletecounter >= globalfilelength) {
											(async function (x) {
												const seconds = 3000;
												const p1 = sleep(seconds);
												return x + await p1;
											})(0).then((v) => {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter, request_id });

												prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
												writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

												newmsgglob = "Execute Outbound Successful";
												const p1 = addGlobalMsg(newmsgglob);
												const p2 = addGlobalSuccess(1);

												(async function (x) {
													const result = { Status: globalsuccess, Msg: globalmsg, data: files };
													const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
													return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, "");
												})(0).then((v) => {
													addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200", request_id });

													resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
												});
											});
										}

										try {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save file", description: `${fileText} file save in ` + in_month_folder + "/" + filenames[index] + "." + fileExtension });

											prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogoutboundtest + `${fileText} file save in ` + in_month_folder + " folder" + "\n");

											fs.copyFileSync(sending_dir + "/" + file[index], in_month_folder + "/" + filenames[index] + "." + fileExtension, fs.constants.COPYFILE_EXCL);

											prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogoutboundtest + `${fileText} file saved : ` + in_month_folder + "/" + filenames[index] + "." + fileExtension + "\n");
											try {
												fs.unlinkSync(sending_dir + "/" + file[index]);

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Delete file", description: `${fileText} file deleted : ` + directoryPath + "/" + file[index] });

												console.log("\nSuccessfully deleted : " + file[index]);
												prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
												writelog(logdir + logdatefilename, prelogoutboundtest + `${fileText} file deleted : ` + directoryPath + "/" + file[index] + "\n");
											} catch (err) {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Delete file", description: `Error catch while ${fileText} file deleting into : ` + directoryPath + "/" + file[index], exception_type: "System Error", item: ItemName, detail_exception: `Error catch while ${fileText} file deleting into : ` + directoryPath + "/" + file[index] });

												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Delete file", description: `Error catch while ${fileText} file deleting into : ` + directoryPath + "/" + file[index] });

												prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
												writelog(logdir + logdatefilename, prelogoutboundtest + `error catch while ${fileText} file deleting into : ` + directoryPath + "/" + file[index] + "\n");
											}
										} catch (err) {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save file", description: `Error catch while ${fileText} file saving into : ` + in_month_folder + "/" + filenames[index] + "." + fileExtension, exception_type: "System Error", item: ItemName, detail_exception: `Error catch while ${fileText} file saving into : ` + in_month_folder + "/" + filenames[index] + "." + fileExtension });

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save file", description: `Error catch while ${fileText} file saving into : ` + in_month_folder + "/" + filenames[index] + "." + fileExtension });

											prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogoutboundtest + `error catch while ${fileText} file saving into : ` + in_month_folder + "/" + filenames[index] + "." + fileExtension + "\n");
										}
									}
								} catch (err) {
									filescompletecounter++;

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while transformed JSON : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while transformed JSON : " + err });

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while transformed JSON : " + directoryPath + "/" + file[index] });

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while transformed JSON : " + err });

									prelogoutboundtest = prelogoutbound.replace("keywords", "converted2Json-error");
									writelog(logdir + logdatefilename, prelogoutboundtest + "Error catch while transformed JSON : " + directoryPath + "/" + file[index] + "\n");
									writelog(logdir + logdatefilename, prelogoutboundtest + "Error catch while transformed JSON : " + err + "\n");

									fs.copyFileSync(directoryPath + "/" + file[index], out_convertfaildir + "/" + filenames[index] + "." + fileExtension, fs.constants.COPYFILE_EXCL);
									fs.unlinkSync(directoryPath + "/" + file[index]);

									const p1 = addGlobalMsg(newmsgglob);
									const p2 = addGlobalSuccess(0);

									if (filescompletecounter >= globalfilelength) {
										(async function (x) {
											const seconds = 3000;
											const p1 = sleep(seconds);
											return x + await p1;
										})(0).then((v) => {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter });

											prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
											writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

											newmsgglob = "Execute Outbound Successful";
											const p1 = addGlobalMsg(newmsgglob);
											const p2 = addGlobalSuccess(1);

											(async function (x) {
												const result = { Status: globalsuccess, Msg: globalmsg, data: files };
												const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
												return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type, "");
											})(0).then((v) => {
												addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

												resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
											});
										});
									}
								}
							} catch (err) {
								filescompletecounter++;

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while fetch file for convert into JSON : " + err, exception_type: "System Error", item: ItemName, detail_exception: "Error catch while fetch file for convert into JSON : " + err });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while fetch file for convert into JSON : " + directoryPath + "/" + file[index] });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Convert fail", description: "Error catch while fetch file for convert into JSON : " + err });

								prelogoutboundtest = prelogoutbound.replace("keywords", "converted2Json-error");
								writelog(logdir + logdatefilename, prelogoutboundtest + "Error catch while fetch file for convert into JSON : " + directoryPath + "/" + file[index] + "\n");

								try {
									fs.copyFileSync(directoryPath + "/" + file, out_convertfaildir + "/" + filenames[index] + "." + fileExtension, fs.constants.COPYFILE_EXCL);
									fs.unlinkSync(directoryPath + "/" + file[index]);
								} catch (err) { }

								newmsgglob = prelogoutboundtest + "Error while fetch file for convert into json : " + directoryPath + "/" + file[index];
								const p1 = addGlobalMsg(newmsgglob);
								const p2 = addGlobalSuccess(0);

								if (filescompletecounter >= globalfilelength) {
									(async function (x) {
										const seconds = 3000;
										const p1 = sleep(seconds);
										return x + await p1;
									})(0).then((v) => {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Total post", description: "Total files send completed : " + filesendcounter });

										prelogoutboundtest = prelogoutbound.replace("keywords", "not defined");
										writelog(logdir + logdatefilename, prelogoutboundtest + "Total Files Send Completed : " + filesendcounter + "\n");

										newmsgglob = "Execute Outbound Successful";
										const p1 = addGlobalMsg(newmsgglob);
										const p2 = addGlobalSuccess(1);

										(async function (x) {
											const result = { Status: globalsuccess, Msg: globalmsg, data: files };
											const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
											return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type);
										})(0).then((v) => {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Success", httpStatus: "200" });

											resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
										});
									});
								}
							}
						}
					}

					(async function (x) {
						const seconds = globalfilelength * 2000;
						const p1 = sleep(seconds);
						return x + await p1;
					})(0).then((v) => {
						if (filescounter == 0) {
							(async function (x) {
								const result = { Status: globalsuccess, Msg: globalmsg, data: files };
								const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
								return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter, inboundSettingData.sync_type);
							})(0).then((v) => {
								const logDescription = (globalsuccess === 1) ? "Success" : "Fail";
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: logDescription, httpStatus: "200" });

								resolve({ Status: globalsuccess, Msg: globalmsg, data: files });
							});
						}
					});
				}
			});
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: inboundSettingData.sync_type, description: err, exception_type: "System Error", item: ItemName, detail_exception: err });

			(async function (x) {
				const result = { Status: globalsuccess, Msg: globalmsg, data: files };
				const itemrundata = await setCurrentRunningItem(logdir, prelogoutbound, logdatefilename, isRunningDataId, item_id, "0", "0");
				return await listarroutboundrun(companyCode, logdir, logdatefilename, item, globalsuccess, filescounter, filesendcounter);
			})(0).then((v) => {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: inboundSettingData.sync_type, description: globalmsg });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: inboundSettingData.sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200" });

				resolve({ Status: 0, Msg: globalmsg });
			});
		}
	});
}

async function outboundHandler(inboundPostData, outboundSettingData, reqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, outboundLastPath, queryString, newHeader, responseBody, outboundPostDataUnkeyArr, inboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, bodyreq, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundMappedData, outboundResponseDataFormat, inboundFormatDataUnkeyArr, inboundEnableLog, inboundFilterEnableLog, request_id, request_method, logdir, logdatefilename, afterGlobalLogDescription, endpoint_count) {
	return new Promise(async (resolve) => {
		try {
			const todaydate = new Date();
			const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
			let prelogtest = prelog.replace("keywords", "not defined");

			let outbound_api_url = outboundSettingData.api_url;
			let outbound_format = outboundSettingData.outbound_format;
			let inboundMappingData = outboundMappedData;

			if (typeof outbound_format === "string") {
				outbound_format = [outbound_format];
			}

			const outbound_send_collection_one_by_one = (outboundSettingData.sendCollectionOnebyOne != undefined) ? outboundSettingData.sendCollectionOnebyOne : "off";
			let outbound_collections_name = (outboundSettingData.collections_name != undefined) ? outboundSettingData.collections_name : "";
			let isCollectionExist = false;

			if (outbound_send_collection_one_by_one != "off" && outbound_collections_name != "") {
				outbound_collections_name = outbound_collections_name.replace("@Out{", "").replace("@out{", "").replace("@In{", "").replace("@in{", "").replace("}", "");
				const outbound_collections_name_arr = outbound_collections_name.split(".");

				if (outbound_collections_name_arr.length > 0) {
					if (outbound_collections_name_arr.length == 1 && reqBody[outbound_collections_name_arr[0]] != undefined) {
						isCollectionExist = true;
						reqBody = reqBody[outbound_collections_name_arr[0]];
					} else {
						if (outbound_collections_name_arr[0] != undefined && reqBody[outbound_collections_name_arr[0]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[0]];
						}

						if (outbound_collections_name_arr[1] != undefined && reqBody[outbound_collections_name_arr[1]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[1]];
						}

						if (outbound_collections_name_arr[2] != undefined && reqBody[outbound_collections_name_arr[2]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[2]];
						}

						if (outbound_collections_name_arr[3] != undefined && reqBody[outbound_collections_name_arr[3]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[3]];
						}

						if (outbound_collections_name_arr[4] != undefined && reqBody[outbound_collections_name_arr[4]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[4]];
						}

						if (outbound_collections_name_arr[5] != undefined && reqBody[outbound_collections_name_arr[5]] != undefined) {
							isCollectionExist = true;
							reqBody = reqBody[outbound_collections_name_arr[5]];
						}
					}
				}
			}

			if (outbound_send_collection_one_by_one == "on" && !isCollectionExist) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound send collections not found.", request_id });

				resolve({
					code: "1",
					MsgCode: "50001",
					MsgType: "Invalid-Source",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: "Collection does not exist in data.",
					logMsg: "Outbound send collections not found.",
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					Data: [],
					logQueueMsg: "Fail",
					logType: outboundEnableLog,
					httpStatus: "200"
				});
			} else {
				if (outboundLastPath != "") {
					outbound_api_url += outboundLastPath;
				}

				if (queryString != "") {
					outbound_api_url += "?" + queryString;
				}

				let outboundApiHeaders = newHeader;
				delete outboundApiHeaders.Host;
				delete outboundApiHeaders["Accept-Encoding"];
				delete outboundApiHeaders.Connection;
				delete outboundApiHeaders["Content-Length"];

				const outboundGlobalHeaders = outboundSettingData?.globalHeaders || [];
				if (outboundGlobalHeaders && outboundGlobalHeaders.length > 0) {
					for (let i = 0; i < outboundGlobalHeaders.length; i++) {
						const { key, value, status } = outboundGlobalHeaders[i];

						if (status || status == "true") {
							let headerValue = value || '';
							headerValue = replacePlaceholders(headerValue, {}, {}, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);
							headerValue = await formulaGetValue(companyCode, headerValue, headerValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, {}, {}, [], [], [], [], {}, request_id, request_method);
							outboundApiHeaders[key] = headerValue;
							header = { ...header, [key]: headerValue };
							console.log("\nHeader:", header);
						}
					}
				}

				const outboundSpecifyHeaders = outboundSettingData?.specifyHeaders?.headers || outboundSettingData?.specifyHeaders || [];
				for (let i = 0; i < outboundSpecifyHeaders.length; i++) {
					const { key, value, status } = outboundSpecifyHeaders[i];

					if (status || status == "true") {
						let headerValue = value || '';
						headerValue = replacePlaceholders(headerValue, {}, {}, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);
						headerValue = await formulaGetValue(companyCode, headerValue, headerValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, {}, {}, [], [], [], [], {}, request_id, request_method);
						outboundApiHeaders[key] = headerValue;
					}
				}

				let outbound_api_options = {
					method: responseBody.method,
					url: outbound_api_url,
					headers: outboundApiHeaders,
				};

				if (outbound_send_collection_one_by_one == "on" && outboundPostDataUnkeyArr && !inboundPostDataUnkeyArr && reqBody.items != undefined) {
					reqBody = reqBody.items;
					outboundPostDataUnkeyArr = false;
				} else if (outbound_send_collection_one_by_one == "on" && !outboundPostDataUnkeyArr && inboundPostDataUnkeyArr && reqBody.items != undefined) {
					reqBody = reqBody.items;
					inboundPostDataUnkeyArr = false;
				} else if (outbound_send_collection_one_by_one == "on" && outboundPostDataUnkeyArr && inboundPostDataUnkeyArr && reqBody.items != undefined) {
					reqBody = reqBody.items;
					outboundPostDataUnkeyArr = false;
					inboundPostDataUnkeyArr = false;
				} else if (outbound_send_collection_one_by_one == "off" && outboundPostDataUnkeyArr && inboundPostDataUnkeyArr && reqBody.items != undefined) {
					reqBody = reqBody.items;
					outboundPostDataUnkeyArr = false;
					inboundPostDataUnkeyArr = false;
				}

				let newReqBody = reqBody;
				if (!Array.isArray(reqBody) || outboundFormatDataUnkeyArr) {
					let reqBodyArr = [];
					if (Array.isArray(reqBody)) {
						reqBodyArr = reqBody;
					} else {
						reqBodyArr.push(reqBody);
					}
					newReqBody = reqBodyArr;
				}

				if (Array.isArray(reqBody) && inboundPostDataUnkeyArr) {
					newReqBody = reqBody;
					inboundPostDataUnkeyArr = false;
				}

				if (newReqBody.length > 0) {
					for (const [index, reqBody] of newReqBody.entries()) {
						let xmlbodyreq = "";
						let outbound_api_options_body = outbound_api_options;
						if (bodyreq != "") {
							let bodyContent;
							if (outbound_format.includes("xml")) {
								const builder = new xml2js.Builder();
								bodyContent = builder.buildObject(reqBody);
								outbound_api_options["body"] = bodyContent;
								outbound_api_options.headers["Content-Length"] = Buffer.byteLength(bodyContent, 'utf8');
							} else {
								bodyContent = JSON.stringify(reqBody);
								outbound_api_options["body"] = bodyContent;
								outbound_api_options.headers["Content-Length"] = Buffer.byteLength(bodyContent, 'utf8');
								outbound_api_options.headers["Content-Type"] = "application/json";
							}
							outbound_api_options_body = outbound_api_options;
						} else {
							outbound_api_options["formData"] = JSON.parse(JSON.stringify(reqBody));
							if (Object.entries(outbound_api_options.formData).length == 0) {
								outbound_api_options.method = "GET";
							}
							outbound_api_options_body = outbound_api_options;
						}

						if (isCollectionExist) {
							if (index !== 0) {
								request_id = uuidv4();
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Collection configure", description: index, request_id });
						}

						// const request_method = outboundSettingData?.specifyHeaders?.request_method || 'DEFAULT';

						// if (request_method !== "DEFAULT") {
						outbound_api_options_body = { ...outbound_api_options_body, method: request_method }
						outbound_api_options = { ...outbound_api_options, method: request_method }
						// }

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "EndPoint URL", description: outbound_api_url, request_id });

						if (enabledebug.toLowerCase() == "true") {
							if (xmlbodyreq == "") {
								resolve({
									code: "0",
									contentType: "application/json",
									statusCode: 200,
									data: reqBody
								});
							} else {
								resolve({
									code: "0",
									contentType: "application/xml",
									statusCode: 200,
									data: reqBody
								});
							}
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Post Data", description: "Posting Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify({ ...outbound_api_options, body: safeJSONWithOutStringify(outbound_api_options.body, config.dataSize) }) : "", request_id });

						await writelog(logdir + logdatefilename, prelogtest + "Outbound API Post Data:" + " > " + JSON.stringify(outbound_api_options) + "\n");

						let outboundApiResponse = await outboundApiResponseHandler(outbound_api_url, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, outboundMappedData, xmlbodyreq, nodeDataArray, linkDataArray, OutboundFormatData, inboundMappingData, inboundPostData, reqBody, inboundFilterEnableLog, inboundEnableLog, outbound_api_options, outbound_api_options_body, outboundSettingData, outboundPostDataFormat, outboundResponseDataFormat, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, "", queryString, newHeader, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, [], [], [], [], {}, request_id, request_method, afterGlobalLogDescription, prelogtest, logdir, logdatefilename, endpoint_count);

						if (index === newReqBody.length - 1) {
							resolve(outboundApiResponse);
						}
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound post data is empty." });

					resolve({
						code: "1",
						MsgCode: "50001",
						MsgType: "Invalid-Source",
						MsgLang: "en",
						ShortMsg: "Fail",
						LongMsg: "Outbound post data is empty.",
						logMsg: "",
						InternalMsg: "",
						EnableAlert: "No",
						DisplayMsgBy: "LongMsg",
						Data: [],
						err: err,
						logQueueMsg: "Fail",
						logType: inboundEnableLog,
						httpStatus: "200"
					});
				}
			}
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound setting.", exception_type: "System Error", item: item.ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound setting." });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound setting." });

			resolve({
				code: "1",
				MsgCode: "50001",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "catch " + err + " - Some error occurred while checking outbound setting.",
				logMsg: "",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: [],
				err: err,
				logQueueMsg: "Fail",
				logType: inboundEnableLog,
				httpStatus: "200"
			});
		}
	});
}

async function outboundApiResponseHandler(outbound_api_url, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, outboundMappedData, xmlbodyreq, nodeDataArray, linkDataArray, OutboundFormatData, inboundMappingData, inboundPostData, reqBody, inboundFilterEnableLog, inboundEnableLog, outbound_api_options, outbound_api_options_body, outboundSettingData, outboundPostDataFormat, outboundResponseDataFormat, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, emailDdepInputPath, queryString, newHeader, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, reqIn, reqOut, resIn, resOut, global, request_id, request_method, afterGlobalLogDescription, prelogtest, logdir, logdatefilename, endpoint_count) {
	return new Promise(async (resolve) => {
		const requestOptions = {
			...outbound_api_options,
			timeout: 30000, // 30 seconds timeout
			connectTimeout: 10000, // 10 seconds connection timeout
		};

		async function makeRequestWithRetry(requestOptions, maxRetries = 3) {
			let lastError;

			for (let attempt = 1; attempt <= maxRetries; attempt++) {
				try {
					return await new Promise((resolvePromise, rejectPromise) => {
						request(requestOptions, (error, response, body) => {
							if (error) {
								// Check if error is retryable
								const isRetryable = error.code === 'ETIMEDOUT' ||
									error.code === 'ECONNREFUSED' ||
									error.code === 'ECONNRESET' ||
									error.code === 'ENOTFOUND' ||
									error.syscall === 'connect';

								if (isRetryable && attempt < maxRetries) {
									rejectPromise({
										error,
										shouldRetry: true,
										attempt
									});
								} else {
									// Non-retryable error or last attempt
									resolvePromise({ error, response, body });
								}
							} else {
								// Check HTTP status codes for retry
								if ((response.statusCode >= 500 || response.statusCode === 429) && attempt < maxRetries) {
									rejectPromise({
										error: new Error(`HTTP ${response.statusCode}`),
										shouldRetry: true,
										attempt,
										response,
										body
									});
								} else {
									resolvePromise({ error: null, response, body });
								}
							}
						});
					});
				} catch (retryError) {
					lastError = retryError;

					if (retryError.shouldRetry && attempt < maxRetries) {
						// Log retry attempt
						const retryDelay = 1000 * attempt; // Exponential backoff
						addToLogQueue({
							CompanyCode: companyCode,
							unique_id: schedulerUniqueId,
							type: "OutBound",
							item_id,
							projectId: item.ProjectId,
							action: "Outbound API Retry",
							description: `Retry attempt ${attempt}/${maxRetries} for ${outbound_api_url}`,
							detail_exception: retryError.error?.message || 'Retry triggered',
							httpStatus: retryError.response?.statusCode || "API Error",
							request_id
						});

						// Wait before retry
						await new Promise(resolve => setTimeout(resolve, retryDelay));
						continue;
					} else {
						// Either last attempt or non-retryable error
						throw retryError.error || retryError;
					}
				}
			}

			throw lastError?.error || lastError;
		}

		let updatedLogDescription = Array.isArray(afterGlobalLogDescription) ? afterGlobalLogDescription : [];

		let logDescription = outboundSettingData?.specifyHeaders?.beforeLogDescription || '';
		logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);

		let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, [], [], [], [], {}, request_id, request_method);

		if (logDescriptionFormula) {
			updatedLogDescription.push(`${logDescriptionFormula}`);
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Trigger", description: "OutBound Trigger", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, isTriggeredOutbound: true, request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

		const urlObj = new URL(requestOptions.url || outbound_api_url);
		const curlCommand = await generateCurlCommand({
			method: requestOptions.method || 'POST',
			protocol: urlObj.protocol.replace(':', ''),
			host: urlObj.host,
			originalUrl: urlObj.pathname,
			query: Object.fromEntries(urlObj.searchParams.entries()),
			headers: requestOptions.headers || {},
			body: safeJSONWithOutStringify(requestOptions?.body, config.dataSize) || undefined,
			formData: requestOptions?.formData || undefined
		});

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Entrypoint", description: "CURL Bash", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? curlCommand : "", request_id });

		// ============== REPLACE THE REQUEST CALL WITH RETRY LOGIC ==============
		let error = null;
		let response = null;
		let body = null;

		try {
			// Use retry logic instead of direct request call
			const result = await makeRequestWithRetry(requestOptions, 3);
			error = result.error;
			response = result.response;
			body = result.body;
		} catch (requestError) {
			// This catches the final error after all retries
			error = requestError;
		}

		if (error) {
			let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';
			logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);

			let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, [], [], [], [], {}, request_id, request_method, schedulerUniqueId);

			if (logDescriptionFormula) {
				updatedLogDescription.push(`${logDescriptionFormula}`);
			}

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: error.message, httpStatus: response?.statusCode, request_id });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: "Connect Outbound API Timeout (" + outbound_api_url + ")", exception_type: "Connection Error", item: item.ItemName, detail_exception: error.message, httpStatus: response?.statusCode, request_id });


			let errorBody = {
				code: "1",
				MsgCode: "50001",
				MsgType: "Invalid-Source",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: error.message + " - Some error occurred while getting.",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				data: [],
				logQueueMsg: "Fail",
				logType: outboundEnableLog,
				httpStatus: "API Error",
				inboundFormatData: {},
				OutboundFormatData: {},
				resBody: body,
			}

			resolve(errorBody);
		} else {
			// ============== CONTINUE WITH YOUR EXISTING SUCCESS LOGIC ==============
			try {
				let outboundResponseData = {};
				let isProcessable = false;

				function isJsonString(str) {
					return str.trim().startsWith('{') || str.trim().startsWith('[');
				}

				function looksLikeHtml(str) {
					return /<\s*html/i.test(str) || /<\s*body/i.test(str);
				}

				console.log(body, "--- body ---");

				try {
					if (body && typeof body === 'string' && body.trim() !== '' && body.trim() !== '\n') {
						if (isJsonString(body)) {
							const sizeMB = Buffer.byteLength(body, 'utf8') / (1024 * 1024);
							console.log(`JSON size: ${sizeMB.toFixed(2)} MB`);

							if (sizeMB > 100) {
								console.warn(`Skipping parsing - JSON too large (${sizeMB.toFixed(2)} MB)`);
								outboundResponseData = body;
								isProcessable = true;
								body = null;
							} else {
								const parsed = JSON.parse(body);
								outboundResponseData = parsed;
								isProcessable = true;
							}
							console.log("Valid JSON");
						} else if (!looksLikeHtml(body)) {
							// Try parse as XML
							parseString(body, function (err, result) {
								if (err) {
									console.warn("Invalid XML. Skipping.");
									outboundResponseData = null;
									isProcessable = false;
								} else {
									// Check if parsed XML is actually HTML-like
									if (result && result.html) {
										console.warn("Parsed XML is actually HTML content. Skipping.");
										outboundResponseData = null;
										isProcessable = false;
									} else {
										outboundResponseDataFormat = "xml";
										outboundResponseData = jsonOriginal(result);
										isProcessable = true;
										console.log("Valid XML");
									}
								}
							});
						} else {
							console.warn("Body looks like HTML. Skipping.");
							outboundResponseData = body;
							isProcessable = false;
						}
					} else {
						console.warn("Empty or blank body. Skipping.");
						outboundResponseData = body;
						isProcessable = false;
					}
				} catch (err) {
					console.error("Exception while processing body:", err.message);
					outboundResponseData = null;
					isProcessable = false;
				} finally {
					// Explicitly release memory
					try {
						if (typeof (Function('return this')()).gc === 'function') {
							(Function('return this')()).gc();
							await new Promise(resolve => setTimeout(resolve, 1000));
						}
					} catch (e) {
						console.log('Could not access GC function');
					}
				}

				let response_failures_return_url = "";
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
					response_failures_return_url = notification?.data?.response_failures_return_url || ""
				}

				if (!isProcessable) {
					try {
						body = JSON.parse(body);
					} catch (err) {
						body = body;
					}

					let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';
					logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);

					let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, [], [], [], [], {}, request_id, request_method, schedulerUniqueId);

					if (logDescriptionFormula) {
						updatedLogDescription.push(`${logDescriptionFormula}`);
					}

					let parsedData = safeJSONStringify(body, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", httpStatus: response?.statusCode, request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: JSON.stringify({ "message": response?.statusMessage, "http_status_code": response?.statusCode, request_id }) });

					let resTransformedBody = body;

					if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
						await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl: '', outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "OutBound" });
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: parsedData, exception_type: "Connection Error", item: item.ItemName, detail_exception: "Outbound API responsed status : " + response?.statusCode + " : " + response?.statusMessage, httpStatus: response?.statusCode, request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound", request_id });

					if (newHeader["X-Test-Tool"] !== undefined) {
						let ddepOutboundData;
						if (reqBody !== undefined) {
							ddepOutboundData = reqBody;
						}

						let errorBody = {
							code: "1",
							MsgCode: "20001",
							MsgType: "Save-Data-Success",
							MsgLang: "en",
							ShortMsg: "Save successful",
							LongMsg: "Outbound data post successful",
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							data: [
								body,
								ddepOutboundData
							]
						}

						resolve(errorBody);
					} else {
						resolve({
							code: "0",
							contentType: "application/json",
							statusCode: response?.statusCode || 200,
							data: body,
							logQueueMsg: "Success",
							logType: inboundEnableLog,
							httpStatus: response?.statusCode + " " + response?.statusMessage
						});
					}
				} else {
					const responseStr = JSON.stringify(outboundResponseData);
					let responseStrByte = Buffer.byteLength(responseStr, 'utf8');

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response Size", description: "Response Data Size", datas: responseStrByte, httpStatus: response?.statusCode, request_id });

					let parsedData = safeJSONStringify(outboundResponseData, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", httpStatus: response?.statusCode, request_id });
					let responseData = outboundResponseData;

					let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';
					logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, {}, {}, [], [], [], [], {}, request_method, schedulerUniqueId);

					let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, "no", {}, {}, [], [], [], [], {}, request_id, request_method);

					if (logDescriptionFormula) {
						updatedLogDescription.push(`${logDescriptionFormula}`);
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

					await writelog(logdir + logdatefilename, prelogtest + "Outbound API Response:" + " > " + JSON.stringify(outboundResponseData) + "\n");

					let resTransformedBody;

					endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: {}, row: endpoint_count, error: false, errorMessage: '', statusCode: response?.statusCode, responseTimeMs: 0 }

					const outboundFilterHandlerRes = await outboundFilterHandler(outboundResponseData, outboundResponseDataUnkeyArr, outboundFilterData, item, enableLogs, outboundEnableLog, inboundFilterEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, "no", {}, {}, [], [], [], [], {}, request_id, request_method, "Scheduler", logdir, logdatefilename);

					if (outboundFilterHandlerRes.code == 1) {
						resTransformedBody = outboundFilterHandlerRes;
						if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
							await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl: '', outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "OutBound" });
						}
						resolve(outboundFilterHandlerRes);
					} else {
						outboundResponseData = outboundFilterHandlerRes.outboundResponseData;
					}

					let generalValues = { inboundPostData, inboundMappingData, body: body, resTransfromBody: {} }

					const outboundMappingHandlerRes = await outboundMappingHandler(inboundPostData, inboundMappingData, outbound_api_options_body, responseData, mappingOutboundSettingData, outboundSettingData, outboundResponseData, inboundFormatData, propertiesOutboundSettingData, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundResponseDataUnkeyArr, outboundMappedData, xmlbodyreq, outboundResponseDataFormat, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, emailDdepInputPath = "", dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString = "", "true", "no", {}, {}, [], [], [], [], {}, request_id, request_method, endpointMeta, generalValues, "Scheduler", logdir, logdatefilename);


					if (outboundMappingHandlerRes.code == 1) {
						resTransformedBody = outboundMappingHandlerRes;
						if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
							await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl: '', outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "OutBound" });
						}
						resolve(outboundMappingHandlerRes);
					} else {
						OutboundFormatData = outboundMappingHandlerRes.OutboundFormatData;
						nodeDataArray = outboundMappingHandlerRes.nodeDataArray;
						linkDataArray = outboundMappingHandlerRes.linkDataArray;
						outboundMappedData = outboundMappingHandlerRes.outboundMappedData;
						outboundPostDataFormat = outboundMappingHandlerRes.outboundPostDataFormat;
						inboundFormatData = outboundMappingHandlerRes.inboundFormatData;
						outboundResponseDataUnkeyArr = outboundMappingHandlerRes.outboundResponseDataUnkeyArr;
						inboundFormatDataUnkeyArr = outboundMappingHandlerRes.inboundFormatDataUnkeyArr;
						outboundFormatDataUnkeyArr = outboundMappingHandlerRes.outboundFormatDataUnkeyArr;
						outboundResponseData = outboundMappingHandlerRes.outboundResponseData;
					}

					resTransformedBody = outboundResponseData;
					if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
						await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl: '', outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "OutBound" });
					}

					const contentType = response?.headers["content-type"];
					const types = contentType.split(";");
					const type = types[0].split("/");

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound", request_id });

					await writelog(logdir + logdatefilename, prelogtest + "Outbound End" + "\n");

					if (response?.statusCode == 200 && type[0] == "application" && type[1] == "json" && outboundPostDataFormat == "json") {
						if (newHeader["X-Test-Tool"] !== undefined) {
							let ddepOutboundData;
							if (reqBody !== undefined) {
								ddepOutboundData = reqBody;
							}

							let responseBody = {
								code: "1",
								MsgCode: "20001",
								MsgType: "Save-Data-Success",
								MsgLang: "en",
								ShortMsg: "Save successful",
								LongMsg: "Outbound data post successful",
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: [
									outboundResponseData,
									ddepOutboundData
								]
							}

							resolve(responseBody);
						} else {
							resolve({
								code: "0",
								contentType: "application/json",
								statusCode: response.statusCode,
								data: outboundResponseData,
								logQueueMsg: "Success",
								logType: inboundEnableLog,
								httpStatus: response?.statusCode
							});
						}
					} else {
						let resContentType = types[0];

						if (outboundPostDataFormat == "xml") {
							resContentType = "test/xml";
						}

						if (newHeader["X-Test-Tool"] !== undefined) {
							let ddepOutboundData;
							if (reqBody !== undefined) {
								ddepOutboundData = reqBody;
							}

							let responseBody = {
								code: "1",
								MsgCode: "20001",
								MsgType: "Save-Data-Success",
								MsgLang: "en",
								ShortMsg: "Save successful",
								LongMsg: "Outbound data post successful",
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								data: [
									outboundResponseData,
									ddepOutboundData
								],
							}

							resolve(responseBody);
						} else {
							resolve({
								code: "0",
								contentType: resContentType,
								statusCode: response.statusCode,
								data: outboundResponseData,
								logQueueMsg: "Success",
								logType: inboundEnableLog,
								httpStatus: response?.statusCode
							});
						}
					}
				}

			} catch (err) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data.", exception_type: "System Error", item: item.ItemName, detail_exception: "catch " + err + " - Some error occurred while outbound post data.", request_id });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "OutBound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data.", request_id });

				resolve({
					code: "1",
					MsgCode: "50001",
					MsgType: "Exception-Error",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: "catch " + err + " - Some error occurred while outbound post data.",
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					data: [],
					logQueueMsg: "Fail",
					logType: inboundEnableLog,
					httpStatus: "200"
				});
			}
		}
	});
}

async function sendResponseToReturnUrl(request_method, url, data, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, item_id, request_id, logdir, logdatefilename) {
	return new Promise(async (resolve) => {
		try {
			const todaydate = new Date();
			const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
			let prelogtest = prelog.replace("keywords", "not defined");

			const returnUrlOptions = {
				method: request_method,
				headers: { "Content-Type": "application/json" },
				url: url,
				data: data,
				maxBodyLength: Infinity,   // allow big request body
				maxContentLength: Infinity // allow big response body
			}

			let reqOptions = JSON.stringify({ ...returnUrlOptions, data: safeJSONStringify(returnUrlOptions.data, config.dataSize) })

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url Posting", description: "Return Url Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? reqOptions : "", request_id });

			await writelog(logdir + logdatefilename, prelogtest + "Return Url Data" + " > " + JSON.stringify(returnUrlOptions) + "\n");

			const response = await axios(returnUrlOptions);

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url", description: "Get Return Url Response", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(response.data) : "", httpStatus: response?.status, request_id });

			await writelog(logdir + logdatefilename, prelogtest + "Get Return Url Response" + " > " + JSON.stringify(response.data) + "\n");

			resolve({ code: "0", response: response.data, logQueueMsg: "Success", logType: outboundEnableLog, httpStatus: response?.status });
		} catch (error) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Outbound", item_id, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url", description: `${error.message} - Some error occurred while sending response to returnUrl.`, httpStatus: "500", request_id });

			resolve({
				code: "1",
				MsgCode: "50001",
				MsgType: "Invalid-Source",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: `${error.message} - Some error occurred while sending response to returnUrl.`,
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: [],
				logQueueMsg: "Fail",
				logType: outboundEnableLog,
				httpStatus: "500"
			})
		}
	})
}

function getFileText(fileType) {
	if (fileType == "xml") {
		return "XML";
	} else if (fileType == "json") {
		return "JSON";
	} else if (fileType == "xlsx") {
		return "EXCEL";
	} else if (fileType == "pdf") {
		return "PDF";
	}
	return "";
}

async function listarroutboundrun(companyCode, logdir, logdatefilename, item, result, filescounter, filesendcounter, sync_type, specificEmail = "") {
	return new Promise(async (resolve) => {
		const prelog = "[" + new Date() + "] - [/routers/scheduler_job.js] > [/scheduling] > [keywords]";
		console.log("\nOutbound result : " + JSON.stringify(result));
		const newschedulesetting = {
			...item.schedule_setting,
			companyCode: item.schedule_setting.CompanyCode
		};
		const outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";

		let prelogtest = prelog.replace("keywords", "not defined");
		await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > " + JSON.stringify(result) + "\n");

		let historyStatus = "fail";
		if (result != undefined && result == 1) {
			historyStatus = "success";
		}

		const schedule_setting_options = {
			method: "put",
			url: config.domain + "/projects/schedules/update/" + item.schedule_setting._id,
			headers: {
				"Content-Type": "application/json"
			},
			body: JSON.stringify(newschedulesetting)
		};
		request(schedule_setting_options, async function (error, response) {
			if (error) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Update schedule setting error outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString() });

				console.log("\nUpdate schedule setting error outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString());
				prelogtest = prelog.replace("keywords", "not defined");
				await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [update schedule setting error outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString() + "]\n");
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Update schedule setting outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString() });

				console.log("\nUpdate schedule setting outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString());
				prelogtest = prelog.replace("keywords", "not defined");
				await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [update schedule setting outbound schedule time is " + new Date(parseInt(newschedulesetting.next_date_outbound)).toString() + "]\n");
			}

			const outbound_history_options = {
				method: "post",
				url: config.domain + "/outbound_history/save",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					"item_id": item._id,
					"status": historyStatus
				})
			};
			request(outbound_history_options, async function (error, response) {
				if (error) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Error while save outbound history " + error });

					console.log("\nError while save outbound history " + error);
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Outbound history saved successfully" });

					console.log("\nOutbound history saved successfully");
					prelogtest = prelog.replace("keywords", "not defined");
					await writelog(logdir + logdatefilename, prelogtest + " > [Project Id] > " + item._id + " > [Outbound history saved successfully]\n");
				}

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Scheduler", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "Outbound successfully run" });

				console.log("\nOutbound successfully run");
				if (filescounter != 0 && result != undefined) {
					(async function (x) {
						return await outboundEmailSend(companyCode, logdir, logdatefilename, item, filesendcounter, result, sync_type, specificEmail);
					})(0).then((v) => {
						resolve({ code: "1", response: "" });
					});
				} else {
					resolve({ code: "1", response: "" });
				}
			});
		});
	});
}

function outboundEmailSend(companyCode, logdir, logdatefilename, item, filesendcounter, result, sync_type, specificEmail) {
	return new Promise(async (resolve) => {
		const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
		if (smtpResult.status === 1) {
			const item_id = item._id;
			const outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";
			if (smtpResult?.data?.smtpActive == "1") {
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
					const isOutboundFtpSuccess = (notification?.status == 1 && notification?.data?.isOutboundFtpSuccess == "on") ? "Enabled" : "Disabled";
					const isOutboundFtpFail = (notification?.status == 1 && notification?.data?.isOutboundFtpFail == "on") ? "Enabled" : "Disabled";
					if (result == 1) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Option", description: "Outbound Success : " + isOutboundFtpSuccess });
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Option", description: "Outbound Fail : " + isOutboundFtpFail });
					}

					let isSend = notification?.data?.isOutboundFtpSuccess;
					if (result != 1) {
						isSend = notification.data.isOutboundFtpFail;
					}

					if (notification.status == 1 && isSend == "on") {
						let folderFilesCountsResult = await folderFilesCounts(companyCode, item, item_id, outboundEnableLog, sync_type);
						const logHistoriesResult = await getLoghistories(item_id, schedulerUniqueId, "Outbound");
						const projectDetails = await findProject(item.ProjectId);
						let usertoMail = "";
						let userTitle = "";
						if (projectDetails.status == 1) {
							usertoMail = projectDetails?.data?.email;
							userTitle = projectDetails?.data?.emailTitle;
						}
						const item_code = item.ItemCode;
						const item_name = item.ItemName;
						const inboundSetting = item.inbound_setting;
						const serverName = inboundSetting.ftp_server_link;
						const outboundSetting = item.outbound_setting;
						const outboundApiUrl = outboundSetting.api_url;
						const totalPosted = filesendcounter;
						const providerName = notification.data.providerName;
						const toEmail = notification.data.email;
						let EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") Outbound Successful";
						if (result != 1) {
							EmailSubject = item_code + " - " + item_name + " - (" + item_id + ") Outbound Fail";
						}

						let userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''} - Outbound Successful - ${item_code} - ${item_name}`;
						if (result !== 1) {
							userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''} - Outbound Failure - ${item_code} - ${item_name}`;
						}

						const logHistoriesResults = logHistoriesResult;
						const logHistoriesResultsData = logHistoriesResults.data;

						let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Outbound Successful</title><style type="text/css">td, th {border: 1px solid #ddd;}</style></head><body style="background-color:#F4F4F4;"><center><table class="container600" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:calc(100%);max-width:calc(100%);margin: 0 auto;"><tr><td width="100%" style="text-align: left;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>${sync_type}:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + serverName;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Outbound URL:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + outboundApiUrl;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Total Posted:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">` + totalPosted;
						mailContent += `</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Phyiscal File Check:</strong></td><td style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += folderFilesCountsResult.in_dir + "<br>";
						mailContent += folderFilesCountsResult.in_month_folder + "<br>";
						mailContent += folderFilesCountsResult.convertfail_dir + "<br>";
						// mailContent += folderFilesCountsResult.out_month_folder + "<br>";
						mailContent += folderFilesCountsResult.sending_dir + "<br>";
						// mailContent += folderFilesCountsResult.timeout_dir + "<br><br>";
						mailContent += `</td></tr>`;
						mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;
						mailContent += `<strong>Event:</strong></td></tr><tr><td colspan="2" style="background-color:#FFFFFF;color:#000000;padding:10px;">`;

						let logEvents = ``;
						if (logHistoriesResultsData.length > 0) {
							logEvents += `<table class="smarttable" width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;">`;
							logEvents += `<thead>`;
							logEvents += `<tr>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Item ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Unique ID</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Type</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Action</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Description</th>`;
							logEvents += `<th scope="col" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">Created At</th>`;
							logEvents += `</tr>`;
							logEvents += `</thead>`;
							logEvents += `<tbody>`;
							for (let i = 0; i < logHistoriesResultsData.length; i++) {
								logEvents += `<tr>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i]._id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].item_id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].unique_id + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].type + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].action + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].description + `</td>`;
								logEvents += `<td valign="top" style="padding:5px; font-family: Arial,sans-serif; font-size: 16px; line-height:20px;">` + logHistoriesResultsData[i].createdAt + `</td>`;
								logEvents += `</tr>`;
							}
							logEvents += `</tbody>`;
							logEvents += `</table>`;
						}

						mailContent += logEvents + `<br>`;
						mailContent += `</td></tr>`;
						mailContent += `</table></td></tr></table></center></body></html>`;

						let smtpSecure = false;
						if (smtpResult.data.smtpPort == 465) {
							smtpSecure = true;
						}

						const queueId = uuidv4();
						const takenSubject = userEmailSubject;
						const combinedToArr = [toEmail, usertoMail, specificEmail].filter(Boolean);

						const combinedTo = combinedToArr.length > 0
							? combinedToArr.join(",")
							: null;

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Connect", description: "Queuing", queueId });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: "Queuing", queueId });

						const queue = mailQueue;

						const mockJobData = {
							queueId,
							smtpConfig: {
								host: smtpResult.data.smtpServer,
								port: smtpResult.data.smtpPort,
								secure: smtpSecure,
								auth: {
									user: smtpResult.data.smtpAccount,
									pass: smtpResult.data.smtpPassword,
								},
								family: 4,
								pool: true,
								maxConnections: 20,
								maxMessages: 500,
								rateLimit: 10
							},
							mailConfig: {
								from: providerName + " <" + smtpResult.data.smtpEmail + ">",
								to: combinedTo,
								subject: takenSubject,
								html: mailContent,
							},
							logDataConnect: {
								action: "Outbound Email Connect",
								description: "SMTP " + smtpResult.data.smtpServer + " connected"
							},
							logDataSend: {
								action: "Outbound Email Send",
							},
							successDescription: item_id + " > Sent Outbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Success",
							errorDescription: item_id + " > Sent Outbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Fail : Error : "
						}

						await queue.add(mailQueueConfig.name, mockJobData, { jobId: queueId, delay: 0, removeOnComplete: 10, removeOnFail: 10 });
						resolve();
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: `Outbound ${sync_type} Success Notification Disabled` });

						resolve();
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: error + " - Some error occurred while getting the notification setting." });

					resolve();
				}
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "SMTP setting not active." });
				resolve();
			}
		} else {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: error + " - Some error occurred while getting the SMTP setting." });

			resolve();
		}
	});
}

function setCurrentRunningItem(logdir, prelog, logdatefilename, isRunningDataId, item_id, is_inbound_run, is_outbound_run) {
	return new Promise(async (resolve) => {
		const prelogtest = prelog.replace("keywords", "not defined");
		await writelog(
			logdir + logdatefilename,
			prelogtest +
			`setCurrentRunningItem : ${isRunningDataId} item_id: ${item_id} is_inbound_run: ${is_inbound_run} is_outbound_run: ${is_outbound_run}\n`
		);

		const body = {
			item_id: item_id,
			is_inbound_running: is_inbound_run,
			is_outbound_running: is_outbound_run
		};

		try {
			let itemrundata = {};
			if (isRunningDataId !== "") {
				itemrundata = await updateItemRunning(isRunningDataId, body);
			} else {
				itemrundata = await createItemRunning(body);
			}
			resolve(itemrundata);
		} catch (err) {
			await writelog(logdir + logdatefilename, prelogtest + "Error while set running item : " + err.message + "\n");
			resolve({
				status: 0,
				message: "Internal function error",
				error: err.message
			});
		}
	});
}

function folderFilesCounts(companyCode, item, item_id, itemEnableLog, sync_type) {
	return new Promise((resolve) => {
		const todaydate = new Date();
		let outputInboundsItemCounter = 0;
		let outputSendingItemCounter = 0;
		let outputTimeoutItemCounter = 0;
		let outputHistoryInboundsItemCounter = 0;
		let outputHistoryOutboundsItemCounter = 0;
		let outputHistoryConvertfailItemCounter = 0;
		let in_dir = "output/inbounds/" + item_id;
		let in_itemdir = "output/history/inbounds/" + item_id;
		let in_yearfolder = in_itemdir + "/" + todaydate.getFullYear();
		let in_month_folder = in_yearfolder + "/" + parseInt(todaydate.getMonth() + 1);
		let convertfail_dir = "output/history/convertfail/" + item_id;
		let sending_dir = "output/sending/" + item_id;

		if (!fs.existsSync(in_itemdir)) {
			fs.mkdirSync(in_itemdir);
		}

		if (!fs.existsSync(in_yearfolder)) {
			fs.mkdirSync(in_yearfolder);
		}

		if (!fs.existsSync(in_month_folder)) {
			fs.mkdirSync(in_month_folder);
		}

		if (!fs.existsSync(convertfail_dir)) {
			fs.mkdirSync(convertfail_dir);
		}

		if (!fs.existsSync(sending_dir)) {
			fs.mkdirSync(sending_dir);
		}

		fs.readdir(in_dir, async function (err, files) {
			outputInboundsItemCounter = files.length;

			fs.readdir(in_month_folder, async function (err, files) {
				outputHistoryInboundsItemCounter = files.length;

				fs.readdir(convertfail_dir, async function (err, files) {
					outputHistoryConvertfailItemCounter = files.length;

					fs.readdir(sending_dir, async function (err, files) {
						outputSendingItemCounter = files.length;

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: sync_type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Physical Files Check", description: in_dir + ": " + outputInboundsItemCounter + "\r\n" + in_month_folder + ": " + outputHistoryInboundsItemCounter + "\r\n" + convertfail_dir + ": " + outputHistoryConvertfailItemCounter + "\r\n" + sending_dir + ": " + outputSendingItemCounter });

						resolve({ in_dir: in_dir + ": " + outputInboundsItemCounter, in_month_folder: in_month_folder + ": " + outputHistoryInboundsItemCounter, convertfail_dir: convertfail_dir + ": " + outputHistoryConvertfailItemCounter, sending_dir: sending_dir + ": " + outputSendingItemCounter });
					});
				});
			});
		});
	});
}

async function getLoghistories(item_id, schedulerUniqueId, type) {
	try {
		const result = await findAllLogFullListUniqueIdForFTPlogsFn(item_id, schedulerUniqueId, type);
		return result;
	} catch (err) {
		return { status: 0, message: "Failed to fetch log histories.", error: err };
	}
}

module.exports = { scheduling, getScheduleProjectInfo }