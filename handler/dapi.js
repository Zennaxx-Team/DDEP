const parseString = require("xml2js").parseString;
const xml2js = require("xml2js");
const moment = require("moment");
const request = require("request");
const { v4: uuidv4 } = require("uuid");
const axios = require("axios");
const { getGeneralSettings } = require("../my_modules/item_api_functions");
const config = require("../config");
const { findPartyById } = require("../controllers/parties.controller");
const { findMappingProfileHistoryById } = require("../controllers/mapping_profiles.controller");
const jwt = require("jsonwebtoken");
const jwtJtiModel = require("../models/jwt_auth_record.model");
const { inboundFilterHandler, addToLogQueue, inboundMappingHandler, outboundValidationHandler, outboundFilterHandler, outboundMappingHandler, ddepOutboundEmailSend, ddepInboundEmailSend, inboundreplacementformatdata, formulaGetValue, generateCurlCommand, replacePlaceholders, generateLogDescriptionFormulaForMail, jsonOriginal, handleOutboundFailure, actionValidationHandler, processVariablesAndHeaders, emailSend, webhook_call, processWebhookContent, buildFinalReturnUrl, resolveDirectFormula, parseReturnUrl, buildWebhookContext, addToLogAlertQueue, handleDiffCheckerReturnUrl, addToLogDiffQueue } = require("../common/common");
const { chcekDdepPathUrlPrefix, chcekDdepPathWithUrlPrefix, inboundsEditddepAPI, inboundsDdepInputAPI } = require("../controllers/items-inbounds.controller");
const { getFullItemDetails } = require("../controllers/items.controller");
const { safeJSONStringify, safeJSONWithOutStringify } = require("../my_modules/checkSize");
const { getNotificationSettings } = require("../controllers/notification.controller");
const { listAlertConditionsByItem } = require("../controllers/alert_conditions.controller");
const { evaluateAlertCondition, webhook_call_alert, emailSend_alert } = require("./monitoring/monitoring");
const { lineByLineDiff } = require("../my_modules/utils/lineDiff");
const { diff_entry_create } = require("../controllers/diff_history.controller");

let outboundFormatDataParentKey = [];
let dataArrayReviseParentKey = [];
let dataArrayReviseArr = {};
let filterParentKey = [];
let filterTrueDataKeys = [];
let filterFalseDataKeys = [];
let taskQueue = [];
let isProcessing = false;
let mappingArrayMerged = [];
// let reqIn = [];
// let reqOut = [];
// let resIn = [];
// let resOut = [];
// let global = [];
let enableError = "no";
let flowTypeResponse = "single";
let flowSingle = "";
let multipleResponseSend = 0;

function flattenQueryParams(obj, prefix = '') {
	const result = [];
	Object.entries(obj).forEach(([key, value]) => {
		const paramKey = prefix ? `${prefix}[${key}]` : key;
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			// Recursively flatten nested objects
			result.push(...flattenQueryParams(value, paramKey));
		} else {
			result.push(`${paramKey}=${encodeURIComponent(value)}`);
		}
	});
	return result;
}

async function _ddep_api_function(req, res) {
	const companyCode = req.params.companyCode;
	const schedulerUniqueId = uuidv4();
	try {
		enableError = "no", flowTypeResponse = "single", flowSingle = "", multipleResponseSend = 0;
		const reuestProtocol = req.get('X-Forwarded-Proto') || (req.secure ? 'https' : 'http');
		const fullUrl = reuestProtocol + '://' + req.get('host') + req.originalUrl;
		const reqMethod = req.method;
		let reqIn = [];
		let reqOut = [];
		let resIn = [];
		let resOut = [];
		let global = [];

		const reqQuery = req.query;
		const reqRawHeader = req.rawHeaders;
		const reqHeaders = req.headers;
		const companyCode = req.params.companyCode;
		const ddepAuthHeaderKey = config.ddepAuthHeaderKey;
		let ddepInput = req.params.ddepInput;
		let enableLogs = "off";
		let enableFullLogs = "off";
		let enableDiffCheck = "off";
		let diffCheckReturnUrl = "";
		let afterGlobalLogDescription = [];
		let querystring = {};
		let reqBody = JSON.parse(JSON.stringify(req.body));
		let isOldDdep = true;
		let ddepInputArr = [];
		let emailDdepInputArr = [];
		let urlPrefix = "";
		let inputs = [];
		let prefix = '';
		let matchedPrefix = '';
		let result = null;

		for (let i = 0; i <= 12; i++) {
			const paramKey = i === 0 ? 'ddepInput' : `ddepInput${i}`;
			if (req.params[paramKey]) {
				inputs.push(req.params[paramKey]);
			}
		}

		for (let i = 0; i < inputs.length; i++) {
			prefix += (i === 0 ? '' : '/') + inputs[i];

			result = await chcekDdepPathUrlPrefix(companyCode, prefix);

			if (result.status === 1) {
				updatedResult = result.data;
				matchedPrefix = prefix;
			} else {
				// Fallback check using base and last part
				const lastSlashIndex = prefix.lastIndexOf("/");
				const base = prefix.substring(0, lastSlashIndex);

				const remainingSegments = inputs.slice(i).join('/');
				const normalizedLastPart = '/' + remainingSegments.replace(/^\/+/, ''); // Ensures only one slash

				let finalResult = await chcekDdepPathWithUrlPrefix(companyCode, base, normalizedLastPart);
				if (finalResult.status === 1) {
					isOldDdep = false;
					break;
				}
			}
		}

		urlPrefix = matchedPrefix;

		if (!isOldDdep) {
			const urlPrefixParts = matchedPrefix.split("/").filter(p => p);
			let paramsStartIndex = urlPrefixParts.length;

			// Collect remaining parameters
			for (let i = paramsStartIndex; i <= 12; i++) {
				const paramKey = i === 0 ? 'ddepInput' : `ddepInput${i}`;
				if (req.params[paramKey] !== undefined && req.params[paramKey] !== "") {
					ddepInputArr.push(req.params[paramKey]);
				}
			}
		} else {
			// Old DDEP format
			ddepInputArr.push(req.params.ddepInput);

			for (let i = 1; i <= 9; i++) {
				const key = `ddepInput${i}`;
				if (req.params[key] !== undefined && req.params[key] !== "") {
					ddepInputArr.push(req.params[key]);
				}
			}
		}

		let ddepInputPath = "";
		for (let i = 0; i < ddepInputArr.length; i++) {
			ddepInputPath += "/" + ddepInputArr[i];
		}

		let emailDdepInputPath = "";
		for (let i = 0; i <= 11; i++) {
			let keyIndex = (i === 0) ? "" : i;
			const key = `ddepInput${keyIndex}`;

			if (req.params[key] !== undefined && req.params[key] !== "") {
				emailDdepInputArr.push(req.params[key]);
			}
		}

		for (let i = 0; i < emailDdepInputArr.length; i++) {
			emailDdepInputPath += "/" + emailDdepInputArr[i];
		}

		const curlRequest = await generateCurlCommand({
			method: req.method,
			protocol: req.protocol,
			host: req.get('host'),
			originalUrl: req.originalUrl,
			headers: req.headers,
			query: req.query,
			body: safeJSONWithOutStringify(req.body, config.dataSize),
		});

		try {
			const logData = await getGeneralSettings(companyCode); // Assume this returns JSON string
			const generalSettings = JSON.parse(logData);

			if (generalSettings?.status === 1) {
				const generalSettingsData = generalSettings?.data?.data?.[0];

				if (generalSettingsData?.enableLogs === "on") {
					enableLogs = "on";
				}

				if (generalSettingsData?.enableFullLogs === "on") {
					enableFullLogs = "on";
				}

				if (generalSettingsData?.enableDiffCheck === "on") {
					enableDiffCheck = "on";

					if (generalSettingsData?.diffCheckReturnUrl) {
						diffCheckReturnUrl = generalSettingsData.diffCheckReturnUrl;
					}
				}
			}

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Start", description: "Start DDEP" });

			let header = {};
			let newHeader = {};
			for (let i = 0; i < reqRawHeader.length; i++) {
				if (i % 2 == 0) {
					let key = reqRawHeader[i];
					const value = reqRawHeader[i + 1];

					if (key.includes("ddep-underscores-")) {
						key = key.replace("ddep-underscores-", "").replace(/-/g, "_");
					}

					if (key === "Cookie" || key === "cookie") {
						continue;
					}

					newHeader[key] = value;
					header[key] = value;
				}
			}

			console.log("\nHeader:", header);

			let enabledebug = "no";
			if (newHeader["Enabledebug"] != undefined) {
				enabledebug = newHeader["Enabledebug"];
				delete newHeader["Enabledebug"];
			}

			if (newHeader["enabledebug"] != undefined) {
				enabledebug = newHeader["enabledebug"];
				delete newHeader.enabledebug;
			}

			enableError = "no";
			if (newHeader["EnableError"] != undefined) {
				enableError = newHeader["EnableError"];
				delete newHeader["EnableError"];
			}

			if (newHeader["enableError"] != undefined) {
				enableError = newHeader["enableError"];
				delete newHeader.enableError;
			}

			let enableAlertDebug = config.enableAlertDebug ?? "false";

			// check header (case-insensitive)
			if (newHeader["enableAlertDebug"] !== undefined) {
				enableAlertDebug = newHeader["enableAlertDebug"];
				delete newHeader["enableAlertDebug"];
			} else if (newHeader["EnableAlertDebug"] !== undefined) {
				enableAlertDebug = newHeader["EnableAlertDebug"];
				delete newHeader["EnableAlertDebug"];
			}

			let bodyreq = "";
			let typereq = "";
			if (newHeader["Content-Type"] != undefined) {
				const reqContentType = newHeader["Content-Type"];
				typereq = reqContentType.split("/");
				if ((typereq[0] == "application" && (typereq[1] == "json" || typereq[1] == "xml" || typereq[1] == "javascript")) || (typereq[0] == "text" && (typereq[1] == "plain" || typereq[1] == "html"))) {
					bodyreq = reqBody;
				}
			} else {
				newHeader["Content-Type"] = "application/json";
				const reqContentType = newHeader["Content-Type"];
				typereq = reqContentType.split("/");
				if ((typereq[0] == "application" && (typereq[1] == "json" || typereq[1] == "xml" || typereq[1] == "javascript")) || (typereq[0] == "text" && (typereq[1] == "plain" || typereq[1] == "html"))) {
					bodyreq = reqBody;
				}
			}

			let queryString = "";
			const queryParams = flattenQueryParams(reqQuery);
			queryParams.forEach(param => {
				const [key, value] = param.split('=');
				querystring[key] = value;
			});
			queryString = queryParams.join('&');

			console.log("\nQuerystring:", querystring);

			const { headers, method, url } = req;

			let responseBody = { headers, method, url, reqBody };

			try {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Inbound Start", description: "Start Inbound" });

				let inpromise = new Promise(async function (resolve, reject) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Inbound Get", description: fullUrl, datas: fullUrl });

					const findEditDdepAPI = await inboundsEditddepAPI(ddepInputPath, companyCode, urlPrefix);
					if (findEditDdepAPI.statusCode == 500) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Get Inbound", description: findEditDdepAPI.error.message + " - Some error occurred while getting the inbound setting." });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Last End", description: "Fail", httpStatus: 500 });

						return res.status(500).json({
							code: "1",
							MsgCode: "500002",
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Fail",
							LongMsg: findEditDdepAPI.error.message + " - Some error occurred while getting the inbound setting.",
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							Data: []
						});
					} else {
						try {
							let res_code = "1";
							let item_id = "";
							let outboundLastPath = "";
							let inboundSettingData = "";
							if (findEditDdepAPI.status == 0) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Inbound Get All", description: `Get all inbound data using ddep path : /${ddepInput}`, datas: fullUrl });

								try {
									const findInboundsDdepInputAPI = await inboundsDdepInputAPI(`${ddepInputPath}`, companyCode);
									if (findInboundsDdepInputAPI.statusCode == 500) {
										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Get Inbound", description: findInboundsDdepInputAPI.error.message + " - Some error occurred while getting the inbound setting." });

										addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Last End", description: "Fail", httpStatus: 500 });

										return res.status(500).json({
											code: "1",
											MsgCode: "500002",
											MsgType: "Invalid-Source",
											MsgLang: "en",
											ShortMsg: "Fail",
											LongMsg: findInboundsDdepInputAPI.error.message + " - Some error occurred while getting the inbound setting.",
											InternalMsg: "",
											EnableAlert: "No",
											DisplayMsgBy: "LongMsg",
											Data: []
										});
									} else {
										if (findInboundsDdepInputAPI.status == 1) {
											const inbound_setting_data = findInboundsDdepInputAPI.data;
											const inboundEnableLog = (inbound_setting_data.enableLog != undefined) ? inbound_setting_data.enableLog : "off";
											let itemsArr = [];
											let inboundSettingDataArr = [];
											let newddepInputPath = "";
											let lastArrKey = -1;
											let ddepPath = "";

											for (let i = 0; i < inbound_setting_data.length; i++) {
												if (inbound_setting_data[i].urlPrefix == urlPrefix) {
													itemsArr[inbound_setting_data[i].api_ddep_api] = inbound_setting_data[i].item_id;
													inboundSettingDataArr[inbound_setting_data[i].api_ddep_api] = inbound_setting_data[i];
												}
											}

											for (let i = 0; i <= ddepInputArr.length - 1; i++) {
												newddepInputPath += "/" + ddepInputArr[i];
												if (itemsArr[newddepInputPath] != undefined) {
													res_code = "0";
													item_id = itemsArr[newddepInputPath];
													inboundSettingData = inboundSettingDataArr[newddepInputPath];
													lastArrKey = i;
													ddepPath = newddepInputPath;
													// break;
												}
											}

											for (let i = lastArrKey + 1; i < ddepInputArr.length; i++) {
												outboundLastPath += "/" + ddepInputArr[i];
											}

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DAPI", item_id, action: "Start", description: "Start DDEP", path: "/" + config.ddepPrefix + "/" + companyCode + "/" + urlPrefix + ddepInputPath });

											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Inbound found", description: "Get inbound setting", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(inboundSettingData) : "" });

											resolve({
												code: 0,
												MsgCode: "10001",
												MsgType: "Get-Data-Success",
												MsgLang: "en",
												ShortMsg: "Get Success",
												LongMsg: "Found ddep api!",
												InternalMsg: "",
												EnableAlert: "No",
												DisplayMsgBy: "ShortMsg",
												item_id,
												outboundLastPath,
												inboundSettingData
											});
										} else {
											addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Inbound not found", description: "Inbound not found using ddep path : " + ddepInputPath });

											resolve({
												code: "1",
												MsgCode: "404001",
												MsgType: "Invalid-Source",
												MsgLang: "en",
												ShortMsg: "Get Fail",
												LongMsg: "Not found ddep api!",
												InternalMsg: "",
												EnableAlert: "No",
												DisplayMsgBy: "ShortMsg",
												Data: [],
											});
										}
									}
								} catch (err) {
									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Get Inbound", description: "catch " + err + " - Some error occurred while checking ddep api setting.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while checking ddep api setting." });

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Get Inbound", description: "catch " + err + " - Some error occurred while checking ddep api setting." });

									addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Last End", description: "Fail", httpStatus: 404 });

									resolve({
										code: "1",
										MsgCode: "404001",
										MsgType: "Invalid-Source",
										MsgLang: "en",
										ShortMsg: "Get Fail",
										LongMsg: "Not found ddep api!",
										InternalMsg: "",
										EnableAlert: "No",
										DisplayMsgBy: "ShortMsg",
										Data: [],
									});
								}
							} else {
								const inboundEnableLog = (findEditDdepAPI.data.enableLog != undefined) ? findEditDdepAPI.data.enableLog : "off";

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DAPI", item_id: findEditDdepAPI.data.item_id, action: "Start", description: "Start DDEP", path: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: findEditDdepAPI.data.item_id, action: "Inbound found", description: "Get inbound setting", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(findEditDdepAPI.data) : "" });

								resolve({
									code: "0",
									MsgCode: "10001",
									MsgType: "Get-Data-Success",
									MsgLang: "en",
									ShortMsg: "Get Success",
									LongMsg: "Found ddep api!",
									InternalMsg: "",
									EnableAlert: "No",
									DisplayMsgBy: "ShortMsg",
									item_id: findEditDdepAPI.data.item_id,
									outboundLastPath,
									inboundSettingData: findEditDdepAPI.data
								});
							}
						} catch (err) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Get Inbound", description: "catch " + err + " - Some error occurred while checking ddep api setting.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while checking ddep api setting." });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Get Inbound", description: "catch " + err + " - Some error occurred while checking ddep api setting." });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Last End", description: "Fail", httpStatus: 404 });

							resolve({
								code: "1",
								MsgCode: "50001",
								MsgType: "Exception-Error",
								MsgLang: "en",
								ShortMsg: "Fail",
								LongMsg: "catch " + err + " - Some error occurred while checking ddep api setting.",
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: []
							});
						}
					}
				});

				inpromise.then(async function (result) {
					if (result.code == 1 || result.item_id == "") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Get Inbound", description: "Not found ddep api!" });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Last End", description: "Fail", httpStatus: 404 });

						return res.status(404).json({
							code: "1",
							MsgCode: "404001",
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Get Fail",
							LongMsg: "Not found ddep api!",
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "ShortMsg",
							Data: [],
						});
					} else {
						const item_id = result.item_id;
						try {
							const outboundLastPath = result.outboundLastPath;
							const inboundEnableLog = (result.inboundSettingData.enableLog != undefined) ? result.inboundSettingData.enableLog : "off";

							const fullData = await getFullItemDetails(item_id);

							let fullerror = null;
							let fullbody = null;

							if (!fullData || fullData.status !== 1 || !Array.isArray(fullData.data)) {
								fullerror = "Get full list item failed";
							} else {
								fullbody = JSON.stringify(fullData);
							}

							if (fullerror) {
								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Get full list item", description: "Error => " + fullerror + " - Some error occurred while getting full details of item." });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Last End", description: "Fail", httpStatus: "200 OK" });

								return res.status(404).json({
									code: "1",
									MsgCode: "404001",
									MsgType: "Invalid-Source",
									MsgLang: "en",
									ShortMsg: "Get Fail",
									LongMsg: "Not found ddep api!",
									InternalMsg: "",
									EnableAlert: "No",
									DisplayMsgBy: "ShortMsg",
									Data: [],
								});
							} else {
								const fullData = JSON.parse(fullbody);

								let item = fullData.data[0];

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Inbound Item", description: "Get item", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(item) : "" });

								addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Inbound Entrypoint", description: "CURL Bash", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? curlRequest : "" });

								let outboundSettingData = item.outbound_setting;

								if (outboundSettingData.flowType == "multiple" && enabledebug.toLowerCase() != "true") {
									flowTypeResponse == "single";

									function hasDefaultResponse(data) {
										return Array.isArray(data.endpoints) &&
											data.endpoints.some(ep => ep.default_response === true);
									}

									const result_default_response = hasDefaultResponse(outboundSettingData);

									if (!result_default_response) {
										const logId = schedulerUniqueId;
										const logUrl = `${config.domain}/logs/${logId}`;
										multipleResponseSend = 1;
										res.status(200).json({
											logId: logId,
											logUrl: logUrl,
											message: "The process received, please check the execution result on the logUrl."
										});

										taskQueue.push({ req, res, newHeader, querystring, isOldDdep, item_id, companyCode, schedulerUniqueId, enableLogs, enableFullLogs, inboundEnableLog, enabledebug, header, bodyreq, reqBody, responseBody, typereq, queryString, item, outboundLastPath, ddepAuthHeaderKey, emailDdepInputPath, reqIn, reqOut, resIn, resOut, global, afterGlobalLogDescription, flowTypeResponse, flowSingle, result_default_response, multipleResponseSend, reqMethod, fullUrl, enableAlertDebug, enableDiffCheck, diffCheckReturnUrl });

										if (!isProcessing) {
											await processQueue();
										}
									} else {
										flowSingle = "single";
										await ddepApiProcess(req, res, newHeader, querystring, isOldDdep, item_id, companyCode, schedulerUniqueId, enableLogs, enableFullLogs, inboundEnableLog, enabledebug, header, bodyreq, reqBody, responseBody, typereq, queryString, item, outboundLastPath, ddepAuthHeaderKey, emailDdepInputPath, reqIn, reqOut, resIn, resOut, global, afterGlobalLogDescription, flowTypeResponse, flowSingle, result_default_response, multipleResponseSend, reqMethod, fullUrl, enableAlertDebug, enableDiffCheck, diffCheckReturnUrl);
									}
								} else {
									flowSingle = "single";
									await ddepApiProcess(req, res, newHeader, querystring, isOldDdep, item_id, companyCode, schedulerUniqueId, enableLogs, enableFullLogs, inboundEnableLog, enabledebug, header, bodyreq, reqBody, responseBody, typereq, queryString, item, outboundLastPath, ddepAuthHeaderKey, emailDdepInputPath, reqIn, reqOut, resIn, resOut, global, afterGlobalLogDescription, flowTypeResponse, flowSingle, false, multipleResponseSend, reqMethod, fullUrl, enableAlertDebug, enableDiffCheck, diffCheckReturnUrl);
								}
							}
						} catch (err) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Outbound", description: "catch " + err + " - Some error occurred while run properties function.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while run properties function." });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Outbound", description: "catch " + err + " - Some error occurred while run properties function." });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Last End", description: "Fail", httpStatus: 500 });

							return res.status(500).json({
								code: "1",
								MsgCode: "500003",
								MsgType: "Exception-Error",
								MsgLang: "en",
								ShortMsg: "Fail",
								LongMsg: "catch " + err + " - Some error occurred while run properties function.",
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: []
							});
						}
					}
				});
			} catch (err) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Outbound", description: "catch " + err + " - Some error occurred while run promise function.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while run promise function." });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Outbound", description: "catch " + err + " - Some error occurred while run promise function." });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "Last End", description: "Fail", httpStatus: 500 });

				return res.status(500).json({
					code: "1",
					MsgCode: "500004",
					MsgType: "Exception-Error",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: "catch " + err + " - Some error occurred while run promise function.",
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					Data: []
				});
			}

		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: "", action: "Outbound", description: "catch " + err + " - Some error occurred while general setting function.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while general setting function." });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: "", action: "Outbound", description: "catch " + err + " - Some error occurred while general setting function." });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: "", action: "Last End", description: "Fail", httpStatus: 500 });

			return res.status(500).json({
				code: "1",
				MsgCode: "500005",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "catch " + err + " - Some error occurred while general setting function.",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: []
			});
		}
	} catch (err) {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Outbound", description: "catch " + err + " - Some error occurred while start function.", exception_type: "System Error", detail_exception: "catch " + err + " - Some error occurred while start function." });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Outbound", description: "catch " + err + " - Some error occurred while start function." });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", action: "Last End", description: "Fail", httpStatus: 500 });

		return res.status(500).json({
			code: "1",
			MsgCode: "500006",
			MsgType: "Exception-Error",
			MsgLang: "en",
			ShortMsg: "Fail",
			LongMsg: "catch " + err + " - Some error occurred while start function.",
			InternalMsg: "",
			EnableAlert: "No",
			DisplayMsgBy: "LongMsg",
			Data: []
		});
	}
}

async function processQueue() {
	if (isProcessing || taskQueue.length === 0) {
		return;
	}

	isProcessing = true;

	try {
		while (taskQueue.length > 0) {
			const task = taskQueue.shift();
			await ddepApiProcess(task.req, task.res, task.newHeader, task.querystring, task.isOldDdep, task.item_id, task.companyCode, task.schedulerUniqueId, task.enableLogs, task.enableFullLogs, task.inboundEnableLog, task.enabledebug, task.header, task.bodyreq, task.reqBody, task.responseBody, task.typereq, task.queryString, task.item, task.outboundLastPath, task.ddepAuthHeaderKey, task.emailDdepInputPath, task.reqIn, task.reqOut, task.resIn, task.resOut, task.global, task.afterGlobalLogDescription, task.flowTypeResponse, task.flowSingle, task.result_default_response, task.multipleResponseSend, task.reqMethod, task.fullUrl, task.enableAlertDebug, task.enableDiffCheck, task.diffCheckReturnUrl);
		}
	} catch (error) {
		console.error('Error processing task:', error);
	} finally {
		isProcessing = false;
	}
}

async function ddepApiProcess(req, res, newHeader, querystring, isOldDdep, item_id, companyCode, schedulerUniqueId, enableLogs, enableFullLogs, inboundEnableLog, enabledebug, header, bodyreq, reqBody, responseBody, typereq, queryString, item, outboundLastPath, ddepAuthHeaderKey, emailDdepInputPath, reqIn, reqOut, resIn, resOut, global, afterGlobalLogDescription, flowTypeResponse, flowSingle, result_default_response, multipleResponseSend, reqMethod, fullUrl, enableAlertDebug, enableDiffCheck, diffCheckReturnUrl) {
	console.time();
	reqIn = []; reqOut = []; resIn = []; resOut = []; global = []; afterGlobalLogDescription = [];
	const ItemName = item.ItemName;
	item.inbound_setting.CompanyCode = (item.inbound_setting.CompanyCode == undefined) ? companyCode : item.inbound_setting.CompanyCode;
	const inboundSettingData = item.inbound_setting;
	let inbound_format = inboundSettingData.inbound_format;
	let inboundFilterData = item.inbound_filter;
	let propertiesSettingData = item.items_props;
	let mappingSettingData = item.mapping_setting;
	let inboundFilterEnableLog = (inboundFilterData != undefined && inboundFilterData.enableLog != undefined) ? inboundFilterData.enableLog : "off";
	let disabledInboundEmailFailuresNotice = (inboundSettingData != undefined && inboundSettingData.disabledInboundEmailFailuresNotice != undefined) ? inboundSettingData.disabledInboundEmailFailuresNotice : "off";
	let inboundEnableEmail = (inboundSettingData != undefined && inboundSettingData.enableEmail != undefined) ? inboundSettingData.enableEmail : "off";
	let outboundSettingData = item.outbound_setting;
	let outboundValidationSettingData = item.outbound_validation;
	let outboundFilterData = item.outbound_filter;
	let propertiesOutboundSettingData = item.items_prop_outbounds;
	let mappingOutboundSettingData = item.mapping_outbound_setting;
	const outboundEnableLog = (outboundSettingData != undefined && outboundSettingData.enableLog != undefined) ? outboundSettingData.enableLog : "off";
	let disabledOutboundEmailFailuresNotice = (outboundSettingData != undefined && outboundSettingData.disabledOutboundEmailFailuresNotice != undefined) ? outboundSettingData.disabledOutboundEmailFailuresNotice : "off";
	let disabledOutboundResponseFailuresNotice = (outboundSettingData != undefined && outboundSettingData.disabledOutboundResponseFailuresNotice != undefined) ? outboundSettingData.disabledOutboundResponseFailuresNotice : "off";
	let outboundFilterEnableLog = (outboundFilterData != undefined && outboundFilterData.enableLog != undefined) ? outboundFilterData.enableLog : "off";
	const flowType = outboundSettingData.flowType == "multiple";
	const ddep_api_auth_type = (inboundSettingData != undefined && inboundSettingData.ddep_api_auth_type != undefined) ? inboundSettingData.ddep_api_auth_type : "";
	const ddep_api_authorization_api_keys = (inboundSettingData != undefined && inboundSettingData.ddep_api_authorization_api_keys != undefined) ? inboundSettingData.ddep_api_authorization_api_keys : [];

	if ((item.isActive != undefined && item.isActive != "1") || (inboundSettingData != undefined && inboundSettingData.is_active != undefined && inboundSettingData.is_active != "Active") || (outboundSettingData != undefined && outboundSettingData.is_active != undefined && outboundSettingData.is_active != "Active")) {
		let longMsg = "Item not active!";

		if ((outboundSettingData.is_active != undefined && outboundSettingData.is_active != "Active")) {
			longMsg = "Item outbound not active!";
		}

		if ((inboundSettingData.is_active != undefined && inboundSettingData.is_active != "Active")) {
			longMsg = "Item inbound not active!";
		}

		if ((item.isActive != undefined && item.isActive != "1")) {
			longMsg = "Item not active!";
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Item Status", description: "Check Item, Inbound, and Outbound status : " + longMsg });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

		if (flowType && enabledebug != "true") { return; }

		return res.status(400).json({
			code: "1",
			MsgCode: "400004",
			MsgType: "Invalid-Source",
			MsgLang: "en",
			ShortMsg: "Get Fail",
			LongMsg: longMsg,
			InternalMsg: "",
			EnableAlert: "No",
			DisplayMsgBy: "ShortMsg",
			Data: [],
		});
	}

	if (ddep_api_auth_type == "API_Key") {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Check authorization" });

		let authApiKeyPass = 1;
		let keyExpired = false;
		let errorMessage = "401 Unauthorized";

		if (ddep_api_authorization_api_keys.length > 0) {
			const ddepAuthHeaderKeyArr = ddepAuthHeaderKey.split("-");
			for (let i = 0; i < ddepAuthHeaderKeyArr.length; i++) {
				ddepAuthHeaderKeyArr[i] = ddepAuthHeaderKeyArr[i].charAt(0).toUpperCase() + ddepAuthHeaderKeyArr[i].slice(1);
			}
			const newDdepAuthHeaderKey = ddepAuthHeaderKeyArr.join("-");
			const providedKey = newHeader[ddepAuthHeaderKey] || newHeader[newDdepAuthHeaderKey];

			for (let i = 0; i < ddep_api_authorization_api_keys.length; i++) {
				const storedKey = ddep_api_authorization_api_keys[i];

				// Check if key matches
				if (providedKey == (storedKey.key || storedKey.Key)) {
					// Check if key is expired
					if (storedKey.expiryDate) {
						const currentDate = new Date();
						currentDate.setHours(0, 0, 0, 0);
						const expDate = new Date(storedKey.expiryDate);
						expDate.setHours(0, 0, 0, 0);

						if (currentDate > expDate) {
							keyExpired = true;
							errorMessage = "401 Unauthorized , key expired , please contact provider.";
							authApiKeyPass = 1;
							break;
						}
					}

					authApiKeyPass = 0;
					break;
				}
			}
		} else {
			authApiKeyPass = 0;
		}

		if (authApiKeyPass == 1) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: keyExpired ? "Key expired" : "Unauthorized", httpStatus: "401 Unauthorized" });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });

			if (flowType && enabledebug != "true") { return; }

			return res.status(401).json({
				message: errorMessage,
				http_status_code: 401
			});
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Authorized Successful" });
	}

	if (ddep_api_auth_type === "JWT_Bearer") {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Check authorization" });

		const token = newHeader["Authorization"];

		if (!token) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Authorization token missing", httpStatus: "401 Unauthorized" });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });

			if (flowType && enabledebug != "true") { return; }

			return res.status(401).json({
				message: "Authorization token missing",
				http_status_code: 401
			});
		}

		const bearerToken = token.slice(7);

		try {
			// Decode the token without verifying the signature
			const decoded = jwt.decode(bearerToken, { complete: true }).payload;

			if (!decoded || decoded.exp < Date.now() / 1000) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Invalid expiry time, expiry time cannot be in the past", httpStatus: "401 Unauthorized" });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });


				if (flowType && enabledebug != "true") { return; }

				return res.status(401).json({
					message: "Invalid expiry time, expiry time cannot be in the past",
					http_status_code: 401
				});
			}

			const expirationTime = moment.unix(decoded.exp);
			const currentTime = moment();

			if (expirationTime.isAfter(currentTime.clone().add(5, "minutes"))) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Invalid expiry time, expiry time cannot be more than 5 minutes in the future", httpStatus: "401 Unauthorized" });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });

				if (flowType && enabledebug != "true") { return; }

				return res.status(401).json({
					message: "Invalid expiry time, expiry time cannot be more than 5 minutes in the future",
					http_status_code: 401
				});
			}

			const jti = decoded.jti;

			const existingRecord = await jwtJtiModel.findOne({ jti });
			if (existingRecord) {
				if (enableLogs == "on" || inboundEnableLog == "on" || enableFullLogs == "on") {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "the unique id already used", httpStatus: "401 Unauthorized" });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });
				}

				if (flowType && enabledebug != "true") { return; }

				return res.status(401).json({
					message: "the unique id already used",
					http_status_code: 401
				});
			}

			await jwtJtiModel.create({ jti });

			let isVerified = false;
			let secretExpired = false;

			for (const apiKey of ddep_api_authorization_api_keys) {
				try {
					if (apiKey.expiryDate) {
						const currentDate = new Date();
						currentDate.setHours(0, 0, 0, 0);
						const expDate = new Date(apiKey.expiryDate);
						expDate.setHours(0, 0, 0, 0);

						if (currentDate > expDate) {
							secretExpired = true;
							continue; // Skip to next key
						}
					}

					let key = apiKey.key;
					if (apiKey.base64Encode && apiKey.base64Encode == "true") {
						key = Buffer.from(apiKey.key, 'base64').toString('utf8');
					}
					jwt.verify(bearerToken, key);
					isVerified = true;
					break;
				} catch (err) {
					continue;
				}
			}

			if (!isVerified) {
				const description = secretExpired ? "Secret expired , please contact provider" : "Invalid Signature";

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: description, httpStatus: "401 Unauthorized" });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });

				if (flowType && enabledebug != "true") { return; }

				return res.status(401).json({
					message: description,
					http_status_code: 401
				});
			}

		} catch (error) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Invalid token", httpStatus: "401 Unauthorized" });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "401 Unauthorized" });

			if (flowType && enabledebug != "true") { return; }

			return res.status(401).json({
				message: "Invalid token",
				http_status_code: 401
			});
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Authorization", description: "Authorized Successful" });
	}

	let inboundPostData = reqBody;
	let inboundPostDataFormat = "json";

	if (typeof inbound_format === 'string') {
		inbound_format = [inbound_format];
	}

	if (inbound_format.includes(typereq[1])) {
		try {
			if (typereq[1] == "json") {
				inboundPostData = JSON.parse(JSON.stringify(reqBody));
				inboundPostDataFormat = "json";
			} else if (typereq[1] == "xml") {
				parseString(reqBody, function (err, result) {
					inboundPostData = jsonOriginal(result);
				});
				inboundPostDataFormat = "xml";
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Format", description: `Please post a valid ${typereq[1]} Format` });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

				if (flowType && enabledebug != "true") { return; }

				return res.json({
					code: "1",
					MsgCode: "50001",
					MsgType: "Exception-Error",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: `Please post a valid ${typereq[1]} Format`,
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					Data: []
				});
			}
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Format", description: `Please post a valid ${typereq[1]} Format` });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

			if (flowType && enabledebug != "true") { return; }

			return res.json({
				code: "1",
				MsgCode: "50001",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: `Please post a valid ${typereq[1]} Format`,
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: []
			});
		}
	}

	if (typereq != "" && typereq[0] == "text" && typereq[1] == "plain" && inbound_format.includes("json")) {
		try {
			inboundPostData = JSON.parse(reqBody);
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Format", description: "Please post a valid JSON Format" });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: "Fail", httpStatus: "200 OK" });

			if (flowType && enabledebug != "true") { return; }

			return res.json({
				code: "1",
				MsgCode: "50001",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "Please post a valid JSON Format",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: []
			});
		}
	}

	let endpoints = [];
	let defaultInboundMapping = "";
	let defaultOutboundMapping = "";
	let defaultInboundMappingVersion = "";
	let defaultOutboundMappingVersion = "";
	let outboundResponse = "";
	if (!isOldDdep) {
		endpoints = outboundSettingData.endpoints;
		defaultInboundMapping = outboundSettingData.defaultInboundMapping;
		defaultOutboundMapping = outboundSettingData.defaultOutboundMapping;
		defaultInboundMappingVersion = outboundSettingData.defaultInboundMappingVersion;
		defaultOutboundMappingVersion = outboundSettingData.defaultOutboundMappingVersion;
	} else {
		endpoints.push({
			endpoint: outboundSettingData.api_url,
			specifyHeaders: outboundSettingData?.specifyHeaders?.outbound_specify_headers_1 || null,
			status: true
		})
	}

	const newReqBody = JSON.parse(JSON.stringify(reqBody));
	const newBodyReq = JSON.parse(JSON.stringify(bodyreq));
	const reponseDebugResult = [];
	let request_id = '';
	const endpointsPromise = new Promise(async function (resolve, reject) {
		let endpoint_count = 0;
		for (let i = 0; i < endpoints.length; i++) {
			if (endpoints[i].status) {
				request_id = uuidv4();
				endpoint_count = i == 0 ? 0 : endpoint_count + 1;
				inboundFilterData = (isOldDdep) ? item.inbound_filter : [];
				propertiesSettingData = (isOldDdep) ? item.items_props : {};
				inboundFilterEnableLog = (isOldDdep && inboundFilterData?.enableLog) ? inboundFilterData.enableLog : "off";
				mappingSettingData = (isOldDdep) ? item.mapping_setting : {};
				item.mapping_setting = (isOldDdep) ? item.mapping_setting : {};

				outboundFilterData = (isOldDdep) ? item.outbound_filter : [];
				propertiesOutboundSettingData = (isOldDdep) ? item.items_prop_outbounds : {};
				outboundValidationSettingData = (isOldDdep) ? item.outbound_validation : (endpoints[i]?.triggerRules || []);
				outboundFilterEnableLog = (isOldDdep && outboundFilterData?.enableLog) ? outboundFilterData.enableLog : "off";
				outboundSettingData = item.outbound_setting;
				mappingOutboundSettingData = (isOldDdep) ? item.mapping_outbound_setting : {};
				item.mapping_outbound_setting = (isOldDdep) ? item.mapping_outbound_setting : {};

				const currentHeader = { ...newHeader };
				const endpoint = endpoints[i].endpoint || null;
				const partyId = endpoints[i].party || null;
				const inboundMappingId = endpoints[i].inboundMapping || defaultInboundMapping;
				const outboundMappingId = endpoints[i].outboundMapping || defaultOutboundMapping;
				const inboundMappingVersion = endpoints[i].inboundMappingVersion || defaultInboundMappingVersion;
				const outboundMappingVersion = endpoints[i].outboundMappingVersion || defaultOutboundMappingVersion;
				const specifyHeaders = endpoints[i].specifyHeaders || null;
				const default_response = endpoints[i].default_response || false;
				let outboundApiUrls = (isOldDdep) ? [item.outbound_setting.api_url] : [];
				outboundSettingData.specifyHeaders = specifyHeaders;

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
					disabledInboundEmailFailuresNotice,
					outboundApiUrls,
					emailDdepInputPath,
					outboundLastPath
				}

				mappingOutboundSettingData = {
					enableLog: outboundEnableLog,
					disabledOutboundEmailFailuresNotice,
					disabledOutboundResponseFailuresNotice,
					outboundApiUrls,
					emailDdepInputPath,
					outboundLastPath
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
						disabledInboundEmailFailuresNotice,
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
					// outboundSettingData.sendCollectionOnebyOne = (outboundMapping.data?.sendCollectionOnebyOne) ? "on" : "off";
					// outboundSettingData.collections_name = (outboundMapping.data?.collectionsName) ? outboundMapping.data?.collectionsName : "";
					outboundSettingData.outbound_format = item?.outbound_setting?.outbound_format || ["json"];
					mappingOutboundSettingData = {
						...mappingOutboundSettingData,
						inbound_format: outboundMapping.data?.inboundFormatData || "",
						outbound_format: outboundMapping.data?.outboundFormatData || "",
						mapping_data: outboundMapping.data?.mappingData || "",
						is_active: (outboundMapping.data?.isActive) ? "Active" : "Inactive",
						returnUrl: outboundMapping.data?.returnUrl || "",
						enableLog: outboundEnableLog,
						disabledOutboundEmailFailuresNotice,
						disabledOutboundResponseFailuresNotice
					}
					item.mapping_outbound_setting = mappingOutboundSettingData;
				}

				inboundPostData = JSON.parse(JSON.stringify(reqBody));
				let currentReqBody = newReqBody;
				let currentBodyReq = newBodyReq;
				let OutboundFormatData = {};
				let nodeDataArray = [];
				let linkDataArray = [];
				let inboundMappingData = {};
				let outboundMappedData = {};
				let outboundPostDataFormat = "json";
				let outboundResponseDataFormat = "json";
				let inboundFormatData = {};
				let inboundPostDataUnkeyArr = false;
				let outboundPostDataUnkeyArr = false;
				let outboundResponseDataUnkeyArr = false;
				let inboundFormatDataUnkeyArr = false;
				let outboundFormatDataUnkeyArr = false;
				const disableInboundEmail = specifyHeaders?.disableInboundEmail || false;

				reqIn.push(newBodyReq);

				console.log("\nReqIn Variable inbound processing:", JSON.stringify(reqIn, null, 2))

				// Store global variables for inbound processing
				if (propertiesSettingData != undefined) {
					const itemsProperties = propertiesSettingData?.item_properties || [];
					if (itemsProperties.length > 0) {
						for (let i = 0; i < itemsProperties.length; i++) {
							if (itemsProperties[i] != "") {
								if (itemsProperties[i].display.global) {
									if (itemsProperties[i].general.itemKey.startsWith('@In')) {
										data = findValueByPath(itemsProperties[i].general.itemKey, bodyreq);
										global.push({ [itemsProperties[i].display.global]: data })
									}
								}
							}
						}
					}
				}

				console.log("\nGlobal Variables inbound processing for (@In):", Object.assign({}, ...global));

				const inboundFilterHandlerRes = await inboundFilterHandler(enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, currentReqBody, inboundPostData, inboundPostDataUnkeyArr, inboundFilterData, item, inboundFilterEnableLog, currentBodyReq, outboundMappedData, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

				if (inboundFilterHandlerRes.code == 1) {
					await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });
					resolve(inboundFilterHandlerRes);
					break;
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

				let endpointMeta = { url: "", method: request_method, headers: header || {}, querystrings: querystring || '', row: endpoint_count, error: false, errorMessage: '', statusCode: '', responseTimeMs: 0 }
				let generalValues = { inboundPostData: inboundPostData, inboundMappingData: currentBodyReq }

				const inboundMappingHandlerRes = await inboundMappingHandler(outboundSettingData, enableLogs, enableFullLogs, companyCode, schedulerUniqueId, inboundEnableLog, outboundEnableLog, item_id, item, currentReqBody, currentBodyReq, mappingSettingData, inboundFormatData, inboundPostData, propertiesSettingData, inboundFormatDataUnkeyArr, outboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, outboundPostDataFormat, nodeDataArray, linkDataArray, outboundMappedData, OutboundFormatData, ItemName, emailDdepInputPath, outboundApiUrls, outboundLastPath, dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString, enabledebug, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, generalValues, enableDiffCheck, diffCheckReturnUrl);

				if (inboundMappingHandlerRes.code == 1) {
					reqOut.push(inboundMappingHandlerRes);
					if (flowType || enabledebug.toLowerCase() === "true") {
						currentReqBody = inboundMappingHandlerRes;
						currentBodyReq = inboundMappingHandlerRes;
						inboundFormatData = await inboundreplacementformatdata(inboundPostData, "@In{");
					} else {
						await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });
						resolve(inboundMappingHandlerRes);
						break;
					}
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

				if (inboundMappingHandlerRes.code == 0 && enabledebug.toLowerCase() !== "true") {
					const actions = outboundSettingData?.specifyHeaders?.actionsArray || [];
					const pickContent = {};
					const runAction = async a => {
						const t = a.actionType; if (!a.status) return;
						const vars = await processVariablesAndHeaders(companyCode, (t === "Webhook" ? a.webhook?.variables : a.email?.variables), OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);
						const hdrs = t === "Webhook" ? await processVariablesAndHeaders(companyCode, a.webhook?.headers, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) : null;
						const vres = await actionValidationHandler(a.validations || [], "@Out{", enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
						if (vres.code != 0) return;
						const contentObj = (t === "Webhook" ? a.webhook : a.email);
						const result = await processWebhookContent(contentObj.content || contentObj, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, outboundMappedData, {}, pickContent, vars, {});
						if (t === "Webhook") {
							const urlString = await buildFinalReturnUrl({ url: a.webhook.url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });
							const methodType = await formulaGetValue(companyCode, a.webhook.method || "POST", a.webhook.method || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
							if (urlString?.trim()) await webhook_call({ upUrl: urlString.trim(), methodType, triggerWhen: a.triggerWhen, webhook: a.webhook, result, actionHeaders: hdrs, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }).catch(err => console.error("Background webhook error:", err.message));
							return;
						}
						// Email
						let emailSubject = a.email.subject || '';
						emailSubject = replacePlaceholders(emailSubject, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
						emailSubject = await formulaGetValue(companyCode, emailSubject, emailSubject, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
						let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
						let outboundApiUrl = outboundApiUrls.length > 0 ? outboundApiUrls[0] : "";
						if (outboundLastPath != "") { outboundApiUrl += outboundLastPath; }
						if (queryString != "") { outboundApiUrl += "?" + queryString; }
						let endpointURL = outboundApiUrl;
						emailSend({ triggerWhen: a.triggerWhen, email: a.email, emailSubject, result, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail: mappingSettingData.disabledInboundEmailFailuresNotice, body: inboundPostData, transformedBody: outboundMappedData, responseBody: '', transformedResponseBody: '', entrypointURL, endpointURL }).catch(err => console.error("Background email error:", err.message));
					};

					const filterKey = "After-Transformed-Request";
					const todo = actions.filter(x => x.triggerWhen === filterKey && x.status && (x.actionType === "Webhook" || x.actionType === "Email"));
					if (todo.length) await Promise.allSettled(todo.map(a => runAction(a)));
				}

				const globalVariablesBeforeTrigger = specifyHeaders?.globalVariablesBeforeTrigger || [];
				if (globalVariablesBeforeTrigger && globalVariablesBeforeTrigger.length > 0) {
					for (let i = 0; i < globalVariablesBeforeTrigger.length; i++) {
						const { key, value, status } = globalVariablesBeforeTrigger[i];

						if (status || status == "true") {
							let globalValue = value || '';
							globalValue = replacePlaceholders(globalValue, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);

							globalValue = await processWebhookContent(globalValue, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, {}, {}, {}, endpointMeta);

							globalValue = await formulaGetValue(companyCode, globalValue, globalValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
							global.push({ [key]: globalValue })
						}
					}
				}

				// Store global variables for outbound processing
				if (propertiesSettingData != undefined) {
					const itemsProperties = propertiesSettingData?.item_properties || [];
					if (itemsProperties.length > 0) {
						for (let i = 0; i < itemsProperties.length; i++) {
							if (itemsProperties[i] != "") {
								if (itemsProperties[i].display.global) {
									if (itemsProperties[i].general.itemKey.startsWith('@Out')) {
										data = findValueByPath(itemsProperties[i].general.itemKey, outboundMappedData);
										global.push({ [itemsProperties[i].display.global]: data })
									}
								}
							}
						}
					}
				}

				if (mappingSettingData?.returnUrl && inboundMappingHandlerRes.code == 0 && enabledebug.toLowerCase() !== "true") {
					let updatedReturnUrl = resolveDirectFormula(mappingSettingData?.returnUrl, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
					updatedReturnUrl = await formulaGetValue(companyCode, updatedReturnUrl, updatedReturnUrl, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
					updatedReturnUrl = decodeURIComponent(updatedReturnUrl?.trim?.() || "");
					let urlString = "";
					if (!updatedReturnUrl) {
						const originalUrl = mappingSettingData?.returnUrl;
						try {
							const queryParams = parseReturnUrl(originalUrl);
							const url = new URL(originalUrl);

							if (Object.keys(queryParams).length > 0) {
								Object.entries(queryParams).forEach(([key, value]) => {
									const updatedValue = getValueForGlobal(value, querystring, header, global);
									url.searchParams.set(key, updatedValue);
								});
							}

							urlString = url.toString();
						} catch (err) {
							console.error("Invalid fallback URL:", originalUrl, err.message);
							urlString = "";
						}
					} else {
						urlString = updatedReturnUrl;
					}

					if (urlString?.trim()) {
						const returnUrlResponse = await sendResponseToReturnUrl(request_method, urlString, outboundMappedData, enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id);

						if (returnUrlResponse.code == 1) {
							await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });
							resolve(returnUrlResponse);
							break;
						}
					}
				}

				try {
					if (enabledebug.toLowerCase() !== "true" && (mappingSettingData?.enableEmail == "on")) {
						if (enableLogs == "on" || outboundEnableLog == "on" || enableFullLogs == "on") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP Outbound", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Start", description: "Start DDEP Outbound", request_id });
						}
					}

					let outboundValidationHandlerRes = await outboundValidationHandler(outboundValidationSettingData, currentReqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, inboundPostData, outboundMappedData, {}, {});
					const isDebugMode = enabledebug.toLowerCase() === "true";
					const shouldSendEmail = !isDebugMode && mappingSettingData?.enableEmail == "on";
					if (outboundValidationHandlerRes.code == 1) {
						if (flowType) {
							if (outboundValidationHandlerRes.rule == "STOP") {
								if (shouldSendEmail && !disableInboundEmail) {
									delete outboundValidationHandlerRes.rule;
									outboundValidationHandlerRes.LongMsg = "Trigger Rules matched to Stop all next endpoint items process";

									const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: outboundMappedData, resBody: {}, resTransformedBody: {} });

									const specificEmail = specifyHeaders?.notificationEmail || '';
									await ddepInboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableInboundEmail, specificEmail, inboundPostData, outboundValidationHandlerRes, emailDdepInputPath, outboundApiUrls, outboundLastPath, queryString, schedulerUniqueId, querystring, header, disabledInboundEmailFailuresNotice);
								}

								if (isDebugMode) {
									currentReqBody = outboundValidationHandlerRes;
									currentBodyReq = outboundValidationHandlerRes;
								} else {
									resolve(outboundValidationHandlerRes);
									break;
								}
							} else {
								if (isDebugMode) {
									delete outboundValidationHandlerRes.rule;
									currentReqBody = outboundValidationHandlerRes;
									currentBodyReq = outboundValidationHandlerRes;
								} else {
									if (default_response && multipleResponseSend != 1) {
										multipleResponseSend = 1;
										res.json(outboundValidationHandlerRes);
									}
									await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });
									continue;
								}
							}
						} else {
							delete outboundValidationHandlerRes.rule;
							if (shouldSendEmail && !disableInboundEmail) {
								const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: outboundMappedData, resBody: {}, resTransformedBody: {} });

								const specificEmail = specifyHeaders?.notificationEmail || '';
								await ddepInboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableInboundEmail, specificEmail, inboundPostData, outboundValidationHandlerRes, emailDdepInputPath, outboundApiUrls, outboundLastPath, queryString, schedulerUniqueId, querystring, header, disabledInboundEmailFailuresNotice);
							}
							await processOutboundApiUrls({ outboundApiUrls, outboundLastPath, queryString, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item, request_id });
							resolve(outboundValidationHandlerRes);
							break;
						}
					} else {
						if (currentReqBody.code == 1 && shouldSendEmail && !disableInboundEmail) {
							const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: outboundMappedData, resBody: {}, resTransformedBody: {} });

							const disableInboundEmail = specifyHeaders?.disableInboundEmail || false;
							const specificEmail = specifyHeaders?.notificationEmail || '';
							await ddepInboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableInboundEmail, specificEmail, inboundPostData, currentReqBody, emailDdepInputPath, outboundApiUrls, outboundLastPath, queryString, schedulerUniqueId, querystring, header, disabledInboundEmailFailuresNotice);
						}
					}

					if (enabledebug.toLowerCase() !== "true" && (mappingSettingData?.enableEmail == "on" && currentReqBody.code != 1) && !disableInboundEmail) {
						const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: outboundMappedData, resBody: {}, resTransformedBody: {} });

						const specificEmail = specifyHeaders?.notificationEmail || '';
						await ddepInboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 1, mailSubject, disableInboundEmail, specificEmail, inboundPostData, {}, emailDdepInputPath, outboundApiUrls, outboundLastPath, queryString, schedulerUniqueId, querystring, header, disabledInboundEmailFailuresNotice);
					}

					console.log("\nGlobal Variables inbound processing for (@Out):", Object.assign({}, ...global));

					for (let l = 0; l < outboundApiUrls.length; l++) {
						outboundSettingData.api_url = outboundApiUrls[l];
						outboundSettingData.specifyHeaders = specifyHeaders;
						outboundSettingData.outbound_format = item.outbound_setting.outbound_format;
						outboundSettingData.disabledOutboundEmailFailuresNotice = disabledOutboundEmailFailuresNotice;
						outboundSettingData.disabledOutboundResponseFailuresNotice = disabledOutboundResponseFailuresNotice

						console.time("api");
						const outboundHandlerRes = await outboundHandler(res, fullUrl, inboundPostData, outboundSettingData, currentReqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, emailDdepInputPath, outboundLastPath, queryString, currentHeader, responseBody, outboundPostDataUnkeyArr, inboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, currentBodyReq, enabledebug, enableAlertDebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundMappedData, outboundResponseDataFormat, inboundFormatDataUnkeyArr, reponseDebugResult, inboundEnableLog, inboundFilterEnableLog, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, afterGlobalLogDescription, flowTypeResponse, flowSingle, endpoint_count, enableDiffCheck, diffCheckReturnUrl);
						console.timeEnd("api");

						outboundResponse = outboundHandlerRes;

						if (flowType && enabledebug.toLowerCase() !== "true" && default_response && multipleResponseSend != 1) {
							multipleResponseSend = 1;
							res.contentType(outboundResponse.contentType).status(outboundResponse.statusCode).json(outboundResponse.data);
						} else if (flowType && enabledebug.toLowerCase() !== "true" && !default_response && multipleResponseSend != 1 && i == endpoints.length - 1) {
							const logId = schedulerUniqueId;
							const logUrl = `${config.domain}/logs/${logId}`;
							multipleResponseSend = 1;
							res.status(200).json({
								logId: logId,
								logUrl: logUrl,
								message: "The process received, please check the execution result on the logUrl."
							});
						}

						if (outboundHandlerRes.code == 1 || (outboundHandlerRes.code == 0 && outboundHandlerRes.rule == "STOP")) {
							resolve(outboundHandlerRes);
							break;
						}
					}
				} catch (err) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound validation setting.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound validation setting.", request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound validation setting.", request_id, httpStatus: 500 });

					resolve({
						code: "1",
						MsgCode: "500011",
						MsgType: "Exception-Error",
						MsgLang: "en",
						ShortMsg: "Fail",
						LongMsg: "catch " + err + " - Some error occurred while checking outbound validation setting.",
						InternalMsg: "",
						EnableAlert: "No",
						DisplayMsgBy: "LongMsg",
						Data: [],
						logQueueMsg: "Fail",
						logType: inboundEnableLog,
						httpStatus: 500
					});

					break;
				}

				if (enabledebug == "true") {
					resOut.push(outboundResponse?.data[i]?.transformedFormat);
				} else {
					// resOut.push(outboundResponse?.data);
				}
			}
			console.log("\nResOut Variable outbound processing:", JSON.stringify(resOut, null, 2))
		}

		console.timeEnd();

		resolve(outboundResponse);
	});

	endpointsPromise.then(async function (result) {
		if (result.code == 1) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: result.logQueueMsg || "", httpStatus: result.httpStatus || 200, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(result) : "" })

			outboundResponse = null;
			if (flowType && enabledebug != "true") {
				return;
			} else if (!flowType && flowSingle) {
				return res.status(result.httpStatus || 200).send(result);
			} else if (flowTypeResponse == "singleWithMultipleEndpoint" && enabledebug != "true") {
				return;
			} else {
				return res.status(result.httpStatus || 200).send(result);
			}
		} else {
			let parsedData;
			if (result && result.data) {
				parsedData = safeJSONStringify(result.data, config.dataSize);
			}
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Last End", description: result.logQueueMsg || "", httpStatus: result.httpStatus || 200, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "" })

			outboundResponse = null;

			if (flowType && enabledebug != "true") {
				return;
			} else if (!flowType && flowSingle) {
				return res.contentType(result.contentType).status(result.statusCode).send(result.data);
			} else if (flowTypeResponse == "singleWithMultipleEndpoint" && enabledebug != "true") {
				return;
			} else {
				return res.contentType(result.contentType).status(result.statusCode).send(result.data);
			}
		}
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

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id || item.item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "EndPoint URL", description: outbound_api_url, request_id });
	}
}

async function outboundHandler(res, fullUrl, inboundPostData, outboundSettingData, reqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, emailDdepInputPath, outboundLastPath, queryString, newHeader, responseBody, outboundPostDataUnkeyArr, inboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, bodyreq, enabledebug, enableAlertDebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundMappedData, outboundResponseDataFormat, inboundFormatDataUnkeyArr, reponseDebugResult, inboundEnableLog, inboundFilterEnableLog, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, afterGlobalLogDescription, flowTypeResponse, flowSingle, endpoint_count, enableDiffCheck, diffCheckReturnUrl) {
	return new Promise(async (resolve) => {
		try {
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

			if (outbound_send_collection_one_by_one == "on" && !isCollectionExist && reqBody?.code != 1) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound send collections not found.", request_id });

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

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id || item.item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "EndPoint URL", description: outbound_api_url, request_id });

				resolve({
					code: "1",
					MsgCode: "400010",
					MsgType: "Invalid-Source",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: "Collection does not exist in data.",
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					data: [],
					logQueueMsg: "Fail",
					logType: outboundEnableLog,
					httpStatus: 400
				});
			} else {
				if (outboundLastPath != "") {
					outbound_api_url += outboundLastPath;
				}

				if (queryString !== "") {
					if (outbound_api_url.includes("?")) {
						outbound_api_url += "&" + queryString;
					} else {
						outbound_api_url += "?" + queryString;
					}
				}

				let outboundApiHeaders = newHeader;
				delete outboundApiHeaders.Host;
				delete outboundApiHeaders["Accept-Encoding"];
				delete outboundApiHeaders["accept-encoding"];
				delete outboundApiHeaders["Cookie"];
				delete outboundApiHeaders["cookie"];
				delete outboundApiHeaders.Connection;
				delete outboundApiHeaders["Content-Length"];

				const outboundGlobalHeaders = outboundSettingData?.globalHeaders || [];
				if (outboundGlobalHeaders && outboundGlobalHeaders.length > 0) {
					for (let i = 0; i < outboundGlobalHeaders.length; i++) {
						const { key, value, status } = outboundGlobalHeaders[i];

						if (status || status == "true") {
							let headerValue = value || '';
							headerValue = replacePlaceholders(headerValue, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
							headerValue = await formulaGetValue(companyCode, headerValue, headerValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
							outboundApiHeaders[key] = headerValue;
							header = { ...header, [key]: headerValue };
						}
					}
				}

				console.log("\nHeader:", header);

				const outboundSpecifyHeaders = outboundSettingData?.specifyHeaders?.headers || outboundSettingData?.specifyHeaders || [];
				for (let i = 0; i < outboundSpecifyHeaders.length; i++) {
					const { key, value, status } = outboundSpecifyHeaders[i];

					if (status || status == "true") {
						let headerValue = value || '';
						headerValue = replacePlaceholders(headerValue, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
						headerValue = await formulaGetValue(companyCode, headerValue, headerValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
						header = { ...header, [key]: headerValue };
						outboundApiHeaders[key] = headerValue;
					}
				}

				delete outboundApiHeaders.host;

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
				} else if (outbound_send_collection_one_by_one == "off" && !outboundPostDataUnkeyArr && inboundPostDataUnkeyArr && reqBody.items != undefined) {
					reqBody = reqBody.items;
					outboundPostDataUnkeyArr = false;
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
					let reqBodyArr = [];
					reqBodyArr.push(reqBody);
					newReqBody = reqBodyArr;
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

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(reqBody) : "", request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Collection configure", description: index, datas: JSON.stringify(reqBody), request_id });
						}

						// const request_method = outboundSettingData?.specifyHeaders?.request_method || 'DEFAULT';

						// if (request_method !== "DEFAULT") {
						outbound_api_options_body = { ...outbound_api_options_body, method: request_method }
						outbound_api_options = { ...outbound_api_options, method: request_method }
						// }

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "EndPoint URL", description: outbound_api_url, request_id });

						if (outboundSettingData.flowType != "multiple" && flowSingle == "single" && newReqBody.length > 1 && enabledebug.toLowerCase() !== "true") {
							flowTypeResponse = "singleWithMultipleEndpoint";
							flowSingle = "";
							const logId = schedulerUniqueId;
							const logUrl = `${config.domain}/logs/${logId}`;
							if (index == newReqBody.length - 1) {
								res.status(200).json({
									logId: schedulerUniqueId,
									logUrl: logUrl,
									message: "The process received, please check the execution result on the logUrl."
								});
							}
						} else {
							flowTypeResponse = "single";
							flowSingle = "single";
						}

						if (outboundSettingData.flowType != "multiple" && newReqBody.length <= 1 && enabledebug.toLowerCase() !== "true") {
							flowTypeResponse = "single";
							flowSingle = "single";
						}

						if (enabledebug.toLowerCase() == "true") {
							const key = reqBody?.code == 1 ? 'validationFail' : 'transformedFormat';
							if (xmlbodyreq == "") {
								if (outboundSettingData.flowType != "multiple") {
									if (newReqBody.length > 1) {
										reponseDebugResult.push({
											endpoint: outbound_api_url,
											[key]: reqBody
										});

										if (index == newReqBody.length - 1) {
											resolve({
												code: "0",
												contentType: "application/json",
												statusCode: 200,
												httpStatus: "200 OK",
												logType: inboundEnableLog,
												logQueueMsg: "Success",
												data: reponseDebugResult
											});
											return;
										} else {
											continue;
										}
									} else {
										resolve({
											code: "0",
											contentType: "application/json",
											statusCode: 200,
											httpStatus: "200 OK",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: [
												{
													endpoint: outbound_api_url,
													[key]: reqBody
												}
											]
										});
										return;
									}
								} else {
									reponseDebugResult.push({
										endpoint: outbound_api_url,
										[key]: reqBody
									});

									if (reqBody?.rule == "STOP") {
										resolve({
											code: "0",
											contentType: "application/xml",
											statusCode: 200,
											httpStatus: "200 OK",
											rule: "STOP",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: reponseDebugResult
										});
										return;
									}

									if (index == newReqBody.length - 1) {
										resolve({
											code: "0",
											contentType: "application/json",
											statusCode: 200,
											httpStatus: "200 OK",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: reponseDebugResult
										});
										return;
									} else {
										continue;
									}
								}
							} else {
								if (outboundSettingData.flowType != "multiple") {
									if (newReqBody.length > 1) {
										reponseDebugResult.push({
											endpoint: outbound_api_url,
											[key]: reqBody
										});

										if (index == newReqBody.length - 1) {
											resolve({
												code: "0",
												contentType: "application/xml",
												statusCode: 200,
												httpStatus: "200 OK",
												rule: "STOP",
												logType: inboundEnableLog,
												logQueueMsg: "Success",
												data: reponseDebugResult
											});
											return;
										} else {
											continue;
										}
									} else {
										resolve({
											code: "0",
											contentType: "application/xml",
											statusCode: 200,
											httpStatus: "200 OK",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: [
												{
													endpoint: outbound_api_url,
													[key]: reqBody
												}
											]
										});
										return;
									}
								} else {
									reponseDebugResult.push({
										endpoint: outbound_api_url,
										[key]: reqBody
									});

									if (reqBody?.rule == "STOP") {
										resolve({
											code: "0",
											contentType: "application/xml",
											statusCode: 200,
											httpStatus: "200 OK",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: reponseDebugResult
										});
										return;
									}

									if (index == newReqBody.length - 1) {
										resolve({
											code: "0",
											contentType: "application/xml",
											statusCode: 200,
											httpStatus: "200 OK",
											logType: inboundEnableLog,
											logQueueMsg: "Success",
											data: reponseDebugResult
										});
										return;
									} else {
										continue;
									}
								}
							}
						}

						if (enabledebug.toLowerCase() !== "true" && reqBody?.code == 1) {
							resIn.push(null);
							resOut.push(null);
							resolve(reqBody);
							return;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Post Data", description: "Posting Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify({ ...outbound_api_options, body: safeJSONWithOutStringify(outbound_api_options.body, config.dataSize) }) : "", request_id });

						const startTimeMs = Date.now();
						let outboundApiResponse = await outboundApiResponseHandler(fullUrl, outbound_api_url, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, outboundMappedData, xmlbodyreq, nodeDataArray, linkDataArray, OutboundFormatData, inboundMappingData, inboundPostData, reqBody, inboundFilterEnableLog, inboundEnableLog, outbound_api_options, outbound_api_options_body, outboundSettingData, outboundPostDataFormat, outboundResponseDataFormat, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, emailDdepInputPath, queryString, newHeader, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, afterGlobalLogDescription, isCollectionExist, index, endpoint_count, enableDiffCheck, diffCheckReturnUrl);

						const endTimeMs = Date.now();
						const responseTimeMs = endTimeMs - startTimeMs;

						if (mappingOutboundSettingData?.returnUrl && outboundApiResponse.code == 0 && enabledebug.toLowerCase() !== "true") {
							let updatedReturnUrl = resolveDirectFormula(mappingOutboundSettingData?.returnUrl, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
							updatedReturnUrl = await formulaGetValue(companyCode, updatedReturnUrl, updatedReturnUrl, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
							updatedReturnUrl = decodeURIComponent(updatedReturnUrl?.trim?.() || "");
							let urlString = "";
							if (!updatedReturnUrl) {
								const originalUrl = mappingOutboundSettingData.returnUrl;
								try {
									const queryParams = parseReturnUrl(originalUrl);
									const url = new URL(originalUrl);

									if (Object.keys(queryParams).length > 0) {
										Object.entries(queryParams).forEach(([key, value]) => {
											const updatedValue = getValueForGlobal(value, querystring, header, global);
											url.searchParams.set(key, updatedValue);
										});
									}

									urlString = url.toString();
								} catch (err) {
									console.error("Invalid fallback URL:", originalUrl, err.message);
									urlString = "";
								}
							} else {
								urlString = updatedReturnUrl;
							}

							if (urlString?.trim()) {
								const returnUrlResponse = await sendResponseToReturnUrl(request_method, urlString, outboundApiResponse.data, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id);

								if (returnUrlResponse?.code === 1) {
									if (flowTypeResponse === "singleWithMultipleEndpoint") {
										continue;
									} else {
										resolve(returnUrlResponse);
										break;
									}
								}
							}
						}

						try {
							if (!outboundApiResponse || !outboundApiResponse.data) { resOut.push(null); return; }
							const responseData = typeof outboundApiResponse.data === 'string'
								? JSON.parse(outboundApiResponse.data)
								: outboundApiResponse.data;

							if (isCollectionExist) {
								if (!resOut[endpoint_count]) { resOut[endpoint_count] = []; }
								if (typeof index !== 'undefined') {
									resOut[endpoint_count][index] = responseData;
								} else {
									resOut[endpoint_count].push(responseData);
								}
							} else { resOut.push(responseData); }
						} catch (error) { resOut.push(null); }

						let endpointMeta = {
							url: outbound_api_url,
							method: outbound_api_options.method || 'GET',
							headers: outbound_api_options.headers || {},
							querystrings: querystring || '',
							row: endpoint_count,
							error: outboundApiResponse?.error || false,
							errorMessage: outboundApiResponse?.error ? outboundApiResponse?.LongMsg || '' : '',
							statusCode: outboundApiResponse?.statusCode || '',
							responseTimeMs: responseTimeMs || 0
						}

						const pickContent = outboundApiResponse?.data;
						const resBodyData = outboundApiResponse?.resBody;
						let newOutboundFormatData = outboundApiResponse?.OutboundFormatData || {};
						let newInboundFormatData = outboundApiResponse?.inboundFormatData || {};
						let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
						let endpointURL = outbound_api_url;

						// For Alert check

						setImmediate(() => {
							runAlertConditionsInBackground({
								item_id, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item, inboundPostData, inboundMappingData, resBodyData, pickContent, endpointMeta, outboundMappedData, request_id, disabledMail: mappingOutboundSettingData.disabledOutboundEmailFailuresNotice, entrypointURL, endpointURL, enableAlertDebug
							});
						});


						if (enabledebug.toLowerCase() !== "true") {
							const actions = outboundSettingData?.specifyHeaders?.actionsArray || [];
							const pickContent = outboundApiResponse?.data;
							const resBody = outboundApiResponse?.resBody;
							let newOutboundFormatData = outboundApiResponse?.OutboundFormatData || {};
							let newInboundFormatData = outboundApiResponse?.inboundFormatData || {};
							const runAction = async a => {
								const t = a.actionType; if (!a.status) return;
								const vars = await processVariablesAndHeaders(companyCode, (t === "Webhook" ? a.webhook?.variables : a.email?.variables), newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);
								const hdrs = t === "Webhook" ? await processVariablesAndHeaders(companyCode, a.webhook?.headers, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) : null;
								const vres = await actionValidationHandler(a.validations || [], "@Out{", enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, newInboundFormatData, newOutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
								if (vres.code != 0) return;
								const contentObj = (t === "Webhook" ? a.webhook : a.email);
								const result = await processWebhookContent(contentObj.content || contentObj, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, outboundMappedData, resBody, pickContent, vars, {});

								if (t === "Webhook") {
									const urlString = await buildFinalReturnUrl({ url: a.webhook.url, OutboundFormatData: newOutboundFormatData, inboundFormatData: newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });
									const methodType = await formulaGetValue(companyCode, a.webhook.method || "POST", a.webhook.method || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
									if (urlString?.trim()) await webhook_call({ upUrl: urlString.trim(), methodType, triggerWhen: a.triggerWhen, webhook: a.webhook, result, actionHeaders: hdrs, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }).catch(err => console.error("Background webhook error:", err.message));
									return;
								}
								// Email
								let emailSubject = a.email.subject || '';
								emailSubject = replacePlaceholders(emailSubject, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
								emailSubject = await formulaGetValue(companyCode, emailSubject, emailSubject, "", newOutboundFormatData, newInboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
								let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
								let endpointURL = outbound_api_url;
								await emailSend({ triggerWhen: a.triggerWhen, email: a.email, emailSubject, result, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail: mappingOutboundSettingData.disabledOutboundEmailFailuresNotice, body: inboundPostData, transformedBody: outboundMappedData, responseBody: resBody, transformedResponseBody: pickContent, entrypointURL, endpointURL }).catch(err => console.error("Background email error:", err.message));
							};

							const filterKey = "End-Of-Session";
							const todo = actions.filter(x => x.triggerWhen === filterKey && x.status && (x.actionType === "Webhook" || x.actionType === "Email"));
							if (todo.length) await Promise.allSettled(todo.map(a => runAction(a)));
						}

						delete outboundApiResponse?.OutboundFormatData;
						delete outboundApiResponse?.inboundFormatData;
						delete outboundApiResponse?.resBody;
						delete outboundApiResponse?.error;

						if (index === newReqBody.length - 1) {
							resolve(outboundApiResponse);
						}
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "Outbound post data is empty.", request_id });

					resolve({
						code: "1",
						MsgCode: "500012",
						MsgType: "Invalid-Source",
						MsgLang: "en",
						ShortMsg: "Fail",
						LongMsg: "Outbound post data is empty.",
						InternalMsg: "",
						EnableAlert: "No",
						DisplayMsgBy: "LongMsg",
						data: [],
						logQueueMsg: "Fail",
						logType: inboundEnableLog,
						httpStatus: 500
					});
				}
			}
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound setting.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while checking outbound setting.", request_id });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "catch " + err + " - Some error occurred while checking outbound setting.", request_id, httpStatus: 500 });

			resolve({
				code: "1",
				MsgCode: "500010",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "catch " + err + " - Some error occurred while checking outbound setting.",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				data: [],
				logQueueMsg: "Fail",
				logType: inboundEnableLog,
				httpStatus: 500
			});
		}
	});
}

async function outboundApiResponseHandler(fullUrl, outbound_api_url, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, outboundMappedData, xmlbodyreq, nodeDataArray, linkDataArray, OutboundFormatData, inboundMappingData, inboundPostData, reqBody, inboundFilterEnableLog, inboundEnableLog, outbound_api_options, outbound_api_options_body, outboundSettingData, outboundPostDataFormat, outboundResponseDataFormat, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, emailDdepInputPath, queryString, newHeader, enabledebug, ItemName, outboundResponseDataUnkeyArr, outboundFilterData, mappingOutboundSettingData, inboundFormatData, propertiesOutboundSettingData, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, afterGlobalLogDescription, is_collection, reqbody_index, endpoint_count, enableDiffCheck, diffCheckReturnUrl) {
	return new Promise(async (resolve) => {
		let beforeResponseInboundFormatData = inboundFormatData;
		let beforeResponseOutboundFormatData = OutboundFormatData;
		const requestOptions = {
			...outbound_api_options,
			timeout: 30000, // 30 seconds timeout
			connectTimeout: 10000, // 10 seconds connection timeout
		};

		if (requestOptions.headers) {
			requestOptions.headers['Accept'] = '*/*';
			delete requestOptions.headers['If-None-Match'];
		}

		// ============== ADD RETRY LOGIC FUNCTION HERE ==============
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
							type: "DDEP API",
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

		let endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: querystring || '', row: endpoint_count, error: false, errorMessage: '', statusCode: '', responseTimeMs: 0 }

		let updatedLogDescription = Array.isArray(afterGlobalLogDescription) ? afterGlobalLogDescription : [];

		let logDescription = outboundSettingData?.specifyHeaders?.beforeLogDescription || '';

		logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

		logDescription = await processWebhookContent(logDescription, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, {}, {}, {}, endpointMeta);

		let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

		if (logDescriptionFormula || logDescriptionFormula == null) {
			updatedLogDescription.push(`${logDescriptionFormula}`);
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Trigger", description: "OutBound Trigger", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, isTriggeredOutbound: true, request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

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

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Entrypoint", description: "CURL Bash", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? curlCommand : "", request_id });

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
			let globalVariablesAfterResponse = outboundSettingData?.specifyHeaders?.globalVariablesAfterResponse || [];
			if (globalVariablesAfterResponse && globalVariablesAfterResponse.length > 0) {
				for (let i = 0; i < globalVariablesAfterResponse.length; i++) {
					const { key, value, status } = globalVariablesAfterResponse[i];

					if (status || status == "true") {
						let globalValue = value || '';
						globalValue = replacePlaceholders(globalValue, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

						globalValue = await processWebhookContent(globalValue, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, {}, {}, {}, endpointMeta);

						globalValue = await formulaGetValue(companyCode, globalValue, globalValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
						global.push({ [key]: globalValue })
					}
				}
			}

			endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: querystring || '', row: endpoint_count, error: true, errorMessage: error?.message || '', statusCode: 500, responseTimeMs: 0 }

			let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';

			logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

			logDescription = await processWebhookContent(logDescription, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, {}, {}, {}, endpointMeta);

			let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

			if (logDescriptionFormula || logDescriptionFormula == null) {
				updatedLogDescription.push(`${logDescriptionFormula}`);
			}

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

			// Enhanced error logging
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: `After ${3} retries: ${error.message}`, httpStatus: 500, request_id });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: "Connect Outbound API Timeout (" + outbound_api_url + ")", exception_type: "Connection Error", item: ItemName, detail_exception: `${error.code || 'Unknown'}: ${error.message}`, httpStatus: 500, request_id });

			let errorBody = {
				code: "1",
				MsgCode: "500013",
				MsgType: "Invalid-Source",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: `After ${3} retries: ${error.message} - Some error occurred while getting.`,
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				data: [],
				logQueueMsg: "Fail",
				logType: outboundEnableLog,
				httpStatus: 500,
				statusCode: 500,
				inboundFormatData: beforeResponseInboundFormatData,
				OutboundFormatData: beforeResponseOutboundFormatData,
				resBody: body,
				error: true
			}

			const disableOutboundEmail = outboundSettingData?.specifyHeaders?.disableOutboundEmail || false;
			if (enabledebug.toLowerCase() !== "true" && outboundSettingData?.enableEmail == "on" && !disableOutboundEmail) {
				endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: querystring || '', row: endpoint_count, error: true, errorMessage: error?.message || '', statusCode: 500, responseTimeMs: 0 }

				const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: {}, resTransformedBody: {} });

				const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
				await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, {}, {}, errorBody, "API Error", schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
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

					try {
						if (!body) { resIn.push(null); return; }
						const resBodyData = typeof body === 'string' ? JSON.parse(body) : body;
						if (is_collection) {
							if (!resIn[endpoint_count]) { resIn[endpoint_count] = []; }
							if (typeof reqbody_index !== 'undefined') {
								resIn[endpoint_count][reqbody_index] = resBodyData;
							} else {
								resIn[endpoint_count].push(resBodyData);
							}
						} else { resIn.push(resBodyData); }
					} catch (error) {
						resIn.push({});
					}

					let globalVariablesAfterResponse = outboundSettingData?.specifyHeaders?.globalVariablesAfterResponse || [];
					if (globalVariablesAfterResponse && globalVariablesAfterResponse.length > 0) {
						for (let i = 0; i < globalVariablesAfterResponse.length; i++) {
							const { key, value, status } = globalVariablesAfterResponse[i];

							if (status || status == "true") {
								let globalValue = value || '';
								globalValue = replacePlaceholders(globalValue, {}, {}, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

								globalValue = await processWebhookContent(globalValue, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, body, {}, endpointMeta);

								globalValue = await formulaGetValue(companyCode, globalValue, globalValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);

								global.push({ [key]: globalValue })
							}
						}
					}

					let parsedData = safeJSONStringify(body, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", httpStatus: response?.statusCode + " " + response?.statusMessage, request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: JSON.stringify({ "message": response?.statusMessage, "http_status_code": response?.statusCode }), request_id });

					let resTransformedBody = body;

					// FOR WEBHOOK PART After-Transformed-Response
					if (!enabledebug || enabledebug.toLowerCase() !== "true") {
						const actions = outboundSettingData?.specifyHeaders?.actionsArray || [];
						const pickContent = resTransformedBody;
						const runAction = async a => {
							const t = a.actionType; if (!a.status) return;
							const vars = await processVariablesAndHeaders(companyCode, (t === "Webhook" ? a.webhook?.variables : a.email?.variables), {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);
							const hdrs = t === "Webhook" ? await processVariablesAndHeaders(companyCode, a.webhook?.headers, {}, {}, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) : null;
							const vres = await actionValidationHandler(a.validations || [], "@Out{", enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, {}, {}, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
							if (vres.code != 0) return;
							const contentObj = (t === "Webhook" ? a.webhook : a.email);
							const result = await processWebhookContent(contentObj.content || contentObj, companyCode, beforeResponseOutboundFormatData, beforeResponseInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, pickContent, vars, {});
							if (t === "Webhook") {
								const urlString = await buildFinalReturnUrl({ url: a.webhook.url, OutboundFormatData: {}, inboundFormatData: {}, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });
								const methodType = await formulaGetValue(companyCode, a.webhook.method || "POST", a.webhook.method || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
								if (urlString?.trim()) await webhook_call({ upUrl: urlString.trim(), methodType, triggerWhen: a.triggerWhen, webhook: a.webhook, result, actionHeaders: hdrs, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }).catch(err => console.error("Background webhook error:", err.message));
								return;
							}
							// Email
							let emailSubject = a.email.subject || '';
							emailSubject = replacePlaceholders(emailSubject, {}, {}, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
							emailSubject = await formulaGetValue(companyCode, emailSubject, emailSubject, "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
							let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
							let endpointURL = outbound_api_url;
							await emailSend({ triggerWhen: a.triggerWhen, email: a.email, emailSubject, result, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail: mappingOutboundSettingData.disabledOutboundEmailFailuresNotice, body: inboundPostData, transformedBody: inboundMappingData, responseBody: pickContent, transformedResponseBody: pickContent, entrypointURL, endpointURL }).catch(err => console.error("Background email error:", err.message));
						};

						const filterKey = "After-Transformed-Response";
						const todo = actions.filter(x => x.triggerWhen === filterKey && x.status && (x.actionType === "Webhook" || x.actionType === "Email"));
						if (todo.length) await Promise.allSettled(todo.map(a => runAction(a)));
					}

					if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
						await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl, outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "DDEP API" });
					}

					// For Differnce checker function here
					const baseLogData = { companyCode, log_unique_id: schedulerUniqueId, log_request_id: request_id, item_id, ItemName: item.ItemName, type: "Outbound", path: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath };
					const diff_unique_id = uuidv4();
					const notifyBaseLogData = { ...baseLogData, unique_id: diff_unique_id, };

					try {
						let templateOutbound = outboundSettingData?.specifyHeaders?.templateOutbound || "";
						if (templateOutbound && enableDiffCheck == "on") {
							// templateOutbound = replacePlaceholders(templateOutbound, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							templateOutbound = await processWebhookContent(templateOutbound, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, outboundMappedData, resTransformedBody, resTransformedBody, {}, {});
							templateOutbound = await formulaGetValue(companyCode, templateOutbound || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global);

							const diffResult = await lineByLineDiff(templateOutbound, resTransformedBody);
							const changedLines = diffResult.rows.filter(r => r.changeType !== "unchanged");

							if (changedLines.length > 0) {
								addToLogDiffQueue({ ...notifyBaseLogData, action: "Start", description: `Start Diff Checker` });

								addToLogDiffQueue({ ...notifyBaseLogData, action: "Diff Row Count", description: changedLines.length });

								addToLogDiffQueue({ ...notifyBaseLogData, action: "EndPoint URL", description: endpointMeta?.url });

								const recordToStore = { itemId: item_id, unique_id: schedulerUniqueId, ItemName: item.ItemName, type: "Outbound", totalDiffRow: changedLines.length, entrypointURL: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath, endpointURL: endpointMeta?.url, body: diffResult.rightText, template: diffResult.leftText, companyCode };

								if (diffCheckReturnUrl) {
									await handleDiffCheckerReturnUrl(notifyBaseLogData, diffCheckReturnUrl, recordToStore);
								}

								addToLogDiffQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
							}
						}

					} catch (error) {
						console.error("Error generating diff unique ID:", error);
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: parsedData, exception_type: "Connection Error", item: ItemName, detail_exception: "Outbound API responsed status : " + response?.statusCode + " : " + response?.statusMessage, httpStatus: response?.statusCode + " " + response?.statusMessage, request_id });

					endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: querystring || '', row: endpoint_count, error: false, errorMessage: '', statusCode: response?.statusCode, responseTimeMs: 0 }

					let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';
					logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

					logDescription = await processWebhookContent(logDescription, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, resTransformedBody, {}, endpointMeta);

					let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

					if (logDescriptionFormula) {
						updatedLogDescription.push(`${logDescriptionFormula}`);
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound", request_id });

					const disableOutboundEmail = outboundSettingData?.specifyHeaders?.disableOutboundEmail || false;
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

						if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {

							const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody: resTransformedBody });
							const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
							await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, body, body, {}, response?.statusCode + " " + response?.statusMessage, schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
						}

						resolve(errorBody);
					} else {
						if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {
							const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody: resTransformedBody });
							const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
							await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, body, body, {}, response?.statusCode + " " + response?.statusMessage, schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
						}

						resolve({
							code: "0",
							contentType: "application/json",
							statusCode: response?.statusCode || 200,
							data: body,
							inboundFormatData: beforeResponseInboundFormatData,
							OutboundFormatData: beforeResponseOutboundFormatData,
							resBody: body,
							logQueueMsg: "Success",
							logType: inboundEnableLog,
							httpStatus: response?.statusCode + " " + response?.statusMessage,
							error: false
						});
					}
				} else {
					const responseStr = JSON.stringify(outboundResponseData);
					let responseStrByte = Buffer.byteLength(responseStr, 'utf8');

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response Size", description: "Response Data Size", datas: responseStrByte, httpStatus: response?.statusCode + " " + response?.statusMessage, request_id });

					let parsedData = safeJSONStringify(outboundResponseData, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Response", description: "Response Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", httpStatus: response?.statusCode + " " + response?.statusMessage, request_id });

					let responseData = outboundResponseData;

					parsedData = null;

					try {
						if (!responseData) { resIn.push(null); return; }
						const res = typeof responseData === 'string' ? JSON.parse(responseData) : responseData;
						if (is_collection) {
							if (!resIn[endpoint_count]) { resIn[endpoint_count] = []; }
							if (typeof reqbody_index !== 'undefined') {
								resIn[endpoint_count][reqbody_index] = res;
							} else {
								resIn[endpoint_count].push(res);
							}
						} else { resIn.push(res); }
					} catch (error) {
						resIn.push({});
					}

					console.log("\nResIn Variable outbound processing:", JSON.stringify(resIn, null, 2));

					// Store global variables for inbound processing
					if (propertiesOutboundSettingData != undefined) {
						const itemsProperties = propertiesOutboundSettingData?.item_properties || [];
						if (itemsProperties.length > 0) {
							for (let i = 0; i < itemsProperties.length; i++) {
								if (itemsProperties[i] != "") {
									if (itemsProperties[i].display.global) {
										if (itemsProperties[i].general.itemKey.startsWith('@In')) {
											data = findValueByPath(itemsProperties[i].general.itemKey, outboundResponseData);
											global.push({ [itemsProperties[i].display.global]: data })
										}
									}
								}
							}
						}
					}

					let resTransformedBody;

					endpointMeta = { url: outbound_api_url, method: outbound_api_options.method || 'GET', headers: outbound_api_options.headers || {}, querystrings: querystring || '', row: endpoint_count, error: false, errorMessage: '', statusCode: response?.statusCode, responseTimeMs: 0 }

					console.log("\nGlobal Variables outbound processing for (@In): ", Object.assign({}, ...global));

					const outboundFilterHandlerRes = await outboundFilterHandler(outboundResponseData, outboundResponseDataUnkeyArr, outboundFilterData, item, enableLogs, outboundEnableLog, inboundFilterEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

					if (outboundFilterHandlerRes.code == 1) {
						resTransformedBody = outboundFilterHandlerRes;

						if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
							await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl, outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "DDEP API" });
						}
						resolve(outboundFilterHandlerRes);
					} else {
						outboundResponseData = outboundFilterHandlerRes.outboundResponseData;
						outboundResponseDataUnkeyArr = outboundFilterHandlerRes.outboundResponseDataUnkeyArr;
					}

					let generalValues = { inboundPostData, inboundMappingData, body: body, resTransfromBody: {} }

					const outboundMappingHandlerRes = await outboundMappingHandler(inboundPostData, inboundMappingData, outbound_api_options_body, responseData, mappingOutboundSettingData, outboundSettingData, outboundResponseData, inboundFormatData, propertiesOutboundSettingData, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundResponseDataUnkeyArr, outboundMappedData, xmlbodyreq, outboundResponseDataFormat, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, emailDdepInputPath, dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString, enabledebug, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, generalValues, enableDiffCheck, diffCheckReturnUrl);

					if (outboundMappingHandlerRes.code == 1) {
						resTransformedBody = outboundMappingHandlerRes;

						if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
							await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl, outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "DDEP API" });
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

					// Store global variables for outbound processing
					if (propertiesOutboundSettingData != undefined) {
						const itemsProperties = propertiesOutboundSettingData?.item_properties || [];
						if (itemsProperties.length > 0) {
							for (let i = 0; i < itemsProperties.length; i++) {
								if (itemsProperties[i] != "") {
									if (itemsProperties[i].display.global) {
										if (itemsProperties[i].general.itemKey.startsWith('@Out')) {
											data = findValueByPath(itemsProperties[i].general.itemKey, outboundResponseData);
											global.push({ [itemsProperties[i].display.global]: data })
										}
									}
								}
							}
						}
					}

					console.log("\nGlobal Variables outbound processing for (@Out): ", Object.assign({}, ...global));

					let newInboundFormatData = { ...beforeResponseInboundFormatData, ...inboundFormatData }
					let newOutboundFormatData = { ...beforeResponseOutboundFormatData, ...OutboundFormatData }
					resTransformedBody = outboundResponseData;

					let globalVariablesAfterResponse = outboundSettingData?.specifyHeaders?.globalVariablesAfterResponse || [];
					if (globalVariablesAfterResponse && globalVariablesAfterResponse.length > 0) {
						for (let i = 0; i < globalVariablesAfterResponse.length; i++) {
							const { key, value, status } = globalVariablesAfterResponse[i];
							if (status || status == "true") {
								let globalValue = value || '';
								globalValue = replacePlaceholders(globalValue, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

								globalValue = await processWebhookContent(globalValue, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, body, resTransformedBody, endpointMeta);

								globalValue = await formulaGetValue(companyCode, globalValue, globalValue, "", OutboundFormatData, inboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
								global.push({ [key]: globalValue })
							}
						}
					}

					let logDescription = outboundSettingData?.specifyHeaders?.logDescription || '';
					logDescription = replacePlaceholders(logDescription, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

					logDescription = await processWebhookContent(logDescription, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, resTransformedBody, {}, endpointMeta);

					let logDescriptionFormula = await formulaGetValue(companyCode, logDescription, logDescription, "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);

					if (logDescriptionFormula || logDescriptionFormula == null) {
						updatedLogDescription.push(`${logDescriptionFormula}`);
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, action: "OutBound Log", description: "Log Description", projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? updatedLogDescription.join('\n') : "", request_id });

					// FOR WEBHOOK PART After-Transformed-Response
					if (!enabledebug || enabledebug.toLowerCase() !== "true") {
						const actions = outboundSettingData?.specifyHeaders?.actionsArray || [];
						const pickContent = resTransformedBody;
						const runAction = async a => {
							const t = a.actionType; if (!a.status) return;

							const vars = await processVariablesAndHeaders(companyCode, (t === "Webhook" ? a.webhook?.variables : a.email?.variables), newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);
							const hdrs = t === "Webhook" ? await processVariablesAndHeaders(companyCode, a.webhook?.headers, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) : null;
							const vres = await actionValidationHandler(a.validations || [], "@Out{", enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, newInboundFormatData, newOutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);
							if (vres.code != 0) return;
							const contentObj = (t === "Webhook" ? a.webhook : a.email);

							const result = await processWebhookContent(contentObj.content || contentObj, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, pickContent, vars, {});
							if (t === "Webhook") {
								const urlString = await buildFinalReturnUrl({ url: a.webhook.url, OutboundFormatData: newOutboundFormatData, inboundFormatData: newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });
								const methodType = await formulaGetValue(companyCode, a.webhook.method || "POST", a.webhook.method || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
								if (urlString?.trim()) await webhook_call({ upUrl: urlString.trim(), methodType, triggerWhen: a.triggerWhen, webhook: a.webhook, result, actionHeaders: hdrs, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }).catch(err => console.error("Background webhook error:", err.message));
								return;
							}
							// Email
							let emailSubject = a.email.subject || '';
							emailSubject = replacePlaceholders(emailSubject, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
							emailSubject = await formulaGetValue(companyCode, emailSubject, emailSubject, "", newOutboundFormatData, newInboundFormatData, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

							let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
							let endpointURL = outbound_api_url;
							await emailSend({ triggerWhen: a.triggerWhen, email: a.email, emailSubject, result, enableLogs, itemLog: outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail: mappingOutboundSettingData.disabledOutboundEmailFailuresNotice, body: inboundPostData, transformedBody: inboundMappingData, responseBody: body, transformedResponseBody: pickContent, entrypointURL, endpointURL }).catch(err => console.error("Background email error:", err.message));
						};

						const filterKey = "After-Transformed-Response";
						const todo = actions.filter(x => x.triggerWhen === filterKey && x.status && (x.actionType === "Webhook" || x.actionType === "Email"));
						if (todo.length) await Promise.allSettled(todo.map(a => runAction(a)));
					}

					if (outboundSettingData.disabledOutboundResponseFailuresNotice === "off") {
						await handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl, outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode: companyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus: response?.statusCode, type: "DDEP API" });
					}

					const contentType = response?.headers["content-type"];
					const types = contentType.split(";");
					const type = types[0].split("/");

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound End", description: "End Outbound", request_id });

					const disableOutboundEmail = outboundSettingData?.specifyHeaders?.disableOutboundEmail || false;

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

							if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {
								const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody: resTransformedBody });
								const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 1, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, outboundResponseData, {}, "200 - OK", schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
							}

							resolve(responseBody);
						} else {
							if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {
								const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody: resTransformedBody });
								const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 1, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, outboundResponseData, {}, response?.statusCode + " " + response?.statusMessage, schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
							}

							resolve({
								code: "0",
								contentType: "application/json",
								statusCode: response.statusCode,
								data: outboundResponseData,
								inboundFormatData: newInboundFormatData,
								OutboundFormatData: newOutboundFormatData,
								resBody: responseData,
								logQueueMsg: "Success",
								logType: inboundEnableLog,
								httpStatus: response?.statusCode + " " + response?.statusMessage,
								error: false
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

							let result = 0;
							if (response.statusCode >= 200 && response.statusCode <= 303) {
								result = 1;
							}

							if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {
								const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody: resTransformedBody });
								const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, result, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, outboundResponseData, {}, response?.statusCode + " " + response?.statusMessage, schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
							}

							resolve(responseBody);
						} else {
							let result = 0;
							if (response.statusCode >= 200 && response.statusCode <= 303) {
								result = 1;
							}

							if (enabledebug.toLowerCase() !== "true" && (outboundSettingData?.enableEmail == "on") && !disableOutboundEmail) {
								const mailSubject = await generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: body, resTransformedBody });
								const specificEmail = outboundSettingData?.specifyHeaders?.notificationEmail || '';
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, result, mailSubject, disableOutboundEmail, specificEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, outboundResponseData, {}, response?.statusCode + " " + response?.statusMessage, schedulerUniqueId, querystring, header, mappingOutboundSettingData.disabledOutboundEmailFailuresNotice);
							}

							resolve({
								code: "0",
								contentType: resContentType,
								statusCode: response.statusCode,
								data: outboundResponseData,
								inboundFormatData: newInboundFormatData,
								OutboundFormatData: newOutboundFormatData,
								resBody: responseData,
								logQueueMsg: "Success",
								logType: inboundEnableLog,
								httpStatus: response?.statusCode + " " + response?.statusMessage,
								error: false
							});
						}
					}
				}

			} catch (err) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while outbound post data.", request_id });

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Data", description: "catch " + err + " - Some error occurred while outbound post data.", request_id, httpStatus: 500 });

				resolve({
					code: "1",
					MsgCode: "500014",
					MsgType: "Exception-Error",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: "catch " + err + " - Some error occurred while outbound post data.",
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					data: [],
					inboundFormatData: beforeResponseInboundFormatData,
					OutboundFormatData: beforeResponseOutboundFormatData,
					resBody: body,
					logQueueMsg: "Fail",
					logType: inboundEnableLog,
					httpStatus: 500,
					error: true
				});
			}
		}
	});
}

async function sendResponseToReturnUrl(request_method, url, data, enableLogs, itemLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id) {
	try {
		const returnUrlOptions = {
			method: request_method,
			headers: { "Content-Type": "application/json" },
			url: url,
			data: data,
			maxBodyLength: Infinity,   // allow big request body
			maxContentLength: Infinity // allow big response body
		};

		let reqOptions = JSON.stringify({ ...returnUrlOptions, data: safeJSONStringify(returnUrlOptions.data, config.dataSize) })

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url Posting", description: "Return Url Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? reqOptions : "", request_id });

		const response = await axios(returnUrlOptions);

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url", description: "Get Return Url Response", datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? JSON.stringify(response.data) : "", httpStatus: response?.status + " " + response?.statusText, request_id });

		return { code: "0", response: response.data, logQueueMsg: "Success", logType: itemLog, httpStatus: response?.status + " " + response?.statusText };
	} catch (error) {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Return Url", description: `${error.message} - Some error occurred while sending response to returnUrl.`, httpStatus: 500, request_id });

		return {
			code: "1",
			MsgCode: "500009",
			MsgType: "Invalid-Source",
			MsgLang: "en",
			ShortMsg: "Fail",
			LongMsg: `${error.message} - Some error occurred while sending response to returnUrl.`,
			InternalMsg: "",
			EnableAlert: "No",
			DisplayMsgBy: "LongMsg",
			Data: [],
			logQueueMsg: "Fail",
			logType: itemLog,
			httpStatus: 500
		}
	}
}

async function runAlertConditionsInBackground(params) {
	const { item_id, companyCode } = params;

	try {
		const alertConditions = await listAlertConditionsByItem(item_id, companyCode);
		if (!alertConditions || alertConditions.status !== 1 || !Array.isArray(alertConditions.data)) return;

		for (const alertCondition of alertConditions.data) {
			if (!alertCondition?.isActive) continue;

			for (const monitorRule of alertCondition.moniterRules || []) {
				if (monitorRule.itemType?.toString() !== item_id.toString()) continue;
				if (!monitorRule.notify?.length) continue;
				await processSingleMonitorRule({ ...params, monitorRule, alertCondition });
			}
		}
	} catch (err) {
		console.error("Alert background job failed:", err);
	}
}

async function processSingleMonitorRule(ctx) {
	const { alertCondition, monitorRule, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item, inboundPostData, inboundMappingData, resBodyData, pickContent, endpointMeta, request_id, enableAlertDebug } = ctx;

	const baseLogData = { companyCode, log_unique_id: schedulerUniqueId, log_request_id: request_id, trigger_by: "Item", securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

	try {
		const vars = await processVariablesAndHeaders(companyCode, monitorRule.variables, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);

		const context = await buildWebhookContext(querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, resBodyData, pickContent, newOutboundFormatData, newInboundFormatData, vars, endpointMeta);

		let checkCondition = await evaluateAlertCondition(companyCode, monitorRule.rules, context, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);

		console.log(JSON.stringify(checkCondition, null, 2), "checkCondition.report");
		const sqlQuery = buildSQLQuery(checkCondition.report);
		const sqlResult = buildSQLResult(checkCondition.report);


		// -------------------- Notify Loop (Always runs) --------------------
		for (const notify of monitorRule.notify) {
			if (notify.status) {
				const notify_unique_id = uuidv4(); // unique per notify

				const notifyBaseLogData = {
					...baseLogData,
					unique_id: notify_unique_id,
					notifyMethod: notify.type,
					isMatched: !!checkCondition?.matched
				};

				try {
					// Log start of evaluation per notify
					addToLogAlertQueue({
						...notifyBaseLogData,
						action: "Start Alert",
						description: `Evaluating alert condition for rule: ${monitorRule.name}`
					});

					// Log SQL query and result
					addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Query", description: sqlQuery });
					addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Query Result", description: sqlResult });

					if (checkCondition?.matched) {
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Matched", description: sqlQuery, datas: JSON.stringify(checkCondition) });
					} else {
						const startTime = Date.now();
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Monitor Rules Not Matched", description: sqlQuery, datas: JSON.stringify(checkCondition) });
						const endTime = Date.now();
						const timeConsumedMs = endTime - startTime;
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
						addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
						continue;
					}

					// -------------------- Execute Notify --------------------
					if (notify.type === "Webhook") {
						const startTime = Date.now();
						await handleWebhookNotify(notify, { ...ctx, unique_id: notify_unique_id }, vars);
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Webhook", description: "Webhook End" });
						const endTime = Date.now();
						const timeConsumedMs = endTime - startTime;
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
						addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });

					} else if (notify.type === "Email") {
						const startTime = Date.now();
						await handleEmailNotify(notify, { ...ctx, unique_id: notify_unique_id }, vars);
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Email", description: "Email End" });
						const endTime = Date.now();
						const timeConsumedMs = endTime - startTime;
						addToLogAlertQueue({ ...notifyBaseLogData, action: "Time Consumed", description: timeConsumedMs });
						addToLogAlertQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
					}
				} catch (error) {
					addToLogAlertQueue({ ...notifyBaseLogData, action: "Notify Error", description: "catch " + error + " - Some error occurred while process notify execution data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process notify execution data.", httpStatus: 500 });
				}
			}
		}
	} catch (error) {
		addToLogAlertQueue({ ...baseLogData, action: "Monitor Rule Error", description: "catch " + error + " - Some error occurred while process monitor rule data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process monitor rule data.", httpStatus: 500 });
	}
}

function getSQLOperator(operation) {
	switch (operation) {
		case "Contains": return "LIKE";
		case "Not Contains": return "NOT LIKE";
		case "=":
		case "==": return "=";
		case "<=":
		case ">=":
		case "<":
		case ">": return operation;
		case "IN": return "IN";
		case "Regex": return "REGEXP";
		default: return operation;
	}
}

function buildSQLQuery(node) {
	// Leaf rule
	if (node.type === "rule") {
		const sqlOp = getSQLOperator(node.operation);

		if (node.operation === "Contains" || node.operation === "Not Contains") {
			return `${node.monitor} ${sqlOp} '%${node.expectedRaw}%'`;
		}

		return `${node.monitor} ${sqlOp} '${node.expectedRaw}'`;
	}

	// Group rule (AND / OR)
	if (node.rules?.length) {
		const inner = node.rules
			.map(r => buildSQLQuery(r))
			.join(` ${node.condition} `);

		return `(${inner})`;
	}

	return "";
}

function buildSQLResult(node) {
	// Leaf rule
	if (node.type === "rule") {
		const op = node.operation.toLowerCase();

		const actual = node.actualValue;
		const expected = node.expectedResolved;

		return `${actual} ${op} ${expected}`;
	}

	// Group rule
	if (node.rules?.length) {
		const inner = node.rules
			.map(r => buildSQLResult(r))
			.join(` ${node.condition} `);

		return `(${inner})`;
	}

	return "";
}

async function handleWebhookNotify(notify, ctx, vars) {
	const { companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item, inboundPostData, outboundMappedData, resBodyData, pickContent, endpointMeta, request_id, unique_id, alertCondition, monitorRule, enableAlertDebug } = ctx;

	const baseLogData = { companyCode, unique_id, log_unique_id: schedulerUniqueId, log_request_id: request_id, trigger_by: "Item", securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

	try {
		addToLogAlertQueue({ ...baseLogData, action: "Webhook", description: "Webhook Start", notifyMethod: "Webhook" });

		const headers = await processVariablesAndHeaders(companyCode, notify.webhook?.headers, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item);

		const payload = await processWebhookContent(notify.webhook.content || notify.webhook, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, outboundMappedData, resBodyData, pickContent, vars, endpointMeta);

		const url = await buildFinalReturnUrl({ url: notify.webhook.url, OutboundFormatData: newOutboundFormatData, inboundFormatData: newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, companyCode, inboundEnableLog: outboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });

		if (!url?.trim()) {
			return { success: false, error: "Webhook URL empty" };
		}

		addToLogAlertQueue({ ...baseLogData, action: "Webhook", description: "Webhook EndPoint URL", datas: url.trim(), notifyMethod: "Webhook" });

		const methodType = await formulaGetValue(companyCode, notify.webhook.method || "POST", notify.webhook.method || "POST", "", {}, {}, "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);

		ctx = { ...ctx, trigger_by: "Item" }

		return await webhook_call_alert({
			upUrl: url.trim(),
			methodType,
			webhook: notify.webhook,
			result: payload,
			actionHeaders: headers,
			ctx
		});

	} catch (error) {
		addToLogAlertQueue({ ...baseLogData, action: "Webhook Notify Error", description: "catch " + error + " - Some error occurred while process webhook notify data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process webhook notify data.", notifyMethod: "Webhook", httpStatus: 500 });
	}
}

async function handleEmailNotify(notify, ctx, vars) {
	const { companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item, inboundPostData, outboundMappedData, resBodyData, pickContent, endpointMeta, request_id, unique_id, alertCondition, monitorRule, enableAlertDebug } = ctx;

	const baseLogData = { companyCode, unique_id, log_unique_id: schedulerUniqueId, log_request_id: request_id, trigger_by: "Item", securityLevel: monitorRule.securityLevel, ruleName: monitorRule.name, policyId: alertCondition.policyId, conditionId: alertCondition._id, policyName: alertCondition.alertPolicy?.name || "", conditionName: alertCondition.name, enableAlertDebug };

	try {
		addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Start", notifyMethod: "Email" });

		const payload = await processWebhookContent(notify.email.content || notify.email, companyCode, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, outboundMappedData, resBodyData, pickContent, vars, endpointMeta);

		let subject = notify.email.subject || "";

		subject = replacePlaceholders(subject, newOutboundFormatData, newInboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

		subject = await formulaGetValue(companyCode, subject, subject, "", newOutboundFormatData, newInboundFormatData, "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);

		addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Subject", datas: subject, notifyMethod: "Email" });
		addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email To", datas: notify.email.to, notifyMethod: "Email" });
		addToLogAlertQueue({ ...baseLogData, action: "Email", description: "Email Body", datas: typeof payload === "object" ? JSON.stringify(payload) : payload, notifyMethod: "Email" });

		ctx = { ...ctx, trigger_by: "Item" }

		return await emailSend_alert({
			email: notify.email,
			emailSubject: subject,
			result: payload,
			ctx
		});
	} catch (error) {
		addToLogAlertQueue({ ...baseLogData, action: "Email Notify Error", description: "catch " + error + " - Some error occurred while process email notify data.", exception_type: "System Error", detail_exception: "catch " + error + " - Some error occurred while process email notify data.", notifyMethod: "Email", httpStatus: 500 });
	}
}

function findValueByPath(keyPath, data) {
	let keys;

	const match = keyPath.match(/@(?:In|Out)\{(.+?)\}/);
	keys = match ? match[1].split('.') : keyPath.split('.');

	let value = data;

	// Traverse the path
	for (const key of keys) {
		if (Array.isArray(value)) {
			value = value[value.length - 1];
		}

		if (value && typeof value === 'object' && key in value) {
			value = value[key];
		} else {
			return null;
		}
	}

	return value;
}

function getValueForGlobal(formula, querystring, header, global) {
	// Step 1: Handle @querystring{keyword} formula
	const queryStringMatch = formula.match(/@querystring{([^}]+)}/);
	if (queryStringMatch) {
		const keyword = queryStringMatch[1];
		if (querystring[keyword]) {
			return querystring[keyword];
		} else {
			console.error(`Query string keyword "${keyword}" not found`);
			return null;
		}
	}

	// Step 2: Handle @header{keyword} formula
	const headerMatch = formula.match(/@header{([^}]+)}/);
	if (headerMatch) {
		const keyword = headerMatch[1];
		if (header[keyword]) {
			return header[keyword]; // Return the value from headers
		}
	}

	// Step 3: Handle @global{keyword} formula
	const globalMatch = formula.match(/@global{([^}]+)}/);
	if (globalMatch) {
		const keyword = globalMatch[1];
		global = Object.assign({}, ...global);
		if (global[keyword]) {
			return global[keyword]; // Return the value from global
		}
	}

	// Step 4: Handle @reqIn, @reqOut, @resIn, @resOut formulas with dynamic index and property
	const dataArray = { reqIn, reqOut, resIn, resOut };
	const arrayNames = ['reqIn', 'reqOut', 'resIn', 'resOut'];
	let arrayName = null;

	// Loop through array names to find the one in the formula
	for (let name of arrayNames) {
		if (formula.includes(`@${name}`)) {
			arrayName = name;
			break;
		}
	}

	if (arrayName) {
		const indexStart = formula.indexOf('[') + 1;
		const indexEnd = formula.indexOf(']');
		const index = parseInt(formula.slice(indexStart, indexEnd), 10); // Extract the index

		const propertyStart = formula.indexOf('{') + 1;
		const propertyEnd = formula.indexOf('}');
		const property = formula.slice(propertyStart, propertyEnd); // Extract the property

		if (dataArray[arrayName] && Array.isArray(dataArray[arrayName]) && dataArray[arrayName][index]) {
			const dataArrayValue = dataArray[arrayName][index];

			if (dataArrayValue) {
				let value = findValueByPath(property, dataArrayValue);
				return value;
			}
		}
	}

	return formula;
}

module.exports = { _ddep_api_function };