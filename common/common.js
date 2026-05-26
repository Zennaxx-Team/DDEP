const Config = require("../config");
const { HyperFormula } = require("hyperformula");
const moment = require("moment");
const xml2js = require("xml2js");
const parseString = require("xml2js").parseString;
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const config = require("../config");
const { default: axios } = require("axios");
const { MyCustomPlugin, MyCustomPluginTranslations } = require("../my_modules/MyCustomPlugin");
const { findProject } = require("../controllers/projects.controller");
const { findAllLogFullListForLogHistory, convertIfJSON, excuteResponseReturnUrl } = require("../controllers/log_history.controller");
const { createInboundLogHistory } = require("../controllers/inbound_history.controller");
const { getGeneralSetting } = require("../controllers/settings.controller");
const { getNotificationSettings } = require("../controllers/notification.controller");
const { createOutboundLogHistory } = require("../controllers/outbound_history.controller");
const { mailQueue, logQueueCon, mailActionQueue, mailAlertQueue, logAlertQueueCon, logDiffQueueCon } = require('../queues/config/queuesConfigartion');
const mailQueueConfig = require('../queues/config/email.config');
const logQueueConfig = require('../queues/config/log.config');
const { safeJSONStringify, safeJSONWithOutStringify } = require("../my_modules/checkSize");
const jsesc = require('jsesc');
const { diffCheckerReturnUrl, diff_entry_create } = require("../controllers/diff_history.controller");
const { lineByLineDiff } = require("../my_modules/utils/lineDiff");

HyperFormula.registerFunctionPlugin(MyCustomPlugin, MyCustomPluginTranslations);
const HyperFormulaOptions = { licenseKey: "gpl-v3" };

function addToLogQueue(logData) {
	if (!logData.createdAt) logData.createdAt = new Date();
	logData.updatedAt = new Date();
	let uuid = uuidv4();

	logQueueCon.add(logQueueConfig.name_save, logData, {
		jobId: uuid, delay: 0, removeOnComplete: 10, removeOnFail: 10, attempts: 3, backoff: { type: 'exponential', delay: 1000 }
	});
}

function addToLogAlertQueue(logData) {
	if (!logData.createdAt) logData.createdAt = new Date();
	logData.updatedAt = new Date();
	let uuid = uuidv4();

	logAlertQueueCon.add(logQueueConfig.name_alert_save, logData, {
		jobId: uuid, delay: 0, removeOnComplete: 10, removeOnFail: 10, attempts: 3, backoff: { type: 'exponential', delay: 1000 }
	});
}

function addToLogDiffQueue(logData) {
	if (!logData.createdAt) logData.createdAt = new Date();
	logData.updatedAt = new Date();
	let uuid = uuidv4();

	logDiffQueueCon.add(logQueueConfig.name_diff_save, logData, {
		jobId: uuid, delay: 0, removeOnComplete: 10, removeOnFail: 10, attempts: 3, backoff: { type: 'exponential', delay: 1000 }
	});
}

// For Inbound Filtering Use
function inboundFilterHandler(enableLogs, inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, reqBody, inboundPostData, inboundPostDataUnkeyArr, inboundFilterData, item, inboundFilterEnableLog, bodyreq, outboundMappedData, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type, logdir, logdatefilename) {
	return new Promise(async (resolve) => {
		try {

			if (type == "Scheduler") {
				const todaydate = new Date();
				var prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
			}

			let parsedData = safeJSONStringify(reqBody, config.dataSize);

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound User Posting", description: "User Posting Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? parsedData : "", request_id });

			if (Array.isArray(inboundPostData)) {
				const arrData = inboundPostData;
				inboundPostData = {};
				inboundPostData["items"] = arrData;
				inboundPostDataUnkeyArr = true;
			}

			if (type == "Scheduler") {
				let prelogtest = prelog.replace("keywords", "not defined");
				await writelog(logdir + logdatefilename, prelogtest + "User Posting Data:" + " > " + JSON.stringify(reqBody) + "\n");
			}

			if (inboundFilterData != undefined && inboundFilterData.is_active != undefined && inboundFilterData.is_active == "Active" && inboundFilterData.inbound_filter.length > 0) {
				const inboundFilters = inboundFilterData.inbound_filter;
				let query = {};

				for (let i = 0; i < inboundFilters.length; i++) {
					const inboundFilter = inboundFilters[i];
					let logical = inboundFilter.logical;
					let original = inboundFilter.original;
					let operations = inboundFilter.operations;
					let column = inboundFilter.column;
					original = original.replace("@In{", "").replace(/}$/, "");

					if (original != "") {
						let data = {};
						data["operations"] = operations;
						data["column"] = column;
						data["logical"] = logical;
						query[original] = data;
					}
				}

				if (Object.entries(query).length > 0) {
					inboundPostData = await datafilters(inboundPostData, query, item, inboundFilterEnableLog, "@In{", schedulerUniqueId, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type);

					let parsedData = safeJSONStringify(inboundPostData, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Filter Data", description: "Filter Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? parsedData : "", request_id });

					if (type == "Scheduler") {
						let prelogtest = prelog.replace("keywords", "not defined");
						await writelog(logdir + logdatefilename, prelogtest + "Inbound Filter Data:" + " > " + JSON.stringify(inboundPostData) + "\n");
					}

					if (bodyreq != "" && outboundMappedData.length != 0) {
						bodyreq = inboundPostData;
					}

					if (outboundMappedData.length != 0) {
						reqBody = inboundPostData;
					}
				}
			}

			resolve({
				code: "0",
				inboundPostDataUnkeyArr,
				inboundPostData,
				bodyreq,
				reqBody
			});

		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Filter", description: "catch " + err + " - Some error occurred while run inbound filter function.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while run inbound filter function.", request_id });

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Filter", description: "catch " + err + " - Some error occurred while run inbound filter function.", request_id });

			resolve({
				code: "1",
				MsgCode: "500007",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "catch " + err + " - Some error occurred while run inbound filter function.",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				err: err,
				Data: [],
				logQueueMsg: "Filter Fail",
				logType: inboundEnableLog,
				httpStatus: 500
			})
		}
	})
}

// For Outbound Filtering Use
function outboundFilterHandler(outboundResponseData, outboundResponseDataUnkeyArr, outboundFilterData, item, enableLogs, outboundEnableLog, inboundFilterEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, ItemName, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type, logdir, logdatefilename) {
	return new Promise(async (resolve) => {
		try {

			if (type == "Scheduler") {
				const todaydate = new Date();
				const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > ";
				var prelogtest = prelog.replace("keywords", "not defined");
			}

			if (Array.isArray(outboundResponseData)) {
				const arrData = outboundResponseData;
				outboundResponseData = {};
				outboundResponseData["items"] = arrData;
				outboundResponseDataUnkeyArr = true;
			}

			if (outboundFilterData != undefined && outboundFilterData.is_active != undefined && outboundFilterData.is_active == "Active" && outboundFilterData.outbound_filter.length > 0) {

				const outboundFilters = outboundFilterData.outbound_filter;
				let query = {};

				for (let i = 0; i < outboundFilters.length; i++) {
					const outboundFilter = outboundFilters[i];
					let logical = outboundFilter.logical;
					let original = outboundFilter.original;
					let operations = outboundFilter.operations;
					let column = outboundFilter.column;
					original = original.replace("@Out{", "").replace(/}$/, "");
					original = original.replace("@In{", "").replace(/}$/, "");

					if (original != "") {
						let data = {};
						data["operations"] = operations;
						data["column"] = column;
						data["logical"] = logical;
						query[original] = data;
					}
				}

				if (Object.entries(query).length > 0) {
					outboundResponseData = await datafilters(outboundResponseData, query, item, inboundFilterEnableLog, "@Out{", schedulerUniqueId, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type);

					let parsedData = safeJSONStringify(outboundResponseData, config.dataSize);

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Filter Data", description: "Filter Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", request_id });

					if (type == "Scheduler") {
						await writelog(logdir + logdatefilename, prelogtest + "Outbound Filter Data:" + " > " + JSON.stringify(outboundResponseData) + "\n");
					}
				}
			}

			resolve({
				code: "0",
				outboundResponseData,
				outboundResponseDataUnkeyArr
			})
		} catch (err) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Error", description: "catch " + err + " - Some error occurred while run outbound filter function.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while run outbound filter function." });

			resolve({
				code: "1",
				MsgCode: "500007",
				MsgType: "Exception-Error",
				MsgLang: "en",
				ShortMsg: "Fail",
				LongMsg: "catch " + err + " - Some error occurred while run outbound filter function.",
				logMsg: "Outbound Filter Error : ",
				InternalMsg: "",
				EnableAlert: "No",
				DisplayMsgBy: "LongMsg",
				Data: [],
				logQueueMsg: "Filter Fail",
				logType: outboundEnableLog,
				httpStatus: 500
			});
		}
	})
}

// For Filtering Use
async function datafilters(reqBody, query, item, FilterEnableLog, includesKey, schedulerUniqueId, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type) {
	let filterData = {};
	const reqBodyJson = reqBody;
	filterParentKey = [];
	filterTrueDataKeys = [];
	filterFalseDataKeys = [];

	let filterTrueDataKeysArr = [];
	let filterLogicalsArr = [];
	for (const [queryKey, queryValue] of Object.entries(query)) {
		const { operations, column, logical } = queryValue;
		filterLogicalsArr.push(logical);

		let singleQuery = {};
		singleQuery[queryKey] = queryValue;

		filterTrueDataKeys = [];
		const returnValue = await datafilterkeys(reqBody, singleQuery, item, FilterEnableLog, includesKey, schedulerUniqueId, reqBodyJson, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type);
		filterTrueDataKeysArr.push(filterTrueDataKeys);
	};

	if (filterTrueDataKeysArr.length > 1) {
		filterTrueDataKeys = [];
		for (let i = 0; i < (filterTrueDataKeysArr.length - 1); i++) {
			const filterDataKeys = filterTrueDataKeysArr[i];
			const filterDataKeysPlue1 = filterTrueDataKeysArr[i + 1];
			const logicalPlue1 = filterLogicalsArr[i + 1];

			for (let l = 0; l < filterDataKeys.length; l++) {
				for (let k = 0; k < filterDataKeysPlue1.length; k++) {
					if (filterDataKeys[l] != filterDataKeysPlue1[k]) {
						const kString = filterDataKeysPlue1[k] + ".";
						const lString = filterDataKeys[l] + ".";
						const kIncludesL = filterDataKeys[l].includes(kString);
						const lIncludesK = filterDataKeysPlue1[k].includes(lString);

						if ((kIncludesL || lIncludesK) && logicalPlue1 == "AND") {
							filterTrueDataKeys.push(filterDataKeys[l]);
						} else if (logicalPlue1 == "OR") {
							filterTrueDataKeys.push(filterDataKeys[l]);
							filterTrueDataKeys.push(filterDataKeysPlue1[k]);
						}
					} else {
						filterTrueDataKeys.push(filterDataKeys[l]);
					}
				}
			}
		}
	} else {
		filterTrueDataKeys = filterTrueDataKeysArr[0];
	}

	filterTrueDataKeys = filterTrueDataKeys.filter((v, i, a) => a.indexOf(v) === i);

	filterFalseDataKeys = filterFalseDataKeys.filter((v, i, a) => a.indexOf(v) === i);

	let zeroArr = firstArr = secondArr = thirdArr = forthArr = fifthArr = sixArr = sevenArr = eightArr = nineArr = tenArr = [];
	let newfilterTrueDataKeys = [];
	let newfilterFalseDataKeysIn = {};

	for (let i = 0; i < filterTrueDataKeys.length; i++) {
		const keysArrLengthI = newfilterTrueDataKeys.length;
		if (keysArrLengthI > 0) {
			let iIncludes = true;
			for (let j = 0; j < keysArrLengthI; j++) {
				if (filterTrueDataKeys[i] != newfilterTrueDataKeys[j]) {
					const jString = newfilterTrueDataKeys[j] + ".";
					const iString = filterTrueDataKeys[i] + ".";
					const jIncludesI = filterTrueDataKeys[i].includes(jString);
					const iIncludesJ = newfilterTrueDataKeys[j].includes(iString);

					if (jIncludesI || iIncludesJ) {
						iIncludes = false;
					}
				} else {
					iIncludes = false;
				}
			}

			for (let l = 0; l < filterFalseDataKeys.length; l++) {
				if (filterTrueDataKeys[i] != filterFalseDataKeys[l]) {
					const iString = filterTrueDataKeys[i] + ".";
					const iIncludesL = filterFalseDataKeys[l].includes(iString);

					if (iIncludesL) {
						let arrs = [];
						if (newfilterFalseDataKeysIn[filterTrueDataKeys[i]] != undefined) {
							arrs = newfilterFalseDataKeysIn[filterTrueDataKeys[i]];
						}

						arrs.push(filterFalseDataKeys[l]);
						newfilterFalseDataKeysIn[filterTrueDataKeys[i]] = arrs;
					}
				}
			}

			if (iIncludes) {
				newfilterTrueDataKeys.push(filterTrueDataKeys[i]);
			}
		} else {
			newfilterTrueDataKeys.push(filterTrueDataKeys[i]);
		}
	}

	let finalData = reqBody;

	for (let i = 0; i < newfilterTrueDataKeys.length; i++) {
		const keysArr = newfilterTrueDataKeys[i].split(".");
		const keysArrLength = keysArr.length;

		if (keysArrLength > 0) {
			let zeroObj = firstObj = secondObj = thirdObj = forthObj = fifthObj = sixObj = sevenObj = eightObj = nineObj = tenObj = {};

			if (keysArrLength == 1 && keysArr[0] == keysArr[keysArrLength - 1]) {
				filterData = reqBody;
			}

			if (keysArrLength == 2) {
				firstObj = {};
				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = reqBody[keysArr[0]][keysArr[1]];
					} else {
						firstObj = reqBody[keysArr[0]][keysArr[1]];
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					if (Object.entries(firstArr).length == 0) {
						firstArr["" + keysArr[0] + ""] = reqBody[keysArr[0]];
					} else if (firstArr["" + keysArr[0] + ""] == undefined) {
						firstArr["" + keysArr[0] + ""] = reqBody[keysArr[0]];
					}

					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = firstArr["" + keysArr[0] + ""][keysArr[1]];
					} else {
						firstObj = firstArr["" + keysArr[0] + ""][keysArr[1]];
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					zeroObj = {};
					if (isNaN(keysArr[0])) {
						zeroObj[keysArr[0]] = firstObj;
					} else {
						let theObj = reqBody[keysArr[0]];
						theObj[keysArr[1]] = firstObj[keysArr[1]];
						zeroObj = theObj;
					}

					filterData = zeroObj;
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]].length > 0) {
						arrs = filterData[keysArr[0]];
					}

					arrs.push(firstObj);

					if (reqBody[keysArr[0]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]];
						for (let k = 0; k < reqBody[keysArr[0]].length; k++) {
							if (keysArr[1] != k) {
								const arrSameKeys = keysArr[0] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[0])) {
						filterData[keysArr[0]] = arrs;
					} else {
						filterData = arrs;
					}
				}
			}

			if (keysArrLength == 3) {
				secondObj = {};
				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
					} else {
						secondObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					if (Object.entries(secondArr).length == 0) {
						secondArr["" + keysArr[0] + "." + keysArr[1] + ""] = reqBody[keysArr[0]][keysArr[1]];
					} else if (secondArr["" + keysArr[0] + "." + keysArr[1] + ""] == undefined) {
						secondArr["" + keysArr[0] + "." + keysArr[1] + ""] = reqBody[keysArr[0]][keysArr[1]];
					}

					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = secondArr["" + keysArr[0] + "." + keysArr[1] + ""][keysArr[2]];
					} else {
						secondObj = secondArr["" + keysArr[0] + "." + keysArr[1] + ""][keysArr[2]];
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = secondObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]];
						theObj[keysArr[2]] = secondObj[keysArr[2]];
						firstObj = theObj;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]];
					}

					arrs.push(secondObj);

					if (reqBody[keysArr[0]][keysArr[1]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]].length; k++) {
							if (keysArr[2] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = arrs;
					} else {
						firstObj = arrs;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					zeroObj = {};
					if (isNaN(keysArr[0])) {
						zeroObj[keysArr[0]] = firstObj;
					} else {
						let theObj = reqBody[keysArr[0]];
						theObj[keysArr[1]] = firstObj[keysArr[1]];
						zeroObj = theObj;
					}

					filterData = zeroObj;
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]].length > 0) {
						arrs = filterData[keysArr[0]];
					}

					arrs.push(firstObj);

					if (reqBody[keysArr[0]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]];
						for (let k = 0; k < reqBody[keysArr[0]].length; k++) {
							if (keysArr[1] != k) {
								const arrSameKeys = keysArr[0] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[0])) {
						filterData[keysArr[0]] = arrs;
					} else {
						filterData = arrs;
					}
				}
			}

			if (keysArrLength == 4) {
				thirdObj = {};
				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					} else {
						thirdObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					if (Object.entries(thirdArr).length == 0) {
						thirdArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
					} else if (thirdArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + ""] == undefined) {
						thirdArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
					}

					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = thirdArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + ""][keysArr[3]];
					} else {
						thirdObj = thirdArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + ""][keysArr[3]];
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = thirdObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						theObj[keysArr[3]] = thirdObj[keysArr[3]];
						secondObj = theObj;
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]][keysArr[2]];
					}

					arrs.push(thirdObj);

					if (reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length; k++) {
							if (keysArr[3] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = arrs;
					} else {
						secondObj = arrs;
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = secondObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]];
						theObj[keysArr[2]] = secondObj[keysArr[2]];
						firstObj = theObj;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]];
					}

					arrs.push(secondObj);

					if (reqBody[keysArr[0]][keysArr[1]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]].length; k++) {
							if (keysArr[2] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = arrs;
					} else {
						firstObj = arrs;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					zeroObj = {};
					if (isNaN(keysArr[0])) {
						zeroObj[keysArr[0]] = firstObj;
					} else {
						let theObj = reqBody[keysArr[0]];
						theObj[keysArr[1]] = firstObj[keysArr[1]];
						zeroObj = theObj;
					}

					filterData = zeroObj;
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]].length > 0) {
						arrs = filterData[keysArr[0]];
					}

					arrs.push(firstObj);

					if (reqBody[keysArr[0]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]];
						for (let k = 0; k < reqBody[keysArr[0]].length; k++) {
							if (keysArr[1] != k) {
								const arrSameKeys = keysArr[0] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[0])) {
						filterData[keysArr[0]] = arrs;
					} else {
						filterData = arrs;
					}
				}
			}

			if (keysArrLength == 5) {
				forthObj = {};
				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					if (isNaN(keysArr[4])) {
						forthObj[keysArr[4]] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					} else {
						forthObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					if (Object.entries(forthArr).length == 0) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					} else if (forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] == undefined) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					}

					if (isNaN(keysArr[3])) {
						forthObj[keysArr[3]] = forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""][keysArr[4]];
					} else {
						forthObj = forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""][keysArr[4]];
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					thirdObj = {};
					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = forthObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]][keysArr[3]];
						theObj[keysArr[4]] = forthObj[keysArr[4]];
						thirdObj = theObj;
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					thirdObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					}

					arrs.push(forthObj);

					if (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length; k++) {
							if (keysArr[4] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = arrs;
					} else {
						thirdObj = forthObj;
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = thirdObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						theObj[keysArr[3]] = thirdObj[keysArr[3]];
						secondObj = theObj;
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]][keysArr[2]];
					}

					arrs.push(thirdObj);

					if (reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length; k++) {
							if (keysArr[3] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = arrs;
					} else {
						secondObj = arrs;
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = secondObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]];
						theObj[keysArr[2]] = secondObj[keysArr[2]];
						firstObj = theObj;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]];
					}

					arrs.push(secondObj);

					if (reqBody[keysArr[0]][keysArr[1]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]].length; k++) {
							if (keysArr[2] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = arrs;
					} else {
						firstObj = arrs;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					zeroObj = {};
					if (isNaN(keysArr[0])) {
						zeroObj[keysArr[0]] = firstObj;
					} else {
						let theObj = reqBody[keysArr[0]];
						theObj[keysArr[1]] = firstObj[keysArr[1]];
						zeroObj = theObj;
					}

					filterData = zeroObj;
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]].length > 0) {
						arrs = filterData[keysArr[0]];
					}

					arrs.push(firstObj);

					if (reqBody[keysArr[0]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]];
						for (let k = 0; k < reqBody[keysArr[0]].length; k++) {
							if (keysArr[1] != k) {
								const arrSameKeys = keysArr[0] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[0])) {
						filterData[keysArr[0]] = arrs;
					} else {
						filterData = arrs;
					}
				}
			}

			if (keysArrLength == 6) {
				fifthObj = {};
				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) == "object") {
					if (isNaN(keysArr[5])) {
						fifthObj[keysArr[5]] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]];
					} else {
						fifthObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]];
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) == "object") {
					if (Object.entries(fifthArr).length == 0) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + keysArr[4] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					} else if (forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + keysArr[4] + ""] == undefined) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + keysArr[4] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					}

					if (isNaN(keysArr[4])) {
						fifthObj[keysArr[4]] = forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + keysArr[4] + ""][keysArr[5]];
					} else {
						fifthObj = fifthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + keysArr[4] + ""][keysArr[5]];
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					forthObj = {};
					if (isNaN(keysArr[4])) {
						forthObj[keysArr[4]] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					} else {
						forthObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					forthObj = {};
					if (Object.entries(forthArr).length == 0) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					} else if (forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] == undefined) {
						forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""] = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					}

					if (isNaN(keysArr[3])) {
						forthObj[keysArr[3]] = forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""][keysArr[4]];
					} else {
						forthObj = forthArr["" + keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + ""][keysArr[4]];
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					thirdObj = {};
					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = forthObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]][keysArr[3]];
						theObj[keysArr[4]] = forthObj[keysArr[4]];
						thirdObj = theObj;
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					thirdObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					}

					arrs.push(forthObj);

					if (reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]].length; k++) {
							if (keysArr[4] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + keysArr[3] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[3])) {
						thirdObj[keysArr[3]] = arrs;
					} else {
						thirdObj = forthObj;
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = thirdObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						theObj[keysArr[3]] = thirdObj[keysArr[3]];
						secondObj = theObj;
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) && reqBody[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (reqBody[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					secondObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]] != undefined && filterData[keysArr[0]][keysArr[1]][keysArr[2]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]][keysArr[2]];
					}

					arrs.push(thirdObj);

					if (reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]][keysArr[2]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]][keysArr[2]].length; k++) {
							if (keysArr[3] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + keysArr[2] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[2])) {
						secondObj[keysArr[2]] = arrs;
					} else {
						secondObj = arrs;
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = secondObj;
					} else {
						let theObj = reqBody[keysArr[0]][keysArr[1]];
						theObj[keysArr[2]] = secondObj[keysArr[2]];
						firstObj = theObj;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (Array.isArray(reqBody[keysArr[0]][keysArr[1]]) && reqBody[keysArr[0]][keysArr[1]] != null && typeof (reqBody[keysArr[0]][keysArr[1]]) == "object") {
					firstObj = {};
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]][keysArr[1]] != undefined && filterData[keysArr[0]][keysArr[1]].length > 0) {
						arrs = filterData[keysArr[0]][keysArr[1]];
					}

					arrs.push(secondObj);

					if (reqBody[keysArr[0]][keysArr[1]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]][keysArr[1]];
						for (let k = 0; k < reqBody[keysArr[0]][keysArr[1]].length; k++) {
							if (keysArr[2] != k) {
								const arrSameKeys = keysArr[0] + "." + keysArr[1] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[1])) {
						firstObj[keysArr[1]] = arrs;
					} else {
						firstObj = arrs;
					}

					if (newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]]) {
						const dataArrKeys = newfilterFalseDataKeysIn[newfilterTrueDataKeys[i]];
						const mainKey = newfilterTrueDataKeys[i];
						firstObj = removeData(dataArrKeys, firstObj, mainKey);
					}
				}

				if (!Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					zeroObj = {};
					if (isNaN(keysArr[0])) {
						zeroObj[keysArr[0]] = firstObj;
					} else {
						let theObj = reqBody[keysArr[0]];
						theObj[keysArr[1]] = firstObj[keysArr[1]];
						zeroObj = theObj;
					}

					filterData = zeroObj;
				}

				if (Array.isArray(reqBody[keysArr[0]]) && reqBody[keysArr[0]] != null && typeof (reqBody[keysArr[0]]) == "object") {
					let arrs = [];
					if (filterData[keysArr[0]] != undefined && filterData[keysArr[0]].length > 0) {
						arrs = filterData[keysArr[0]];
					}

					arrs.push(firstObj);

					if (reqBody[keysArr[0]].length > 1) {
						const dataArrValue = reqBody[keysArr[0]];
						for (let k = 0; k < reqBody[keysArr[0]].length; k++) {
							if (keysArr[1] != k) {
								const arrSameKeys = keysArr[0] + "." + k;
								if (newfilterTrueDataKeys.includes(arrSameKeys)) {
									arrs.push(dataArrValue[k]);
									newfilterTrueDataKeys = newfilterTrueDataKeys.filter(e => e !== arrSameKeys);
								}
							}
						}
					}

					if (isNaN(keysArr[0])) {
						filterData[keysArr[0]] = arrs;
					} else {
						filterData = arrs;
					}
				}
			}
		}
	}

	updateMatchingKeys(finalData, filterData);

	if (filterTrueDataKeys.length == 0) {
		for (let i = filterFalseDataKeys.length - 1; i >= 0; i--) {
			const parts = filterFalseDataKeys[i].split('.');
			const lastKey = parts[parts.length - 1];
			const recordsUpdatedKey = parts.slice(0, -1).join('.');
			finalData = removeDynamicKey(finalData, recordsUpdatedKey);
		}
	}

	return finalData;
}

// For Filtering Use
async function datafilterkeys(data, query, item, FilterEnableLog, includesKey, schedulerUniqueId, reqBodyJson, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type) {
	let returnValue = false;
	const companyCode = item.CompanyCode;
	const item_id = item._id;
	let itemEnableLog = FilterEnableLog;
	let actionMsg = "Inbound Filter";

	if (includesKey == "@Out{") {
		itemEnableLog = FilterEnableLog;
		actionMsg = "Outbound Filter";
	}

	for (const [key, value] of Object.entries(data)) {

		let newKey = key;
		let filterTrueDataKey = key;
		let filterFirstTrueDataKey = "";
		let firstKey = "";
		if (filterParentKey.length != 0) {
			for (let i = 0; i < filterParentKey.length; i++) {
				if (filterParentKey[i] >= 0) {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + filterParentKey[i];
				}

				if (filterFirstTrueDataKey != "") {
					filterFirstTrueDataKey = filterFirstTrueDataKey + ".";
				}

				filterFirstTrueDataKey = filterFirstTrueDataKey + filterParentKey[i];
			}
		}

		if (firstKey != "") {
			if (key >= 0) {
				newKey = firstKey;
			} else {
				newKey = firstKey + "." + key;
			}
		}

		if (filterFirstTrueDataKey != "") {
			if (key >= 0) {
				filterTrueDataKey = filterFirstTrueDataKey;
			} else {
				filterTrueDataKey = filterFirstTrueDataKey + "." + key;
			}
		}

		if (!returnValue) {
			if (!Array.isArray(value) && value != null && typeof (value) != "object") {
				if (query[newKey] != undefined) {
					const startStr = newKey.replace(key, "");
					let andCondition = "", andContainsString = "", andContainsValue = "", orCondition = "", orContainsString = "", orContainsValue = "";
					let conditionsValue = "";

					for (const [queryKey, queryValue] of Object.entries(query)) {
						let { operations, column, logical } = queryValue;
						const queryStr = queryKey.replace(startStr, "");

						column = resolveColumnValue(column, reqBodyJson, querystring, header);
						column = await formulaGetValue(companyCode, column, column, queryKey, {}, {}, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod);

						column = typeof column === "string" ? column.replace(/['"]+/g, '') : column;

						if (operations == "<>") {
							operations = "!=";
						}

						if (logical == "AND" && operations != "Contains" && data[queryStr] != undefined) {
							if (andCondition != "") { andCondition += " && "; conditionsValue += " && "; }

							if (isNaN(data[queryStr])) {
								andCondition += `"` + data[queryStr] + `"`;
								conditionsValue += includesKey + queryKey + "}";
							} else {
								andCondition += data[queryStr];
								conditionsValue += includesKey + queryKey + "}";
							}

							andCondition += " " + operations + " ";
							conditionsValue += " " + operations + " ";
							if (isNaN(column)) {
								andCondition += `"` + column + `"`;
								conditionsValue += `"` + column + `"`;
							} else {
								if (column) {
									andCondition += column;
									conditionsValue += column;
								} else {
									andCondition += `"` + column + `"`;
									conditionsValue += `"` + column + `"`;
								}
							}
						}

						if (logical == "OR" && operations != "Contains" && data[queryStr] != undefined) {
							if (orCondition != "") { orCondition += " || "; conditionsValue += " || "; }

							if (isNaN(data[queryStr])) {
								orCondition += `"` + data[queryStr] + `"`;
								conditionsValue += includesKey + queryKey + "}";
							} else {
								orCondition += data[queryStr];
								conditionsValue += includesKey + queryKey + "}";
							}

							orCondition += " " + operations + " ";
							if (isNaN(column)) {
								orCondition += `"` + column + `"`;
								conditionsValue += `"` + column + `"`;
							} else {
								orCondition += column;
								conditionsValue += column;
							}
						}

						if (logical == "AND" && operations == "Contains" && data[queryStr] != undefined) {
							if (conditionsValue != "") { conditionsValue += " && "; }
							andContainsString = data[queryStr];
							andContainsValue = column;
							conditionsValue += includesKey + queryKey + "}";
							conditionsValue += (" Contains " + column);
						}

						if (logical == "OR" && operations == "Contains" && data[queryStr] != undefined) {
							if (conditionsValue != "") { conditionsValue += " || "; }
							orContainsString = data[queryStr];
							orContainsValue = column;
							conditionsValue += includesKey + queryKey + "}";
							conditionsValue += (" Contains " + column);
						}
					};

					let andContainsValid = true;
					if (andContainsString != "" && andContainsValue != "") {
						andContainsValue = andContainsValue.toLowerCase();
						andContainsString = andContainsString.toLowerCase();
						andContainsValid = andContainsString.includes(andContainsValue);
						andCondition += ` "${andContainsString}".includes("${andContainsValue}") `;
					}

					let orContainsValid = false;
					if (orContainsString != "" && orContainsValue != "") {
						orContainsValue = orContainsValue.toLowerCase();
						orContainsString = orContainsString.toLowerCase();
						orContainsValid = orContainsString.includes(orContainsValue);
						orCondition += ` "${orContainsString}".includes("${orContainsValue}") `;
					}

					let andValid = true;
					if (andCondition != "") {
						let andConditionValid = eval(andCondition);
						if (andConditionValid && andContainsValid) {
							andValid = true;
						} else {
							andValid = false;
						}
					}
					let orValid = false;
					if (orCondition != "") {
						let orConditionValid = eval(orCondition);
						if (orConditionValid || orContainsValid) {
							orValid = true;
						} else {
							orValid = false;
						}
					}

					if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
						if ((andValid && andContainsValid) || orValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
						if ((andValid && andContainsValid) || orValid) {
							returnValue = true;

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
						if (andContainsValid || orValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
						if ((andValid && andContainsValid) || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
						if (andValid || orValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
						if (andValid || orValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
						if (andContainsValid || orValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
						if (andContainsValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
						if (andValid && andContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
						if (andValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
						if (orValid || orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString == "") {
						if (andValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
						if (orValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
						if (andContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, action: actionMsg, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					} else if (andCondition == "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
						if (orContainsValid) {
							returnValue = true;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Pass", request_id });
						} else {
							returnValue = false;
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: actionMsg, description: conditionsValue + " = Fail", request_id });
						}
					}

					if (returnValue) {
						const newfilterTrueDataKey = filterTrueDataKey.replace("." + key, "");
						filterTrueDataKeys.push(newfilterTrueDataKey);
					} else {
						const newfilterFalseDataKey = filterTrueDataKey.replace("." + key, "");
						filterFalseDataKeys.push(newfilterFalseDataKey);
					}
				}
			}
		}

		if (!Array.isArray(value) && value != null && typeof (value) == "object") {
			filterParentKey.push(key);
			returnValue = await datafilterkeys(value, query, item, FilterEnableLog, includesKey, schedulerUniqueId, reqBodyJson, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global);
			const filterParentKeyFirst = filterParentKey[0];
			const filterParentKeyPopped = filterParentKey.pop();
		}

		if (Array.isArray(value) && value != null && typeof (value) == "object") {
			filterParentKey.push(key);
			returnValue = await datafilterkeys(value, query, item, FilterEnableLog, includesKey, schedulerUniqueId, reqBodyJson, enableLogs, enableFullLogs, filterParentKey, filterTrueDataKeys, filterFalseDataKeys, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global);
			const filterParentKeyPopped = filterParentKey.pop();
		}
	};

	return returnValue;
}

// For Filtering Use
function updateMatchingKeys(target, updates) {
	Object.entries(updates).forEach(([key, value]) => {
		if (key in target) {
			if (typeof value === 'object' && !Array.isArray(value)) {
				updateMatchingKeys(target[key], value);
			} else {
				target[key] = value;
			}
		}
	});
}

// For Filtering Use
function resolveColumnValue(column, data, querystring, header) {
	// Replace @querystring placeholders
	column = column.replace(/@querystring\{(.+?)\}/g, (match, keyword) => {
		return querystring[keyword] !== undefined ? `"${querystring[keyword]}"` : '""';
	});

	// Replace @header placeholders
	column = column.replace(/@header\{(.+?)\}/g, (match, headerKey) => {
		return header[headerKey] !== undefined ? `"${header[headerKey]}"` : '""';
	});

	// Replace @In and @Out placeholders
	column = column.replace(/@(?:In|Out)\{(.+?)\}/g, (match, key) => {
		let indexShift = 1;
		const value = getNestedValue(data, key.split('.'), indexShift);
		return value !== undefined ? `"${value}"` : match; // Keep placeholder if key is not found
	});

	column = column.replace(/\s*&\s*""$/, '');

	return column;
}

// For Filtering Use
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

function generateToJsonFormula(key, val) {
	try {
		if (typeof val === 'object' && val !== null) {
			const escaped = jsesc(JSON.stringify(val), {
				quotes: 'double', // wrap in double quotes
				wrap: true,       // add outer quotes
				es6: false        // optional: escape unicode as \uXXXX
			});
			return `${key}(${escaped})`;
		}

		// if (typeof val === 'object' && val !== null) {
		// 	return `toJson(${JSON.stringify(val)})`;
		// }

		if (typeof val === 'string') {
			const escaped = jsesc(val, {
				quotes: 'double', // wrap in double quotes
				wrap: true,       // add outer quotes
				es6: false        // optional: escape unicode as \uXXXX
			});
			return `${key}(${escaped})`;
		}

		// Numbers, booleans, null
		return `${key}(${JSON.stringify(val)})`;

	} catch (err) {
		return `${key}(null)`;
	}
}

const replacePlaceholders = (formula, dataArray, inboundFormatData = {}, querystring, header, reqIn, reqOut, resIn, resOut, globalArray, reqMethod, unique_id) => {
	const safeGlobalArray = Array.isArray(globalArray)
		? globalArray
		: [];

	const global = safeGlobalArray.reduce((acc, obj) => {
		return { ...acc, ...obj };
	}, {});

	formula = String(formula);

	// Automatically detect header mode by checking if formula contains =@ patterns
	const formulaMode = formula.trim().startsWith("="); // Excel-like formula mode
	const isHeaderMode = !formulaMode && /=@/.test(formula); // Header mode only if not formula
	const isHyperFormula = formulaMode; // shorthand for clarity

	// Handle toJson function (only in non-header mode)
	if (!isHeaderMode) {
		formula = formula.replace(/toJson2\s*\(\s*@(In|Out)\{([^}]+)\}\s*\)/gi, (match, type, key) => {
			const fullKey = `@${type}{${key}}`;
			let val;

			if (type === "In") {
				if (inboundFormatData && inboundFormatData[fullKey]) {
					val = inboundFormatData[fullKey];
				}
			} else if (type === "Out") {
				if (dataArray && dataArray[fullKey]) {
					val = dataArray[fullKey];
				}
			}
			if (val !== undefined) {
				return generateToJsonFormula('toJson2', val);
			}
			return `toJson2("null")`;
		});
	}

	if (!isHeaderMode) {
		formula = formula.replace(/toJson\s*\(\s*@(In|Out)\{([^}]+)\}\s*\)/gi, (match, type, key) => {
			const fullKey = `@${type}{${key}}`;
			let val;

			if (type === "In") {
				if (inboundFormatData && inboundFormatData[fullKey]) {
					val = inboundFormatData[fullKey];
				}
			} else if (type === "Out") {
				if (dataArray && dataArray[fullKey]) {
					val = dataArray[fullKey];
				}
			}

			if (val !== undefined) {
				return generateToJsonFormula('toJson', val);
			}
			return `toJson("null")`;
		});
	}

	// Handle @req.method with smart detection
	formula = formula.replace(/@req\.method/g, (match, offset, full) => {
		if (isHeaderMode) {
			return reqMethod;
		}

		if (isHyperFormula) {
			if (typeof reqMethod === "string" || typeof reqMethod === "boolean" || reqMethod == Stdiimport("child_process").oNull) {
				return `"${reqMethod}"`;
			}
			return `${reqMethod}`;
		}

		const before = full[offset - 1];
		const after = full[offset + match.length];
		const isConcat = before === "&" || after === "&";

		if (isConcat) {
			if (typeof reqMethod === "string" || typeof reqMethod === "boolean" || reqMethod == null) {
				return `"${reqMethod}"`;
			}
			return `${reqMethod}`;
		} else {
			return `${reqMethod}`;
		}
	});

	formula = formula.replace(/@logs\.logId/g, (match, offset, full) => {
		if (isHeaderMode) {
			return unique_id;
		}

		if (isHyperFormula) {
			if (typeof unique_id === "string" || typeof unique_id === "boolean" || unique_id == Stdiimport("child_process").oNull) {
				return `"${unique_id}"`;
			}
			return `${unique_id}`;
		}

		const before = full[offset - 1];
		const after = full[offset + match.length];
		const isConcat = before === "&" || after === "&";

		if (isConcat) {
			if (typeof unique_id === "string" || typeof unique_id === "boolean" || unique_id == null) {
				return `"${unique_id}"`;
			}
			return `${unique_id}`;
		} else {
			return `${unique_id}`;
		}
	});

	// Main placeholder replacement
	const regexPattern = isHeaderMode
		? /=@(querystring|header|In|Out|reqIn|reqOut|resIn|resOut|global)(?:\[(\d+)\])?\{([^}]+)}/g
		: /@(querystring|header|In|Out|reqIn|reqOut|resIn|resOut|global)(?:\[(\d+)\])?\{([^}]+)}/g;

	formula = formula.replace(regexPattern, (match, type, index, key) => {
		if (type === "querystring") {
			const val = querystring?.[key];
			if (val !== undefined) {
				// Return actual value for header mode, quoted for non-header mode
				return isHeaderMode ? val : (typeof val === "string" || typeof val === "boolean" || val == null ? `"${val}"` : `${val}`);
			}
			return isHeaderMode ? null : `"null"`;
		} else if (type === "header") {
			const val = header?.[key];
			if (val !== undefined) {
				// Return actual value for header mode, quoted for non-header mode
				return isHeaderMode ? val : (typeof val === "string" || typeof val === "boolean" || val == null ? `"${val}"` : `${val}`);
			}
			return isHeaderMode ? null : `"null"`;
		} else if (type === "global") {
			const val = global[key];
			if (val !== undefined) {
				// Return actual value for header mode, quoted for non-header mode
				return isHeaderMode ? val : (typeof val === "string" || typeof val === "boolean" || val == null ? `"${val}"` : `${val}`);
			}
			return isHeaderMode ? null : `"null"`;
		} else if (type === "In" || type === "Out") {
			let fullKey = `@${type}{${key}}`;
			if (dataArray[fullKey] !== undefined) {
				if (isHeaderMode) {
					// Header mode: return actual value
					return dataArray[fullKey] === null ? null : dataArray[fullKey];
				} else {
					// Non-header mode: handle different types
					if (typeof dataArray[fullKey] === "string" || typeof dataArray[fullKey] === "boolean" || dataArray[fullKey] == null) {
						return `"${dataArray[fullKey]}"`;
					} else if (typeof dataArray[fullKey] === "object") {
						return JSON.stringify(dataArray[fullKey]);
					} else {
						return `${dataArray[fullKey]}`;
					}
				}
			} else if (inboundFormatData[fullKey] !== undefined) {
				if (isHeaderMode) {
					// Header mode: return actual value
					return inboundFormatData[fullKey];
				} else {
					// Non-header mode: handle different types
					if (typeof inboundFormatData[fullKey] === "string" || typeof inboundFormatData[fullKey] === "boolean" || inboundFormatData[fullKey] == null) {
						return `"${inboundFormatData[fullKey]}"`;
					} else if (typeof inboundFormatData[fullKey] === "object") {
						return JSON.stringify(inboundFormatData[fullKey]);
					} else {
						return `${inboundFormatData[fullKey]}`;
					}
				}
			} else {
				return `"null"`;
			}
		} else if (["reqIn", "reqOut", "resIn", "resOut"].includes(type)) {
			const dataValues = { reqIn, reqOut, resIn, resOut };
			const arrayIndex = index ? parseInt(index, 10) : null;

			if (dataValues[type] && Array.isArray(dataValues[type]) && arrayIndex !== null && dataValues[type][arrayIndex]) {
				const dataArrayValue1 = dataValues[type][arrayIndex];
				const value = findValue(key, dataArrayValue1);

				if (value !== undefined) {
					// Return actual value for header mode, quoted for non-header mode
					return isHeaderMode ? value : (typeof value === "string" || typeof value === "boolean" || value == null ? `"${value}"` : `${value}`);
				}
			}
			return `"@${type}[${index}]{${key}}"`;
		} else {
			return formula;
		}
	});

	if (formulaMode && !formula.trim().startsWith("=")) {
		formula = "=" + formula;
	}

	return formula;
}

const replacePlaceholdersForheader = (formula, dataArray, inboundFormatData = {}, querystring, header, reqIn, reqOut, resIn, resOut, globalArray, reqMethod) => {
	const global = globalArray.reduce((acc, obj) => {
		return { ...acc, ...obj };
	}, {});
	formula = String(formula);

	formula = formula.replace(/=@req\.method/g, reqMethod);
	let checkArray = ["string", "boolean"];
	return formula.replace(/=@(querystring|header|In|Out|reqIn|reqOut|resIn|resOut|global)(?:\[(\d+)\])?\{([^}]+)}/g, (match, type, index, key) => {
		if (type === "querystring") {
			const val = querystring?.[key];
			if (val !== undefined) {
				return checkArray.includes(typeof val) || val == null ? `"${val}"` : `${val}`;
			}
			return `"null"`;
		} else if (type === "header" && header[key] !== undefined) {
			return checkArray.includes(typeof header[key]) || header[key] == null ? `"${header[key]}"` : `${header[key]}`;
		} else if (type === "global") {
			const val = global[key];
			if (val !== undefined) {
				return checkArray.includes(typeof val) || val == null ? `"${val}"` : `${val}`;
			}
			return `"null"`;
		} else if ((type === "In" || type === "Out")) {
			let fullKey = `@${type}{${key}}`;
			if (dataArray[fullKey] !== undefined) {
				return checkArray.includes(typeof dataArray[fullKey]) || dataArray[fullKey] == null ? `"${dataArray[fullKey]}"` : `${dataArray[fullKey]}`;
			} else if (inboundFormatData[fullKey] !== undefined) {
				return checkArray.includes(typeof inboundFormatData[fullKey]) || inboundFormatData[fullKey] == null ? `"${inboundFormatData[fullKey]}"` : `${inboundFormatData[fullKey]}`;
			} else {
				return `"${fullKey}"`;
			}
		} else if (["reqIn", "reqOut", "resIn", "resOut"].includes(type)) {
			const dataValues = { reqIn, reqOut, resIn, resOut };
			const arrayIndex = index ? parseInt(index, 10) : null;

			if (dataValues[type] && Array.isArray(dataValues[type]) && arrayIndex !== null && dataValues[type][arrayIndex]) {
				const dataArrayValue1 = dataValues[type][arrayIndex];
				const value = findValue(key, dataArrayValue1);

				if (value !== undefined) {
					return checkArray.includes(typeof value) || value == null ? `"${value}"` : `${value}`;
				}
			}
			return `"@${type}[${index}]{${key}}"`;
		} else {
			return formula;
		}
	});
}

// Bind value and retrieve function for invalid keys
function replacePlaceholdersInValidKeys(formula, dataArray, inboundFormatData = {}, querystring, header, globalArray) {
	const global = globalArray.reduce((acc, obj) => {
		return { ...acc, ...obj }; // same as Object.assign(acc, obj)
	}, {});
	formula = String(formula);
	let checkArray = ["string", "boolean"];
	return formula.replace(/@(querystring|header|In|Out){([^}]+)}/g, (match, type, key) => {
		if (type === "querystring" && querystring[key] !== undefined) {
			return checkArray.includes(typeof querystring[key]) || querystring[key] == null ? `"${querystring[key]}"` : `${querystring[key]}`;
		} else if (type === "header" && header[key] !== undefined) {
			return checkArray.includes(typeof header[key]) || header[key] == null ? `"${header[key]}"` : `${header[key]}`;
		} else if (type === "global" && global[key] !== undefined) {
			return checkArray.includes(typeof global[key]) || global[key] == null ? `"${global[key]}"` : `${global[key]}`;
		} else if ((type === "In" || type === "Out")) {
			let fullKey = `@${type}{${key}}`;
			if (dataArray[fullKey] !== undefined) {
				return checkArray.includes(typeof dataArray[fullKey]) || dataArray[fullKey] == null ? `"${dataArray[fullKey]}"` : `${dataArray[fullKey]}`;
			} else if (inboundFormatData[fullKey] !== undefined) {
				return checkArray.includes(typeof inboundFormatData[fullKey]) || inboundFormatData[fullKey] == null ? `"${inboundFormatData[fullKey]}"` : `${inboundFormatData[fullKey]}`;
			} else {
				return "null";
			}
		} else {
			return formula;
		}
	});
}

function wrapDynamicPlaceholders(inputString) {
	// Define the dynamic pattern to match placeholders like @querystring{}, @header{}, etc.
	return inputString.replace(/(&\s*)(@[a-zA-Z]+\{[^}]+\})/g, '$1"$2"');
}

// For Filtering Use
function removeDynamicKey(jsonObj, dynamicKey) {
	const keys = dynamicKey.split('.');
	let current = jsonObj;

	for (let i = 0; i < keys.length - 1; i++) {
		const key = keys[i];

		if (!(key in current)) {
			return jsonObj;
		}
		current = current[key];
	}

	const lastKey = keys[keys.length - 1];
	if (Array.isArray(current) && !isNaN(lastKey)) {
		const index = parseInt(lastKey, 10);
		if (index >= 0 && index < current.length) {
			current.splice(index, 1);
		}
	} else if (typeof current === 'object' && lastKey in current) {
		delete current[lastKey];
	}

	return jsonObj;
}

// For Filtering Use
function removeData(dataArrKeys, data, mainKey) {
	dataArrKeys = orderBy(dataArrKeys, null, "desc");

	for (let i = 0; i < dataArrKeys.length; i++) {
		const dataArrKey = dataArrKeys[i].replace(mainKey + ".", "");
		const keysArr = dataArrKey.split(".");
		const keysArrLength = keysArr.length;

		if (keysArrLength > 0) {
			if (keysArrLength == 2) {
				if (!Array.isArray(data[keysArr[0]]) && data[keysArr[0]] != null && typeof (data[keysArr[0]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]]) && data[keysArr[0]] != null && typeof (data[keysArr[0]]) == "object") {
					let dataArr = data[keysArr[0]];
					dataArr.splice(keysArr[1], 1);
					data[keysArr[0]] = dataArr;
				}
			}

			if (keysArrLength == 3) {
				if (!Array.isArray(data[keysArr[0]][keysArr[1]]) && data[keysArr[0]][keysArr[1]] != null && typeof (data[keysArr[0]][keysArr[1]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]][keysArr[1]]) && data[keysArr[0]][keysArr[1]] != null && typeof (data[keysArr[0]][keysArr[1]]) == "object") {
					let dataArr = data[keysArr[0]][keysArr[1]];
					dataArr.splice(keysArr[2], 1);
					data[keysArr[0]][keysArr[1]] = dataArr;
				}
			}

			if (keysArrLength == 4) {
				if (!Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]]) && data[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]]) && data[keysArr[0]][keysArr[1]][keysArr[2]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]]) == "object") {
					let dataArr = data[keysArr[0]][keysArr[1]][keysArr[2]];
					dataArr.splice(keysArr[3], 1);
					data[keysArr[0]][keysArr[1]][keysArr[2]] = dataArr;
				}
			}

			if (keysArrLength == 5) {
				if (!Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]]) == "object") {
					let dataArr = data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]];
					dataArr.splice(keysArr[4], 1);
					data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]] = dataArr;
				}
			}

			if (keysArrLength == 6) {
				if (!Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]]) == "object") {
					let dataArr = data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]];
					dataArr.splice(keysArr[5], 1);
					data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]] = dataArr;
				}
			}

			if (keysArrLength == 7) {
				if (!Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]]) == "object") {
				}

				if (Array.isArray(data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]]) && data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]] != null && typeof (data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]]) == "object") {
					let dataArr = data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]];
					dataArr.splice(keysArr[6], 1);
					data[keysArr[0]][keysArr[1]][keysArr[2]][keysArr[3]][keysArr[4]][keysArr[5]] = dataArr;
				}
			}
		}
	}

	return data;
}

// Check if the value starts with a date or not
function cleanAndValidateDate(dateString) {
	const exactStringMatch = /^="\s*([^"]+)\s*"$/;

	const match = dateString.match(exactStringMatch);
	if (!match) {
		return false;
	}

	const innerValue = match[1].trim();

	// Reject if inner value looks like a formula or math expression
	const formulaContentPattern = /\b(AND|OR|IF|SUM|AVERAGE|COUNT|COUNTA|COUNTIF|COUNTIFS|SUMIF|SUMIFS|AVERAGEIF|AVERAGEIFS|VLOOKUP|HLOOKUP|MATCH|INDEX|MIN|MAX|IFERROR|IFNA|ISBLANK|ISNUMBER|ISTEXT|ISERROR|ISNA|LEN|TRIM|CONCATENATE|CONCAT|TEXT|VALUE|DATE|TODAY|NOW|ROUND|ROUNDUP|ROUNDDOWN|LEFT|RIGHT|MID|UPPER|LOWER|PROPER|SUBSTITUTE|SEARCH|FIND|REPLACE|TEXTJOIN)\b/i;
	if (formulaContentPattern.test(innerValue)) {
		return false;
	}

	// Reject if it looks like math or string concat
	if (/[\+\&]/.test(innerValue)) {
		return false;
	}

	// Clean and parse date
	const cleanedDate = innerValue;

	// Define all possible formats
	const possibleFormats = [
		"MM/DD/YYYY", "DD/MM/YYYY", // Add MM/DD/YYYY first if you expect that format
		"YYYY/MM/DD", "YYYY-MM-DD",
		"YYYY.MM.DD", "DD.MM.YYYY", "MM.DD.YYYY",
		"YYYY/MM/DD HH:mm", "YYYY-MM-DD HH:mm", "DD/MM/YYYY HH:mm", "MM/DD/YYYY HH:mm",
		"YYYY/MM/DD HH:mm:ss", "YYYY-MM-DD HH:mm:ss", "DD/MM/YYYY HH:mm:ss", "MM/DD/YYYY HH:mm:ss",
		"YYYY/MM/DD hh:mm A", "YYYY-MM-DD hh:mm A", "DD/MM/YYYY hh:mm A", "MM/DD/YYYY hh:mm A",
		"YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.SSSZ",
		"HH:mm", "hh:mm A", "HH:mm:ss", "hh:mm:ss A",
		"dddd, MMMM D, YYYY", "MMM D, YYYY", "D-MMM-YYYY",
		"YYYYMMDD"
	];

	let parsedDate = moment(cleanedDate, possibleFormats, true); // strict parsing

	if (!parsedDate.isValid()) {
		parsedDate = moment(cleanedDate, possibleFormats, false); // non-strict parsing
	}

	return parsedDate.isValid();
}

// Convert string to number
function stringToNumber(value) {
	if (value === null || value === undefined || value === "NaN") {
		return NaN;
	}

	const stringInput = String(value).trim();
	const match = stringInput.match(/^[-+]?\d*\.?\d+/);
	const result = match ? parseFloat(match[0]) : NaN;

	return result;
}

// Convert string to boolean
function stringToBoolean(str) {
	try {
		if (str === undefined || str === null) {
			return false;
		}

		const lowerString = String(str).toLowerCase();
		const falsyValues = ['false', 'no', 'nan', 'undefined', '0', ''];

		if (falsyValues.includes(lowerString)) {
			return false;
		}

		if (lowerString === 'true') {
			return true;
		}

		return true;
	} catch {
		return false;
	}
}

// Format JSON data (Convert keys for the given JSON)
async function inboundreplacementformatdata(reqBody, includesKey, output = {}) {
	function processData(data, path = '', isArrayElement = false) {
		// Store the current data at the path only if not an array element
		if (path && !isArrayElement) {
			output[`${includesKey}${path}}`] = data;
		}

		// Handle arrays
		if (Array.isArray(data)) {
			data.forEach((item, index) => {
				const newPath = `${path}[${index}]`;
				processData(item, newPath, true); // Mark as array element
			});
		}
		// Handle objects
		else if (typeof data === 'object' && data !== null) {
			for (const [key, value] of Object.entries(data)) {
				const newPath = path ? `${path}.${key}` : key;
				// Recurse for objects/arrays, or store leaf values
				if (typeof value === 'object' && value !== null) {
					processData(value, newPath, false); // Not an array element
				} else {
					output[`${includesKey}${newPath}}`] = value;
				}
			}
		}
	}

	// Start processing with the root object
	processData(reqBody);
	return output;
}

function checklinkdataarraykey(key, dataArray) {
	let j = 1;
	for (let i = 0; i < dataArray.length; i++) {
		let key1 = (j == 1) ? key : key + j;
		if (dataArray[i] == key1) {
			j++;
		}
	}

	return j;
}

async function writelog(file, string) {
	return new Promise((resolve) => {
		fs.appendFileSync(file, string);
		resolve();
	})
}

function isParentLinked(key, newLinkDataArr) {
	if (!key.includes('.')) {
		return key in newLinkDataArr;
	}
	// Extract current level parent key
	const lastDotIndex = key.lastIndexOf('.');
	const parentKey = key.substring(0, lastDotIndex) + '}';
	// Recursively check parent linkage
	return parentKey in newLinkDataArr && isParentLinked(parentKey, newLinkDataArr);
}

async function processMapping(mappingInbound, newLinkDataArr, inboundFormatData, outboundFormatDataArr) {
	for (const key of Object.keys(mappingInbound)) {
		const inKey = key.replace("@Out{", "@In{");

		if (key.includes('.')) {
			const parentLinked = await isParentLinked(key, newLinkDataArr);

			if (parentLinked && inboundFormatData[inKey] !== undefined) {
				outboundFormatDataArr[key] = inboundFormatData[inKey];
			}
		} else {
			// Non-nested properties
			if (!(key in newLinkDataArr)) {
				outboundFormatDataArr[key] = null;
			} else if (inboundFormatData[inKey] !== undefined) {
				// optional assignment
				// outboundFormatDataArr[key] = inboundFormatData[inKey];
			}
		}
	}
}

async function isParentLinkedFn(key, newLinkDataArr) {

	if (!key.includes('.')) {
		// Base case: Direct check, with array item fallback
		if (key.includes('[')) {
			const mainArrayKey = extractMainArrayKey(key);
			return mainArrayKey ? (mainArrayKey in newLinkDataArr) : (key in newLinkDataArr);
		}
		return key in newLinkDataArr;
	}

	// For nested: Check if array path and jump to main array
	if (key.includes('[')) {
		const mainArrayKey = extractMainArrayKey(key);
		if (mainArrayKey && (mainArrayKey in newLinkDataArr)) {
			return true;
		}
		// If main array not linked, fall through to strict recursion (unlikely but safe)
	}

	// Strict recursive case for non-arrays or failed array check
	const lastDotIndex = key.lastIndexOf('.');
	const parentKey = key.substring(0, lastDotIndex) + '}';
	return parentKey in newLinkDataArr && await isParentLinkedFn(parentKey, newLinkDataArr);
}

function extractMainArrayKey(key) {
	const startBrace = key.indexOf('{') + 1;
	const endBrace = key.lastIndexOf('}');
	if (startBrace < 0 || endBrace < 0) return null;

	const inside = key.substring(startBrace, endBrace);
	const bracketStart = inside.indexOf('[');
	if (bracketStart === -1) return null;  // Not an array

	const arrayName = inside.substring(0, bracketStart).trim();
	return `@Out{${arrayName}}`;
}

// Inbound mapping function
async function inboundMappingHandler(outboundSettingData, enableLogs, enableFullLogs, companyCode, schedulerUniqueId, inboundEnableLog, outboundEnableLog, item_id, item, reqBody, bodyreq, mappingSettingData, inboundFormatData, inboundPostData, propertiesSettingData, inboundFormatDataUnkeyArr, outboundPostDataUnkeyArr, outboundFormatDataUnkeyArr, outboundPostDataFormat, nodeDataArray, linkDataArray, outboundMappedData, OutboundFormatData, ItemName, emailDdepInputPath = "", outboundApiUrls = [], outboundLastPath = "", dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString = "", enabledebug, enableError = "no", querystring = {}, header = {}, reqIn = [], reqOut = [], resIn = [], resOut = [], global = {}, request_id, reqMethod = "POST", endpointMeta, generalValues, enableDiffCheck, diffCheckReturnUrl, type, logdir, logdatefilename) {
	try {
		if (type == "Scheduler") {
			const todaydate = new Date();
			const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > ";
			var prelogtest = prelog.replace("keywords", "not defined");
		}

		console.log("\nInbound posted json:", inboundPostData);

		if (type == "Scheduler") {
			await writelog(logdir + logdatefilename, prelogtest + "Inbound format convert to replacement Format:" + " > " + JSON.stringify(inboundFormatData) + "\n");
		}

		inboundFormatData = await inboundreplacementformatdata(inboundPostData, "@In{");
		console.log("\nInbound format convert to replacement Format:", inboundFormatData);

		// FOR Pre-Requst
		if (!enabledebug || enabledebug.toLowerCase() !== "true") {
			const actions = outboundSettingData?.specifyHeaders?.actionsArray || [];

			const pickContent = {};
			const runAction = async a => {
				const t = a.actionType; if (!a.status) return;
				const vars = await processVariablesAndHeaders(companyCode, (t === "Webhook" ? a.webhook?.variables : a.email?.variables), OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, item);
				const hdrs = t === "Webhook" ? await processVariablesAndHeaders(companyCode, a.webhook?.headers, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, item) : null;
				const vres = await actionValidationHandler(a.validations || [], "@In{", enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
				if (vres.code != 0) return;
				const contentObj = (t === "Webhook" ? a.webhook : a.email);
				const result = await processWebhookContent(contentObj.content || contentObj, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundPostData, {}, {}, pickContent, vars, {});
				if (t === "Webhook") {
					const urlString = await buildFinalReturnUrl({ url: a.webhook.url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method: reqMethod, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id });
					const methodType = await formulaGetValue(companyCode, a.webhook.method || "POST", a.webhook.method || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod);
					if (urlString?.trim()) await webhook_call({ upUrl: urlString.trim(), methodType, triggerWhen: a.triggerWhen, webhook: a.webhook, result, actionHeaders: hdrs, enableLogs, itemLog: inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }).catch(err => console.error("Background webhook error:", err.message));
					return;
				}
				// Email
				let emailSubject = a.email.subject || '';
				emailSubject = replacePlaceholders(emailSubject, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
				emailSubject = await formulaGetValue(companyCode, emailSubject, emailSubject, "", OutboundFormatData, inboundFormatData, includesKey = "@In{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

				let entrypointURL = config.domain + "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath;
				let outboundApiUrl = outboundApiUrls.length > 0 ? outboundApiUrls[0] : "";
				if (outboundLastPath != "") { outboundApiUrl += outboundLastPath; }
				if (queryString != "") { outboundApiUrl += "?" + queryString; }
				let endpointURL = outboundApiUrl;
				await emailSend({ triggerWhen: a.triggerWhen, email: a.email, emailSubject, result, enableLogs, itemLog: inboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail: mappingSettingData.disabledInboundEmailFailuresNotice, body: inboundPostData, transformedBody: '', responseBody: '', transformedResponseBody: '', entrypointURL, endpointURL }).catch(err => console.error("Background email error:", err.message));
			};

			const filterKey = "Pre-Request";
			const todo = actions.filter(x => x.triggerWhen === filterKey && x.status && (x.actionType === "Webhook" || x.actionType === "Email"));
			if (todo.length) await Promise.allSettled(todo.map(a => runAction(a)));
		}

		if (type == "Scheduler") {
			await writelog(logdir + logdatefilename, prelogtest + "Inbound format convert to replacement Format:" + " > " + JSON.stringify(inboundFormatData) + "\n");
		}

		if (mappingSettingData != undefined && mappingSettingData.is_active != undefined && mappingSettingData.is_active == "Active" && mappingSettingData.outbound_format != "" && mappingSettingData.mapping_data != "") {
			if (propertiesSettingData != undefined) {
				const itemsProperties = propertiesSettingData?.item_properties || [];
				let itemsPropertiesArr = [];
				if (itemsProperties.length > 0) {
					for (let i = 0; i < itemsProperties.length; i++) {
						if (itemsProperties[i] != "") {
							itemsPropertiesArr[itemsProperties[i].general.itemKey] = itemsProperties[i];
						}
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Rules", request_id });

					const propertiesAdditionalRules = await propertiesAdditionalRulesApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
					if (propertiesAdditionalRules.valid) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Rules Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Inbound Property Additional Rules Applied Successful:" + "\n");
						}
						inboundFormatData = propertiesAdditionalRules.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Formula", request_id });

					dataArrayReviseParentKey = [];
					dataArrayReviseArr = {};
					const newInboundFormatData = await propertiesFormulaApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, nodeDataArray = [], dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);

					if (!newInboundFormatData.valid) {
						let errorBody = {
							code: "1",
							MsgCode: newInboundFormatData.MsgCode,
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Properties Validation Fail",
							LongMsg: newInboundFormatData.longMsg,
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							Data: [],
							logQueueMsg: "Validation Fail",
							logType: inboundEnableLog,
							httpStatus: 400
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Formula Error : " + newInboundFormatData.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

						return errorBody;
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Formula Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Inbound Property Formula Applied Successful:" + "\n");
						}

						inboundFormatData = newInboundFormatData.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Validation", request_id });

					const inboundPropertiesAdditionalValidation = await propertiesAdditionalValidationApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
					if (!inboundPropertiesAdditionalValidation.valid) {
						let errorBody = {
							code: "1",
							MsgCode: inboundPropertiesAdditionalValidation.MsgCode,
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Properties Additional Validation Fail",
							LongMsg: inboundPropertiesAdditionalValidation.longMsg,
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							Data: [],
							logQueueMsg: "Validation Fail",
							logType: inboundEnableLog,
							httpStatus: 400
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Validation Error : " + inboundPropertiesAdditionalValidation.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

						return errorBody;
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Validation Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Inbound Property Additional Validation Applied Successful:" + "\n");
						}

						inboundFormatData = inboundPropertiesAdditionalValidation.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Visibility", request_id });

					const inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply = await propertiesAdditionalVisibilityHiddenRulesApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, endpointMeta, generalValues, reqMethod);
					if (inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.valid) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Apply", description: "Inbound Property Additional Visibility Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Inbound Property Additional Visibility Applied Successful" + "\n");
						}

						inboundFormatData = inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.dataArray;
					}
				}
			}

			let tempDataArr1 = JSON.parse(JSON.stringify(inboundFormatData));
			for (const key in tempDataArr1) {
				if (tempDataArr1[key] === 'THIS-KEY-REMOVE-BY-VISIBILTY-RULE') {
					tempDataArr1 = await deleteFormatKeyData(key, "@In{", tempDataArr1);
					delete tempDataArr1[key];
				}
			}
			inboundFormatData = tempDataArr1;

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Mapping Data", request_id });

			try {
				const inboundMappingFormatData = JSON.parse(mappingSettingData.inbound_format);

				if (Array.isArray(inboundMappingFormatData)) {
					inboundFormatDataUnkeyArr = true;
				}
			} catch (err) {
				parseString(mappingSettingData.inbound_format, function (err, result) {
					const inboundMappingFormatData = jsonOriginal(result);

					if (Array.isArray(inboundMappingFormatData)) {
						inboundFormatDataUnkeyArr = true;
					}
				});
			}

			try {
				OutboundFormatData = JSON.parse(mappingSettingData.outbound_format);

				if (Array.isArray(OutboundFormatData)) {
					outboundFormatDataUnkeyArr = true;
				}
			} catch (err) {
				parseString(mappingSettingData.outbound_format, function (err, result) {
					OutboundFormatData = jsonOriginal(result);

					if (Array.isArray(OutboundFormatData)) {
						outboundFormatDataUnkeyArr = true;
					}
				});
				outboundPostDataFormat = "xml";
			}

			let mapping_data = {};
			try {
				mapping_data = JSON.parse(mappingSettingData.mapping_data);
			} catch (err) {
				mapping_data = mappingSettingData.mapping_data;
			}

			nodeDataArray = mapping_data.nodeDataArray;
			linkDataArray = mapping_data.linkDataArray;

			const linkdataarray = linkDataArray;
			let newLinkDataArr = {};
			let newLinkDataArrCount = [];
			for (let i = 0; i < linkdataarray.length; i++) {
				if (Object.entries(linkdataarray[i]).length > 0) {
					if (linkdataarray[i].category != undefined && linkdataarray[i].category == "Mapping") {
						let linkdataarraykey = linkdataarray[i].to;
						let linkdataarraykeycount = checklinkdataarraykey(linkdataarraykey, newLinkDataArrCount);

						if (linkdataarraykeycount > 1) {
							linkdataarraykey += linkdataarraykeycount;
						}

						newLinkDataArr[linkdataarraykey] = linkdataarray[i].from;
						newLinkDataArrCount.push(linkdataarraykey);

						let fromKey = linkdataarray[i].from;
						for (let fromKeyI = 2; fromKeyI < 5001; fromKeyI++) {
							const newfromKey = fromKey + fromKeyI;
							if (inboundFormatData[newfromKey] !== undefined) {
								newLinkDataArr[linkdataarraykey + fromKeyI] = newfromKey;
								newLinkDataArrCount.push(linkdataarraykey);
							} else {
								break;
							}
						}
					}
				}
			}

			const sortedEntries = Object.entries(newLinkDataArr).sort(([keyA], [keyB]) => {
				const countDots = key => (key.match(/\./g) || []).length;
				const dotsA = countDots(keyA);
				const dotsB = countDots(keyB);
				if (dotsA !== dotsB) { return dotsA - dotsB; }
				return keyA.localeCompare(keyB);
			});

			const sortedMapping = Object.fromEntries(sortedEntries);
			newLinkDataArr = sortedMapping;

			newLinkDataArr = expandSimpleMappingsToIndexed(newLinkDataArr, inboundPostData, OutboundFormatData);
			let mappingInbound = {};
			if (newLinkDataArrCount.length > 0) {
				let outboundFormatDataArr = {};

				if (Array.isArray(OutboundFormatData)) {
					const arrData = OutboundFormatData;
					OutboundFormatData = {};
					OutboundFormatData["items"] = arrData;
					outboundPostDataUnkeyArr = true;
				}

				outboundFormatDataArr = await inboundreplacementformatdata(OutboundFormatData, "@Out{");

				let tempDataArr = JSON.parse(JSON.stringify(outboundFormatDataArr));
				tempDataArr = await adjustArrayLengths(tempDataArr, newLinkDataArr, inboundFormatData, outboundFormatDataArr);
				outboundFormatDataArr = tempDataArr;

				let outboundArr = JSON.parse(JSON.stringify(tempDataArr));

				for (let key in outboundFormatDataArr) {
					const inKey = key.replace("@Out{", "@In{");
					const inboundValue = inboundFormatData[inKey];
					if (inboundValue !== undefined) {
						outboundFormatDataArr[key] = inboundValue;
					} else {
						let keys = Object.keys(newLinkDataArr).find(linkedKey => key == linkedKey);
						if (!keys) {
							outboundFormatDataArr[key] = null;
						}
					}
				}

				mappingInbound = outboundFormatDataArr;

				for (let outKey in newLinkDataArr) {
					let inKey = newLinkDataArr[outKey];
					if (!inKey.startsWith('@In{')) continue;

					let prefix = inKey.slice(0, -1);
					let inboundValue = inboundFormatData[inKey];

					// Find all keys in inboundFormatData that start with this prefix
					const matchingKeys = Object.keys(inboundFormatData).filter(k => k.startsWith(prefix));

					if (matchingKeys.length > 0) {
						for (let matchKey of matchingKeys) {
							const matchBase = matchKey.slice(0, -1);
							const regex = new RegExp(`^${matchBase}`);

							const foundOutKeys = Object.keys(newLinkDataArr).filter(ok =>
								regex.test(newLinkDataArr[ok])
							);

							if (foundOutKeys.length > 0) {
								for (let foundOutKey of foundOutKeys) {
									mappingInbound[foundOutKey] = inboundFormatData[matchKey] ?? null;
								}
							} else {
								mappingInbound[outKey] = inboundValue ?? null;
							}
						}
					} else {
						mappingInbound[outKey] = inboundValue ?? null;
					}
				}

				for (let outKey in newLinkDataArr) {
					const inKey = newLinkDataArr[outKey];
					if (inboundFormatData.hasOwnProperty(inKey)) {
						mappingInbound[outKey] = inboundFormatData[inKey];
					}
				}

				for (let key in newLinkDataArr) {
					let inboundValue = inboundFormatData[newLinkDataArr[key]];
					if (Array.isArray(inboundValue)) {
						const outboundArray = outboundArr[key];
						const mappingArray = mappingInbound[key];

						if (Array.isArray(outboundArray) && Array.isArray(mappingArray)) {
							for (let i = 0; i < outboundArray.length; i++) {
								const outboundItem = outboundArray[i];
								const mappingItem = mappingArray[i];

								// ensure both are non-null objects
								if (outboundItem && typeof outboundItem === "object" &&
									mappingItem && typeof mappingItem === "object") {

									const outboundKeys = Object.keys(outboundItem);
									outboundKeys.forEach(innerKey => {
										if (!Object.prototype.hasOwnProperty.call(mappingItem, innerKey)) {
											mappingItem[innerKey] = outboundItem[innerKey];
										}
									});
								}
							}
						}
					}
				}

				await processMapping(mappingInbound, newLinkDataArr, inboundFormatData, outboundFormatDataArr);

				let tempDataArr1 = JSON.parse(JSON.stringify(outboundFormatDataArr));
				tempDataArr1 = await adjustArrayWithoutLinkedLengths(inboundPostData, OutboundFormatData, tempDataArr1, newLinkDataArr);
				tempDataArr1 = await generateArrayChildKeys(outboundFormatDataArr, newLinkDataArr, inboundFormatData);

				outboundFormatDataArr = tempDataArr1;
				mappingInbound = outboundFormatDataArr;

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Mapping Data Successful", request_id });

				console.log("\nOutbound format convert to replacement Format:", outboundFormatDataArr);

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound format convert to replacement Format:" + " > " + JSON.stringify(outboundFormatDataArr) + "\n");
				}

				if (propertiesSettingData != undefined) {
					const itemsProperties = propertiesSettingData?.item_properties || [];
					let itemsPropertiesArr = [];

					if (itemsProperties != "" && itemsProperties != undefined && itemsProperties.length != undefined && itemsProperties.length > 0) {
						for (let i = 0; i < itemsProperties.length; i++) {
							itemsPropertiesArr[itemsProperties[i].general.itemKey] = itemsProperties[i];
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules", request_id });

						const propertiesAdditionalRules = await propertiesAdditionalRulesApply(companyCode, itemsPropertiesArr, outboundFormatDataArr, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
						if (propertiesAdditionalRules.valid) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Rules Applied Successful:" + "\n");
							}
							outboundFormatDataArr = propertiesAdditionalRules.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula", request_id });

						dataArrayReviseParentKey = [];
						dataArrayReviseArr = {};
						const newOutboundFormatData = await propertiesFormulaApply(companyCode, itemsPropertiesArr, outboundFormatDataArr, inboundFormatData, "@Out{", item, schedulerUniqueId, nodeDataArray, dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);

						if (!newOutboundFormatData.valid) {
							let errorBody = {
								code: "1",
								MsgCode: newOutboundFormatData.MsgCode,
								MsgType: "Invalid-Source",
								MsgLang: "en",
								ShortMsg: "Properties Validation Fail",
								LongMsg: newOutboundFormatData.longMsg,
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: [],
								logQueueMsg: "Validation Fail",
								logType: inboundEnableLog,
								httpStatus: 400
							}

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Error : " + newOutboundFormatData.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

							return errorBody;
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Formula Applied Successful:" + "\n");
							}
							mappingInbound = newOutboundFormatData.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation", request_id });

						const outboundPropertiesAdditionalValidation = await propertiesAdditionalValidationApply(companyCode, itemsPropertiesArr, mappingInbound, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
						if (!outboundPropertiesAdditionalValidation.valid) {
							let errorBody = {
								code: "1",
								MsgCode: outboundPropertiesAdditionalValidation.MsgCode,
								MsgType: "Invalid-Source",
								MsgLang: "en",
								ShortMsg: "Properties Additional Validation Fail",
								LongMsg: outboundPropertiesAdditionalValidation.longMsg,
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: [],
								logQueueMsg: "Validation Fail",
								logType: inboundEnableLog,
								httpStatus: 400
							}

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Error : " + outboundPropertiesAdditionalValidation.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

							return errorBody;
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Validation Applied Successful:" + "\n");
							}
							mappingInbound = outboundPropertiesAdditionalValidation.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Visibility", request_id });

						const outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply = await propertiesAdditionalVisibilityHiddenRulesApply(companyCode, itemsPropertiesArr, mappingInbound, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, endpointMeta, generalValues, reqMethod);
						if (outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.valid) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "OutBound Apply", description: "OutBound Property Additional Visibility Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "OutBound Property Additional Visibility Applied Successful" + "\n");
							}
							mappingInbound = outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.dataArray;
						}
					}
				}

				if (Array.isArray(OutboundFormatData)) {
					const arrData = OutboundFormatData;
					OutboundFormatData = {};
					OutboundFormatData["items"] = arrData;
					outboundPostDataUnkeyArr = true;
				}

				outboundFormatDataParentKey = [];
				mappingArrayMerged = [];
				outboundMappedData = outboundformatdata(OutboundFormatData, mappingInbound, newLinkDataArr, nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged);
				outboundMappedData = replaceToJson(outboundMappedData);
				outboundMappedData = removeKeyFromJson(outboundMappedData, "THIS-KEY-REMOVE-BY-VISIBILTY-RULE");
				console.log("\nOutbound Final Result:", outboundMappedData);

				reqOut.push(outboundMappedData);

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Final Result:" + " > " + JSON.stringify(outboundMappedData) + "\n");
				} else {
					console.log("\nReqOut Variable inbound processing:", JSON.stringify(reqOut, null, 2))
				}

				let parsedData = safeJSONStringify(outboundMappedData, config.dataSize);

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? parsedData : "", request_id });

				if (bodyreq != "" && outboundMappedData.length != 0) {
					bodyreq = outboundMappedData;
				}

				if (outboundMappedData.length != 0) {
					reqBody = outboundMappedData;
				}



			} else {
				bodyreq = inboundPostData;
				reqBody = inboundPostData;
				outboundMappedData = inboundPostData;
				console.log("\nOutbound Final Result:", outboundMappedData);

				reqOut.push(outboundMappedData);
				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Final Result:" + " > " + JSON.stringify(outboundMappedData) + "\n");
				} else {
					console.log("\nReqOut Variable inbound processing:", JSON.stringify(reqOut, null, 2))
				}

				let parsedData = safeJSONStringify(outboundMappedData, config.dataSize);

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? parsedData : "", request_id });
			}
		} else {
			reqBody = inboundPostData;
			bodyreq = inboundPostData;
			outboundMappedData = inboundPostData;
			reqOut.push(outboundMappedData);

			if (type == "Scheduler") {
				await writelog(logdir + logdatefilename, prelogtest + "Outbound Final Result:" + " > " + JSON.stringify(outboundMappedData) + "\n");
			} else {
				console.log("\nReqOut Variable inbound processing:", JSON.stringify(reqOut, null, 2))
			}

			let parsedData = safeJSONStringify(outboundMappedData, config.dataSize);

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && inboundEnableLog == "on")) ? parsedData : "", request_id });
		}

		// For Differnce checker function here
		const baseLogData = { companyCode, log_unique_id: schedulerUniqueId, log_request_id: request_id, item_id, ItemName: item.ItemName, type: "Inbound", path: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath };
		const diff_unique_id = uuidv4();
		const notifyBaseLogData = { ...baseLogData, unique_id: diff_unique_id, };

		try {
			let templateInbound = outboundSettingData?.specifyHeaders?.templateInbound;
			if (templateInbound && enableDiffCheck == "on") {
				// templateInbound = replacePlaceholders(templateInbound, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
				templateInbound = await processWebhookContent(templateInbound, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundPostData, outboundMappedData, {}, {}, {}, {});
				templateInbound = await formulaGetValue(companyCode, templateInbound, templateInbound || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod);

				const diffResult = await lineByLineDiff(templateInbound, outboundMappedData);
				const changedLines = diffResult.rows.filter(r => r.changeType !== "unchanged");

				if (changedLines.length > 0) {
					addToLogDiffQueue({ ...notifyBaseLogData, action: "Start", description: `Start Diff Checker` });

					addToLogDiffQueue({ ...notifyBaseLogData, action: "Diff Row Count", description: changedLines.length });

					let outboundApiUrl = outboundApiUrls.length > 0 ? outboundApiUrls[0] : "";
					addToLogDiffQueue({ ...notifyBaseLogData, action: "EndPoint URL", description: outboundApiUrl });

					const recordToStore = { itemId: item_id, unique_id: schedulerUniqueId, ItemName: item.ItemName, type: "Inbound", totalDiffRow: changedLines.length, entrypointURL: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath, endpointURL: outboundApiUrl, body: diffResult.rightText, template: diffResult.leftText, companyCode };

					if (diffCheckReturnUrl) {
						await handleDiffCheckerReturnUrl(notifyBaseLogData, diffCheckReturnUrl, recordToStore);
					}

					addToLogDiffQueue({ ...notifyBaseLogData, action: "End", description: "Last End" });
				}
			}

		} catch (error) {
			console.error("Error generating diff unique ID:", error);
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound End", description: "End Inbound", request_id });

		if (type == "Scheduler") {
			await writelog(logdir + logdatefilename, prelogtest + "End Inbound:" + "\n");
		}

		return {
			code: "0",
			reqBody,
			bodyreq,
			inboundFormatData,
			inboundFormatDataUnkeyArr,
			outboundPostDataUnkeyArr,
			outboundFormatDataUnkeyArr,
			outboundPostDataFormat,
			nodeDataArray,
			linkDataArray,
			outboundMappedData,
			OutboundFormatData
		};
	} catch (err) {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapping", description: "catch " + err + " - Some error occurred while run mapping function.", exception_type: "System Error", item: ItemName, detail_exception: "catch " + err + " - Some error occurred while run mapping function.", request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Mapping", description: "catch " + err + " - Some error occurred while run mapping function.", request_id });

		return {
			code: "1",
			MsgCode: "500001",
			MsgType: "Exception-Error",
			MsgLang: "en",
			ShortMsg: "Fail",
			LongMsg: "catch " + err + " - Some error occurred while run mapping function.",
			InternalMsg: "",
			EnableAlert: "No",
			DisplayMsgBy: "LongMsg",
			Data: [],
			logQueueMsg: "Mapping Fail",
			logType: inboundEnableLog,
			httpStatus: 500
		};
	}
}

async function generateArrayChildKeys(outboundFormatDataArr, newLinkDataArr, inboundFormatData) {
	for (const outKey of Object.keys(newLinkDataArr)) {
		const inKey = newLinkDataArr[outKey];
		const inboundExists = inboundFormatData[inKey] !== undefined;
		const outboundVal = outboundFormatDataArr[outKey];

		if (!Array.isArray(outboundVal)) continue;
		if (!inboundExists) continue;

		const match = outKey.match(/@Out\{(.+?)\}/);
		if (!match) continue;

		const baseKey = match[1];

		for (let index = 0; index < outboundVal.length; index++) {
			const item = outboundVal[index];
			await generateChildKeysRecursive(item, `${baseKey}[${index}]`, outboundFormatDataArr, newLinkDataArr);
		}
	}
	return outboundFormatDataArr;
}

async function generateChildKeysRecursive(obj, currentPath, output, newLinkDataArr) {
	if (obj === null || typeof obj !== "object") return;

	for (const key of Object.keys(obj)) {
		const value = obj[key];
		const newPath = `${currentPath}.${key}`;
		const outKey = `@Out{${newPath}}`;

		const isChildMapped = newLinkDataArr[outKey] !== undefined;
		if (isChildMapped) continue;

		if (Array.isArray(value)) {
			if (value.every(v => typeof v !== "object")) {
				output[outKey] = value;
				continue;
			}

			for (let idx = 0; idx < value.length; idx++) {
				await generateChildKeysRecursive(value[idx], `${newPath}[${idx}]`, output, newLinkDataArr);
			}

		} else if (typeof value === "object") {
			await generateChildKeysRecursive(value, newPath, output, newLinkDataArr);

		} else {
			output[outKey] = value;
		}
	}
}

function splitNLevelPath(pathStr) {
	if (!pathStr || typeof pathStr !== 'string') {
		return [];
	}
	return pathStr
		.replace(/\]/g, '')
		.split(/\[|\./g)
		.filter(p => p !== '' && p !== undefined)
		.map(p => (isNaN(p) || p === '' ? p : parseInt(p)));
}

function expandSimpleMappingsToIndexed(simpleMap, inboundData, outboundData) {
	const expandedMappings = {};

	for (const [outKey, inKey] of Object.entries(simpleMap)) {
		const outPathMatch = outKey.match(/@Out{([^}]*)}/);
		const inPathMatch = inKey.match(/@In{([^}]*)}/);

		if (!outPathMatch || !inPathMatch) continue;

		const outParts = splitNLevelPath(outPathMatch[1]);
		const inParts = splitNLevelPath(inPathMatch[1]);

		// Detect inbound array info
		let inArrayIndex = -1, inArrayLength = 1;
		let inCurrent = inboundData;
		for (let i = 0; i < inParts.length; i++) {
			if (Array.isArray(inCurrent?.[inParts[i]])) {
				inArrayIndex = i;
				inArrayLength = inCurrent[inParts[i]].length;
				break;
			}
			inCurrent = inCurrent?.[inParts[i]];
		}

		// Detect outbound array info
		let outArrayIndex = -1, outArrayLength = 1;
		let outCurrent = outboundData;
		for (let i = 0; i < outParts.length; i++) {
			if (Array.isArray(outCurrent?.[outParts[i]])) {
				outArrayIndex = i;
				outArrayLength = outCurrent[outParts[i]].length;
				break;
			}
			outCurrent = outCurrent?.[outParts[i]];
		}

		const maxLength = Math.max(inArrayLength, outArrayLength);

		const inArrayExists = inArrayIndex >= 0;
		const outArrayExists = outArrayIndex >= 0;

		const isDirectArrayLink = (
			inArrayExists &&
			outArrayExists &&
			inArrayIndex === inParts.length - 1 &&
			outArrayIndex === outParts.length - 1
		);

		if (inArrayExists && !outArrayExists) {
			// keep direct mapping (don’t expand)
			expandedMappings[outKey] = inKey;
			continue;
		}


		if (!isDirectArrayLink) {
			// Expand for each index found
			for (let i = 0; i < maxLength; i++) {
				const newInParts = [...inParts];
				const newOutParts = [...outParts];

				if (inArrayIndex >= 0) newInParts.splice(inArrayIndex + 1, 0, i);
				if (outArrayIndex >= 0) newOutParts.splice(outArrayIndex + 1, 0, i);

				const newInKey = "@In{" + newInParts.map(p => typeof p === "number" ? `[${p}]` : `.${p}`).join("").replace(/^\./, "") + "}";
				const newOutKey = "@Out{" + newOutParts.map(p => typeof p === "number" ? `[${p}]` : `.${p}`).join("").replace(/^\./, "") + "}";

				expandedMappings[newOutKey] = newInKey;
			}
		} else {
			// No arrays, simple mapping
			const newInKey = "@In{" + inParts.map(p => typeof p === "number" ? `[${p}]` : `.${p}`).join("").replace(/^\./, "") + "}";
			const newOutKey = "@Out{" + outParts.map(p => typeof p === "number" ? `[${p}]` : `.${p}`).join("").replace(/^\./, "") + "}";

			expandedMappings[newOutKey] = newInKey;
		}
	}

	return expandedMappings;
}

function replaceToJson(obj) {
	if (Array.isArray(obj)) {
		return obj.map(item => replaceToJson(item));
	} else if (obj !== null && typeof obj === 'object') {
		if ('toJson' in obj) {
			return replaceToJson(obj['toJson']); // Replace with toJson content
		} else {
			const newObj = {};
			for (const [key, value] of Object.entries(obj)) {
				newObj[key] = replaceToJson(value);
			}
			return newObj;
		}
	} else {
		return obj; // Primitive values
	}
}

// Outbound mapping function
async function outboundMappingHandler(inboundPostData, inboundMappingData, outbound_api_options_body, responseData, mappingOutboundSettingData, outboundSettingData, outboundResponseData, inboundFormatData, propertiesOutboundSettingData, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, outboundPostDataFormat, OutboundFormatData, nodeDataArray, linkDataArray, outboundResponseDataUnkeyArr, outboundMappedData, xmlbodyreq, outboundResponseDataFormat, inboundFormatDataUnkeyArr, outboundFormatDataUnkeyArr, emailDdepInputPath = "", dataArrayReviseParentKey, dataArrayReviseArr, outboundFormatDataParentKey, mappingArrayMerged, queryString = "", enabledebug, enableError = "no", querystring = {}, header = {}, reqIn = [], reqOut = [], resIn = [], resOut = [], global = {}, request_id, reqMethod = "POST", endpointMeta, generalValues, enableDiffCheck, diffCheckReturnUrl, type, logdir, logdatefilename) {
	try {
		if (type == "Scheduler") {
			const todaydate = new Date();
			const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
			var prelogtest = prelog.replace("keywords", "not defined");
		}

		let outboundSetting = item.outbound_setting;

		console.log("\nOutbound Response Data:", outboundResponseData);

		if (type == "Scheduler") {
			await writelog(logdir + logdatefilename, prelogtest + "Outbound Response Data:" + " > " + JSON.stringify(outboundResponseData) + "\n");
		}

		inboundFormatData = await inboundreplacementformatdata(outboundResponseData, "@In{");
		console.log("\nInbound format convert to replacement Format:", inboundFormatData);

		if (type == "Scheduler") {
			await writelog(logdir + logdatefilename, prelogtest + "Inbound format convert to replacement Format:" + " > " + JSON.stringify(inboundFormatData) + "\n");
		}

		if (mappingOutboundSettingData != undefined && mappingOutboundSettingData.is_active != undefined && mappingOutboundSettingData.is_active == "Active" && mappingOutboundSettingData.outbound_format != "" && mappingOutboundSettingData.mapping_data != "") {

			const disableOutboundEmail = outboundSettingData?.specifyHeaders?.disableOutboundEmail || false;
			if (propertiesOutboundSettingData != undefined) {
				const itemsProperties = propertiesOutboundSettingData?.item_properties || [];
				let itemsPropertiesArr = [];
				if (itemsProperties.length > 0) {
					for (let i = 0; i < itemsProperties.length; i++) {
						if (itemsProperties[i] != "") {
							itemsPropertiesArr[itemsProperties[i].general.itemKey] = itemsProperties[i];
						}
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules", request_id });

					const propertiesAdditionalRules = await propertiesAdditionalRulesApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
					if (propertiesAdditionalRules.valid) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Rules Applied Successful" + "\n");
						}

						inboundFormatData = propertiesAdditionalRules.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula", request_id });

					dataArrayReviseParentKey = [];
					dataArrayReviseArr = {};
					const newInboundFormatData = await propertiesFormulaApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, nodeDataArray = [], dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
					if (!newInboundFormatData.valid) {
						let errorBody = {
							code: "1",
							MsgCode: newInboundFormatData.MsgCode,
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Properties Validation Fail",
							LongMsg: newInboundFormatData.longMsg,
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							Data: [],
							logQueueMsg: "Validation Fail",
							logType: outboundEnableLog,
							httpStatus: "200 OK"
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Error : " + newInboundFormatData.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

						if (enabledebug.toLowerCase() !== "true" && outboundSetting.enableEmail == "on" && !disableOutboundEmail) {
							const logDescription = generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: responseData, resTransformedBody: {} });
							await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, logDescription, disableOutboundEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, {}, errorBody, "400 - Bad Request (Validation Fail)", schedulerUniqueId, querystring, header);
						}

						return errorBody;
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Formula Applied Successful" + "\n");
						}

						inboundFormatData = newInboundFormatData.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation", request_id });

					const inboundPropertiesAdditionalValidation = await propertiesAdditionalValidationApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
					if (!inboundPropertiesAdditionalValidation.valid) {
						let errorBody = {
							code: "1",
							MsgCode: inboundPropertiesAdditionalValidation.MsgCode,
							MsgType: "Invalid-Source",
							MsgLang: "en",
							ShortMsg: "Properties Additional Validation Fail",
							LongMsg: inboundPropertiesAdditionalValidation.longMsg,
							InternalMsg: "",
							EnableAlert: "No",
							DisplayMsgBy: "LongMsg",
							Data: [],
							logQueueMsg: "Validation Fail",
							logType: outboundEnableLog,
							httpStatus: "200 OK"
						};

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Error : " + inboundPropertiesAdditionalValidation.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

						if (enabledebug.toLowerCase() !== "true" && outboundSetting.enableEmail == "on" && !disableOutboundEmail) {
							const logDescription = generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: responseData, resTransformedBody: {} });
							await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, logDescription, disableOutboundEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, {}, errorBody, "400 - Bad Request (Validation Fail)", schedulerUniqueId, querystring, header);
						}

						return errorBody;

					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Validation Applied Successful" + "\n");
						}

						inboundFormatData = inboundPropertiesAdditionalValidation.dataArray;
					}

					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Visibility" });

					const inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply = await propertiesAdditionalVisibilityHiddenRulesApply(companyCode, itemsPropertiesArr, inboundFormatData, [], "@In{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
					if (inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.valid) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Visibility Applied Successful", request_id });

						if (type == "Scheduler") {
							await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Visibility Applied Successful" + "\n");
						}

						inboundFormatData = inboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.dataArray;
					}
				}
			}

			let tempDataArr1 = JSON.parse(JSON.stringify(inboundFormatData));
			for (const key in tempDataArr1) {
				if (tempDataArr1[key] === 'THIS-KEY-REMOVE-BY-VISIBILTY-RULE') {
					tempDataArr1 = await deleteFormatKeyData(key, "@In{", tempDataArr1);
					delete tempDataArr1[key];
				}
			}
			inboundFormatData = tempDataArr1;

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Mapping Data", request_id });

			try {
				const inboundMappingFormatData = JSON.parse(mappingOutboundSettingData.outbound_format);

				inboundFormatDataUnkeyArr = false;
				if (Array.isArray(inboundMappingFormatData)) {
					inboundFormatDataUnkeyArr = true;
				}
			} catch (err) {
				parseString(mappingOutboundSettingData.outbound_format, function (err, result) {
					const inboundMappingFormatData = jsonOriginal(result);

					inboundFormatDataUnkeyArr = false;
					if (Array.isArray(inboundMappingFormatData)) {
						inboundFormatDataUnkeyArr = true;
					}
				});
			}

			outboundPostDataFormat = "json";
			try {
				OutboundFormatData = JSON.parse(mappingOutboundSettingData.outbound_format);

				outboundFormatDataUnkeyArr = false;
				if (Array.isArray(OutboundFormatData)) {
					outboundFormatDataUnkeyArr = true;
				}
			} catch (err) {
				parseString(mappingOutboundSettingData.outbound_format, function (err, result) {
					OutboundFormatData = jsonOriginal(result);

					outboundFormatDataUnkeyArr = false;
					if (Array.isArray(OutboundFormatData)) {
						outboundFormatDataUnkeyArr = true;
					}
				});
				outboundPostDataFormat = "xml";
			}

			let mapping_data = {};
			try {
				mapping_data = JSON.parse(mappingOutboundSettingData.mapping_data);
			} catch (err) {
				mapping_data = mappingOutboundSettingData.mapping_data;
			}

			nodeDataArray = mapping_data.nodeDataArray;
			linkDataArray = mapping_data.linkDataArray;

			const linkdataarray = linkDataArray;
			let newLinkDataArr = {};
			let newLinkDataArrCount = [];
			for (let i = 0; i < linkdataarray.length; i++) {
				if (Object.entries(linkdataarray[i]).length > 0) {
					if (linkdataarray[i].category != undefined && linkdataarray[i].category == "Mapping") {
						let linkdataarraykey = linkdataarray[i].to;
						let linkdataarraykeycount = checklinkdataarraykey(linkdataarraykey, newLinkDataArrCount);
						if (linkdataarraykeycount > 1) {
							linkdataarraykey += linkdataarraykeycount;
						}
						newLinkDataArr[linkdataarraykey] = linkdataarray[i].from;
						newLinkDataArrCount.push(linkdataarraykey);

						let fromKey = linkdataarray[i].from;
						for (let fromKeyI = 2; fromKeyI < 5001; fromKeyI++) {
							const newfromKey = fromKey + fromKeyI;
							if (inboundFormatData[newfromKey] !== undefined) {
								newLinkDataArr[linkdataarraykey + fromKeyI] = newfromKey;
								newLinkDataArrCount.push(linkdataarraykey);
							} else {
								break;
							}
						}
					}
				}
			}

			const sortedEntries = Object.entries(newLinkDataArr).sort(([keyA], [keyB]) => {
				const countDots = key => (key.match(/\./g) || []).length;
				const dotsA = countDots(keyA);
				const dotsB = countDots(keyB);
				if (dotsA !== dotsB) { return dotsA - dotsB; }
				return keyA.localeCompare(keyB);
			});

			const sortedMapping = Object.fromEntries(sortedEntries);
			newLinkDataArr = sortedMapping;

			newLinkDataArr = expandSimpleMappingsToIndexed(newLinkDataArr, responseData, OutboundFormatData);

			let mappingInbound = {};
			if (newLinkDataArrCount.length > 0) {

				let outboundFormatDataArr = {};

				outboundFormatDataArr = await inboundreplacementformatdata(OutboundFormatData, "@Out{");

				let tempDataArr = JSON.parse(JSON.stringify(outboundFormatDataArr));
				tempDataArr = await adjustArrayLengths(tempDataArr, newLinkDataArr, inboundFormatData, outboundFormatDataArr);
				outboundFormatDataArr = tempDataArr;

				let outboundArr = JSON.parse(JSON.stringify(tempDataArr));

				for (let key in outboundFormatDataArr) {
					const inKey = key.replace("@Out{", "@In{");
					const inboundValue = inboundFormatData[inKey];
					if (inboundValue !== undefined) {
						outboundFormatDataArr[key] = inboundValue;
					} else {
						let keys = Object.keys(newLinkDataArr).find(linkedKey => key == linkedKey);
						if (!keys) {
							outboundFormatDataArr[key] = null;
						}
					}
				}

				mappingInbound = outboundFormatDataArr;

				for (let outKey in newLinkDataArr) {
					let inKey = newLinkDataArr[outKey];
					if (!inKey.startsWith('@In{')) continue;

					let prefix = inKey.slice(0, -1);
					let inboundValue = inboundFormatData[inKey];

					// Find all keys in inboundFormatData that start with this prefix
					const matchingKeys = Object.keys(inboundFormatData).filter(k => k.startsWith(prefix));

					if (matchingKeys.length > 0) {
						for (let matchKey of matchingKeys) {
							const matchBase = matchKey.slice(0, -1);
							const regex = new RegExp(`^${matchBase}`);

							const foundOutKeys = Object.keys(newLinkDataArr).filter(ok =>
								regex.test(newLinkDataArr[ok])
							);

							if (foundOutKeys.length > 0) {
								for (let foundOutKey of foundOutKeys) {
									mappingInbound[foundOutKey] = inboundFormatData[matchKey] ?? null;
								}
							} else {
								mappingInbound[outKey] = inboundValue ?? null;
							}
						}
					} else {
						mappingInbound[outKey] = inboundValue ?? null;
					}
				}

				for (let outKey in newLinkDataArr) {
					const inKey = newLinkDataArr[outKey];
					if (inboundFormatData.hasOwnProperty(inKey)) {
						mappingInbound[outKey] = inboundFormatData[inKey];
					}
				}

				for (let key in newLinkDataArr) {
					let inboundValue = inboundFormatData[newLinkDataArr[key]];
					if (Array.isArray(inboundValue)) {
						const outboundArray = outboundArr[key];
						const mappingArray = mappingInbound[key];

						if (Array.isArray(outboundArray) && Array.isArray(mappingArray)) {
							for (let i = 0; i < outboundArray.length; i++) {
								const outboundItem = outboundArray[i];
								const mappingItem = mappingArray[i];

								// ensure both are non-null objects
								if (outboundItem && typeof outboundItem === "object" &&
									mappingItem && typeof mappingItem === "object") {

									const outboundKeys = Object.keys(outboundItem);
									outboundKeys.forEach(innerKey => {
										if (!Object.prototype.hasOwnProperty.call(mappingItem, innerKey)) {
											mappingItem[innerKey] = outboundItem[innerKey];
										}
									});
								}
							}
						}
					}
				}

				await processMapping(mappingInbound, newLinkDataArr, inboundFormatData, outboundFormatDataArr);

				let tempDataArr1 = JSON.parse(JSON.stringify(outboundFormatDataArr));
				tempDataArr1 = await adjustArrayWithoutLinkedLengths(inboundPostData, OutboundFormatData, tempDataArr1, newLinkDataArr);
				tempDataArr1 = await generateArrayChildKeys(outboundFormatDataArr, newLinkDataArr, inboundFormatData);
				outboundFormatDataArr = tempDataArr1;
				mappingInbound = outboundFormatDataArr;

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Mapping Data Successful", request_id });

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Mapping Data Successful" + "\n");
				}

				console.log("\nOutbound format convert to replacement Format:", outboundFormatDataArr);

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound format convert to replacement Format:" + JSON.stringify(outboundFormatDataArr) + "\n");
				}

				if (propertiesOutboundSettingData != undefined) {
					const itemsProperties = propertiesOutboundSettingData?.item_properties || [];
					let itemsPropertiesArr = [];

					if (itemsProperties != "" && itemsProperties != undefined && itemsProperties.length != undefined && itemsProperties.length > 0) {
						for (let i = 0; i < itemsProperties.length; i++) {
							itemsPropertiesArr[itemsProperties[i].general.itemKey] = itemsProperties[i];
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules", request_id });

						const propertiesAdditionalRules = await propertiesAdditionalRulesApply(companyCode, itemsPropertiesArr, outboundFormatDataArr, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
						if (propertiesAdditionalRules.valid) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Rules Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Rules Applied Successful" + "\n");
							}
							outboundFormatDataArr = propertiesAdditionalRules.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula", request_id });

						dataArrayReviseParentKey = [];
						dataArrayReviseArr = {};
						const newOutboundFormatData = await propertiesFormulaApply(companyCode, itemsPropertiesArr, outboundFormatDataArr, inboundFormatData, "@Out{", item, schedulerUniqueId, nodeDataArray, dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
						if (!newOutboundFormatData.valid) {
							let errorBody = {
								code: "1",
								MsgCode: newOutboundFormatData.MsgCode,
								MsgType: "Invalid-Source",
								MsgLang: "en",
								ShortMsg: "Properties Additional Validation Fail",
								LongMsg: newOutboundFormatData.longMsg,
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: [],
								logQueueMsg: "Validation Fail",
								logType: outboundEnableLog,
								httpStatus: "200 OK"
							};

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Error : " + newOutboundFormatData.longMsg, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

							if (enabledebug.toLowerCase() !== "true" && outboundSetting.enableEmail == "on" && !disableOutboundEmail) {
								const logDescription = generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: responseData, resTransformedBody: {} });
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, logDescription, disableOutboundEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, {}, errorBody, "400 - Bad Request (Validation Fail)", schedulerUniqueId, querystring, header);
							}

							return errorBody;
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Formula Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Formula Applied Successful" + "\n");
							}

							mappingInbound = newOutboundFormatData.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation", request_id });

						const outboundPropertiesAdditionalValidation = await propertiesAdditionalValidationApply(companyCode, itemsPropertiesArr, mappingInbound, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type);
						if (!outboundPropertiesAdditionalValidation.valid) {
							let errorBody = {
								code: "1",
								MsgCode: outboundPropertiesAdditionalValidation.MsgCode,
								MsgType: "Invalid-Source",
								MsgLang: "en",
								ShortMsg: "Properties Additional Validation Fail",
								LongMsg: outboundPropertiesAdditionalValidation.longMsg,
								InternalMsg: "",
								EnableAlert: "No",
								DisplayMsgBy: "LongMsg",
								Data: [],
								logQueueMsg: "Outbound Property Additional Validation Fail",
								logType: outboundEnableLog,
								httpStatus: "200 OK"
							};

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Error : " + outboundPropertiesAdditionalValidation.longMsgdatas, datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? JSON.stringify(errorBody) : "", request_id });

							if (enabledebug.toLowerCase() !== "true" && outboundSetting.enableEmail == "on" && !disableOutboundEmail) {
								const logDescription = generateLogDescriptionFormulaForMail({ logDescriptionTemplate: outboundSettingData?.specifyHeaders?.notificationEmailTitle || '', companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, body: inboundPostData, transformedBody: inboundMappingData, resBody: responseData, resTransformedBody: {} });
								await ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, 0, logDescription, disableOutboundEmail, emailDdepInputPath, inboundPostData, inboundMappingData, outbound_api_options_body, responseData, {}, errorBody, "400 - Bad Request (Validation Fail)", schedulerUniqueId, querystring, header);
							}

							return errorBody;
						} else {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Validation Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Validation Applied Successful" + "\n");
							}

							mappingInbound = outboundPropertiesAdditionalValidation.dataArray;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Property Additional Visibility", request_id });

						const outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply = await propertiesAdditionalVisibilityHiddenRulesApply(companyCode, itemsPropertiesArr, mappingInbound, inboundFormatData, "@Out{", item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
						if (outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.valid) {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "OutBound Apply", description: "OutBound Property Additional Visibility Applied Successful", request_id });

							if (type == "Scheduler") {
								await writelog(logdir + logdatefilename, prelogtest + "Outbound Property Additional Visibility Applied Successful" + "\n");
							}

							mappingInbound = outboundPropertiespropertiesAdditionalVisibilityHiddenRulesApply.dataArray;
						}
					}
				}

				outboundResponseDataUnkeyArr = false;
				if (Array.isArray(OutboundFormatData)) {
					const arrData = OutboundFormatData;
					OutboundFormatData = {};
					OutboundFormatData["items"] = arrData;
					outboundResponseDataUnkeyArr = true;
				}

				outboundFormatDataParentKey = [];
				mappingArrayMerged = [];
				outboundMappedData = outboundformatdata(OutboundFormatData, mappingInbound, newLinkDataArr, nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged);
				outboundMappedData = replaceToJson(outboundMappedData);
				outboundMappedData = removeKeyFromJson(outboundMappedData, "THIS-KEY-REMOVE-BY-VISIBILTY-RULE");
				console.log("\nOutbound Final Result:", outboundMappedData);

				let parsedData = safeJSONStringify(outboundMappedData, Config.dataSize);

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", request_id });

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Final Result:" + JSON.stringify(outboundMappedData) + "\n");
				}

				if (outboundResponseDataUnkeyArr && outboundResponseData.items != undefined) {
					outboundMappedData = outboundMappedData.items;
					outboundResponseDataUnkeyArr = false;
				}

				outboundResponseData = outboundMappedData;

				if (outboundPostDataFormat == "xml") {
					const builder = new xml2js.Builder();
					xmlbodyreq = builder.buildObject(outboundMappedData);
					outboundResponseData = xmlbodyreq;
				}
			} else {
				console.log("\nOutbound Final Result:", outboundResponseData);

				if (outboundResponseDataUnkeyArr && outboundResponseData.items != undefined) {
					outboundResponseData = outboundResponseData.items;
					outboundResponseDataUnkeyArr = false;
				}

				let parsedData = safeJSONStringify(outboundResponseData, Config.dataSize);

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Mapped Data", description: "Mapped Data", datas: (enableFullLogs == "on" || (enableLogs == "on" && outboundEnableLog == "on")) ? parsedData : "", request_id });

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Final Result:" + JSON.stringify(outboundMappedData) + "\n");
				}
			}

			// For Differnce checker function here
			const baseLogData = { companyCode, log_unique_id: schedulerUniqueId, log_request_id: request_id, item_id, ItemName: item.ItemName, type: "Outbound", path: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath };
			const diff_unique_id = uuidv4();
			const notifyBaseLogData = { ...baseLogData, unique_id: diff_unique_id, };

			try {
				let templateOutbound = outboundSettingData?.specifyHeaders?.templateOutbound || "";
				if (templateOutbound && enableDiffCheck == "on") {
					// templateOutbound = replacePlaceholders(templateOutbound, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
					templateOutbound = await processWebhookContent(templateOutbound, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundPostData, outboundMappedData, outboundResponseData, outboundMappedData, {}, {});
					templateOutbound = await formulaGetValue(companyCode, templateOutbound || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global);

					const diffResult = await lineByLineDiff(templateOutbound, outboundResponseData);
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

			return {
				code: "0",
				OutboundFormatData: mappingInbound,
				nodeDataArray,
				linkDataArray,
				outboundMappedData,
				outboundPostDataFormat,
				inboundFormatData,
				outboundResponseDataUnkeyArr,
				inboundFormatDataUnkeyArr,
				outboundFormatDataUnkeyArr,
				outboundResponseData
			}
		} else {
			if (outboundResponseDataUnkeyArr && outboundResponseData.items != undefined) {
				outboundResponseData = outboundResponseData.items;
				outboundResponseDataUnkeyArr = false;
			}

			if (outboundResponseDataFormat == "xml") {
				const builder = new xml2js.Builder();
				xmlbodyreq = builder.buildObject(outboundResponseData);
				outboundResponseData = xmlbodyreq;
			}

			// For Differnce checker function here
			const baseLogData = { companyCode, log_unique_id: schedulerUniqueId, log_request_id: request_id, item_id, ItemName: item.ItemName, type: "Outbound", path: "/" + config.ddepPrefix + "/" + companyCode + emailDdepInputPath };
			const diff_unique_id = uuidv4();
			const notifyBaseLogData = { ...baseLogData, unique_id: diff_unique_id, };

			try {
				let templateOutbound = outboundSettingData?.specifyHeaders?.templateOutbound || "";
				if (templateOutbound && enableDiffCheck == "on") {
					// templateOutbound = replacePlaceholders(templateOutbound, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
					templateOutbound = await processWebhookContent(templateOutbound, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, inboundPostData, outboundMappedData, outboundResponseData, outboundMappedData, {}, {});
					templateOutbound = await formulaGetValue(companyCode, templateOutbound || "POST", "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global);

					const diffResult = await lineByLineDiff(templateOutbound, outboundResponseData);
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

			return {
				code: "0",
				OutboundFormatData: {},
				nodeDataArray,
				linkDataArray,
				outboundMappedData,
				outboundPostDataFormat,
				inboundFormatData,
				outboundResponseDataUnkeyArr,
				inboundFormatDataUnkeyArr,
				outboundFormatDataUnkeyArr,
				outboundResponseData
			}
		}
	} catch (err) {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Mapping", description: "catch " + err + " - Some error occurred while run mapping function.", exception_type: "System Error", item: item.ItemName, detail_exception: "catch " + err + " - Some error occurred while run mapping function.", request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Mapping", description: "catch " + err + " - Some error occurred while run mapping function.", request_id });

		return {
			code: "1",
			MsgCode: "500001",
			MsgType: "Exception-Error",
			MsgLang: "en",
			ShortMsg: "Fail",
			LongMsg: "catch " + err + " - Some error occurred while run mapping function.",
			InternalMsg: "",
			EnableAlert: "No",
			DisplayMsgBy: "LongMsg",
			Data: [],
			logQueueMsg: "Mapping Fail",
			logType: outboundEnableLog,
			httpStatus: 500
		};
	}

}

// For additional rules function
async function propertiesAdditionalRulesApply(companyCode, itemsPropertiesArr, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues) {
	let longMsg = "";
	let propertiesAdditionalRules = true;
	const mappingSettingData = item.mapping_setting;
	const mappingOutboundSettingData = item.mapping_outbound_setting;

	let itemEnableLog = (mappingSettingData.enableLog != undefined) ? mappingSettingData.enableLog : "off";
	if (includesKey == "@Out{") {
		itemEnableLog = (mappingOutboundSettingData.enableLog != undefined) ? mappingOutboundSettingData.enableLog : "off";
	}

	const newDataArray = await applyAdditionalRules(companyCode, dataArray, inboundFormatData, itemsPropertiesArr, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);

	return {
		valid: propertiesAdditionalRules,
		longMsg: longMsg,
		dataArray: newDataArray
	};
}

async function updateFormatData(key, value, includeKey, inboundFormatData) {
	if (!key.startsWith(includeKey)) return inboundFormatData;

	if (key in inboundFormatData) {
		inboundFormatData[key] = value;
		return inboundFormatData;
	}

	const pathStr = key.substring(includeKey.length, key.length - 1);
	const pathParts = splitPath(pathStr);

	const baseKey = includeKey + pathParts[0] + '}';

	// If value is null, set it directly without wrapping
	if (value === null || value === '') {
		inboundFormatData[baseKey] = value;
		return inboundFormatData;
	}

	// Initialize baseKey if it doesn't exist
	if (!inboundFormatData[baseKey]) {
		inboundFormatData[baseKey] = typeof pathParts[1] === 'number' ? [] : {};
	}

	if (value === inboundFormatData[baseKey]) {
		return inboundFormatData;
	}

	let target = inboundFormatData[baseKey];

	if (typeof value === 'object' && value !== null) {
		try {
			value = structuredClone(value);
		} catch {
			value = JSON.parse(JSON.stringify(value));
		}
	}

	// Traverse to final nesting level
	for (let i = 1; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		const next = pathParts[i + 1];

		if (typeof target[part] !== 'object' || target[part] === null) {
			target[part] = typeof next === 'number' ? [] : {};
		}

		target = target[part];
	}

	target[pathParts[pathParts.length - 1]] = value;
	return inboundFormatData;
}

async function deleteFormatData(key, includeKey, inboundFormatData) {
	if (!key.startsWith(includeKey)) return inboundFormatData;

	const pathStr = key.substring(includeKey.length, key.length - 1);
	const pathParts = splitPath(pathStr);
	const baseKey = includeKey + pathParts[0] + '}';

	// Create root if not exists
	if (!inboundFormatData[baseKey]) {
		inboundFormatData[baseKey] = typeof pathParts[1] === 'number' ? [] : {};
	}

	let target = inboundFormatData[baseKey];

	// Traverse to final level
	for (let i = 1; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		const next = pathParts[i + 1];

		if (typeof target[part] !== 'object' || target[part] === null) {
			target[part] = typeof next === 'number' ? [] : {};
		}

		target = target[part];
	}

	// Set final key as marker
	const finalKey = pathParts[pathParts.length - 1];
	target[finalKey] = "THIS-KEY-REMOVE-BY-VISIBILTY-RULE";

	return inboundFormatData;
}

async function deleteFormatKeyData(key, includeKey, formatData) {
	if (!key.startsWith(includeKey)) return formatData;

	const pathStr = key.substring(includeKey.length, key.length - 1);
	const pathParts = splitPath(pathStr); // Example: ["datas", 0, "username"]
	const baseKey = includeKey + pathParts[0] + '}';

	if (!formatData[baseKey]) return formatData;

	let target = formatData[baseKey];

	// Traverse to the final target
	for (let i = 1; i < pathParts.length - 1; i++) {
		const part = pathParts[i];
		if (typeof target !== 'object' || target === null) return formatData;

		target = target[part];
		if (!target) return formatData;
	}

	const finalKey = pathParts[pathParts.length - 1];

	// Delete the nested property if it exists
	if (target && Object.prototype.hasOwnProperty.call(target, finalKey)) {
		delete target[finalKey];
	}

	return formatData;
}

function splitPath(pathStr) {
	return pathStr
		.replace(/\]/g, '')
		.split(/\[|\./g)
		.map(p => (isNaN(p) ? p : parseInt(p)));
}

async function applyAdditionalRules(companyCode, dataArray, inboundFormatData, itemsPropertiesArr, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues) {
	const normalizedPath = (path) => path.replace(/\[\d+\]/g, '');
	const findMatchingRules = (propertyPath) => {
		const normalized = normalizedPath(propertyPath);
		for (const [ruleKey, ruleValue] of Object.entries(itemsPropertiesArr)) {
			const ruleKeyResult = ruleKey.replace(includesKey, '').replace('}', '')
			if (normalized === ruleKeyResult) {
				return ruleValue.format?.additonal_rules || null;
			}
		}
		return null;
	};

	const output = { ...dataArray };

	for (const key of Object.keys(dataArray)) {
		if (!key.startsWith(includesKey) || !key.endsWith('}')) continue;

		const path = key.substring(includesKey.length, key.length - 1);
		const rules = findMatchingRules(path);
		if (!rules) continue;

		let value = dataArray[key];
		// Apply each rule
		for (const rule of rules) {
			if (rule.formulato) {
				const name = rule.name;
				const fromFormula = rule.formulato.replaceAll(normalizedPath(path), path);
				const toFormula = rule.formulatonew.replaceAll(normalizedPath(path), path);

				value = await propertiesAdditionalRulesApply1(value, name, fromFormula, toFormula, path, companyCode, output, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);

				const updatedData = await updateFormatData(key, value, includesKey, output);

				Object.assign(output, updatedData);
				output[key] = value;
			}
		}
	}

	return output;
}

// For additional rules function
async function propertiesAdditionalRulesApply1(itemdatavalue, name, formulato, formulatonew, currentPath, companyCode, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues) {
	if (name != "FORMULA TO" && formulato.startsWith("=")) {
		formulato = await processWebhookContent(formulato, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
		formulato = await formulaGetValue(companyCode, formulato, itemdatavalue, currentPath, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
	} else if (formulato != "") {
		formulato = replacePlaceholders(formulato, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
	}

	if (name != "FORMULA TO" && formulatonew.startsWith("=")) {
		formulatonew = await processWebhookContent(formulatonew, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
		formulatonew = await formulaGetValue(companyCode, formulatonew, itemdatavalue, currentPath, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
	} else if (formulatonew != "") {
		formulatonew = replacePlaceholders(formulatonew, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
	}

	formulato = (formulato != "") ? replacePlaceholdersInValidKeys(formulato, dataArray, inboundFormatData, querystring, header, global) : formulato;
	formulatonew = (formulatonew != "") ? replacePlaceholdersInValidKeys(formulatonew, dataArray, inboundFormatData, querystring, header, global) : formulatonew;

	if (name == "REPLACE" && formulato != "") {
		if (typeof itemdatavalue == "number") {
			itemdatavalue = itemdatavalue.toString();
		}
		if (typeof itemdatavalue == "string") {
			return itemdatavalue.replaceAll(formulato, formulatonew);
		}
		return itemdatavalue;
	} else if (name == "SUBSTRING" && formulato != "" && formulatonew != "") {
		const start = Math.max(0, Number(formulato) - 1);
		const end = Number(formulatonew);

		if (!isNaN(start) && !isNaN(end)) {
			return itemdatavalue.substring(start, end);
		} else {
			return itemdatavalue;
		}
	} else if (name == "To DATE" && formulato != "" && formulatonew != "") {
		let momentDate = moment(itemdatavalue, formulato, true);

		if (momentDate.isValid()) {
			let formattedDate = momentDate.format(formulatonew);
			return formattedDate;
		} else {
			return "Invalid date format";
		}
	} else if (name == "TRIM" && formulato != "") {
		formulato = formulato.toLowerCase();
		if (formulato == "true") {
			return itemdatavalue.trim();
		}
	} else if (name == "LEFT TRIM" && formulato != "") {
		formulato = formulato.toLowerCase();
		if (formulato == "true") {
			return itemdatavalue.trimLeft();
		}
	} else if (name == "RIGHT TRIM" && formulato != "") {
		formulato = formulato.toLowerCase();
		if (formulato == "true") {
			return itemdatavalue.trimRight();
		}
	} else if (name == "ADD WORDS ON THE BEGINING" && formulato != "") {
		formulato = await formulaGetValue(companyCode, formulato, itemdatavalue, currentPath, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
		return formulato + itemdatavalue;
	} else if (name == "ADD WORDS ON THE END" && formulato != "") {
		formulato = await formulaGetValue(companyCode, formulato, itemdatavalue, currentPath, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
		return itemdatavalue + formulato;
	} else if (name == "FORMULA TO" && formulato != "") {
		let result = await processWebhookContent(formulato, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
		result = await formulaGetValue(companyCode, result, itemdatavalue, currentPath, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);
		return result;
	}

	return itemdatavalue;
}

// For properties formula apply function
async function propertiesFormulaApply(companyCode, itemsPropertiesArr, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, nodeDataArray = [], dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type) {
	if (Object.entries(dataArray).length > 0) {
		let dataArray3 = await dataArrayRevise(companyCode, itemsPropertiesArr, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, nodeDataArray, dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues);
		if (dataArray3.valid == false) {
			return dataArray3;
		}
		dataArray = dataArray3.dataArray;
	}

	let longMsg = "";
	let propertiesValidation = true;

	function removeFirstArrayIndex(path) {
		return path.replace(/^\w+\[\d+\]/, match => match.replace(/\[\d+\]/, ''));
	}

	// Validate required properties
	for (const propKey in itemsPropertiesArr) {
		if (!propKey.startsWith(includesKey)) continue;

		const properties = itemsPropertiesArr[propKey];
		if (properties.validation?.isRequired !== "TRUE") continue;

		const trimmed = propKey.slice(includesKey.length, -1);

		let foundRequired = false;

		for (const dataKey in dataArray) {
			if (!dataKey.startsWith(includesKey)) continue;

			const dataKeyTrimmed = dataKey.slice(includesKey.length, -1);
			const dataPathWithoutFirstIndex = removeFirstArrayIndex(dataKeyTrimmed);

			if (dataPathWithoutFirstIndex === trimmed) {
				// Check if the value exists and is not null/undefined
				if (dataArray[dataKey] !== null && dataArray[dataKey] !== undefined && dataArray[dataKey] !== '') {
					foundRequired = true;
					break;
				}
			}
		}

		// If required field not found
		if (!foundRequired) {
			const pathInOut = includesKey === "@Out{" ? "Outbound" : "Inbound";
			longMsg = `Missing required column: ${includesKey}${trimmed}}`;

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type === "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: `${pathInOut} Apply`, description: `${pathInOut} Property formula apply`, exception_type: "Formula Error", item: item.ItemName, detail_exception: `Error Formula on Mapping > ${pathInOut} > ${includesKey}${trimmed}} > General > isRequired : ${longMsg}` });

			return {
				valid: false,
				longMsg,
				dataArray,
				MsgCode: "400006"
			};
		}
	}

	return {
		valid: propertiesValidation,
		longMsg,
		dataArray
	};
}

// For properties formula apply function
async function dataArrayRevise(companyCode, itemsPropertiesArr, dataArray1, inboundFormatData, includesKey, item, schedulerUniqueId, nodeDataArray, dataArrayReviseParentKey, dataArrayReviseArr, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues) {
	let validationFail = true;
	let validationResp = "";
	let MsgCode = "";

	for (let dataArrayKey in dataArray1) {
		// Reconstruct fullKey using parentKey context
		let firstKey = "";

		if (dataArrayReviseParentKey.length > 0) {
			const parentParts = dataArrayReviseParentKey.map(p => {
				if (p.startsWith("[")) return p; // e.g., [0]
				return p.replace(includesKey, "").replace("}", ""); // e.g., @In{datas - datas
			});

			const currentKey = dataArrayKey.replace(includesKey, "").replace("}", "");
			parentParts.push(currentKey);
			firstKey = parentParts.join(".");
		} else {
			firstKey = dataArrayKey.replace(includesKey, "").replace("}", "");
		}

		const fullKey = includesKey + firstKey + "}";

		if (!dataArray1.hasOwnProperty(fullKey)) {
			continue;
		}

		const value = dataArray1[fullKey];
		const isPrimitive = typeof value !== "object" || value === null;

		if (isPrimitive) {
			if (!dataArrayReviseArr.hasOwnProperty(fullKey)) {
				const result = await propertiesFormulaApply1(
					companyCode, itemsPropertiesArr, fullKey, value, dataArray1, inboundFormatData, includesKey,
					item, schedulerUniqueId, nodeDataArray, enableLogs, enableFullLogs, enableError,
					querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues
				);

				if (!result.valid) {
					validationResp = result.longMsg;
					validationFail = false;
					MsgCode = result.MsgCode;
				} else {

					const newValue = result.dataArrayValue;
					dataArrayReviseArr[fullKey] = newValue;

					// update nested version if needed
					const updatedData = await updateFormatData(fullKey, newValue, includesKey, dataArrayReviseArr);
					dataArrayReviseArr = updatedData;
				}
			}
		} else {
			// If object or array, assign directly (assume preprocessed)
			dataArrayReviseArr[fullKey] = value;
		}
	}

	return {
		valid: validationFail,
		longMsg: validationResp,
		MsgCode,
		dataArray: dataArrayReviseArr
	};
}

// For properties formula apply function
async function propertiesFormulaApply1(companyCode, itemsPropertiesArr, dataArrayKey, dataArrayValue, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, nodeDataArray, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues) {
	let longMsg = "";
	let propertiesValidation = true;
	let MsgCode = "";

	const normalizedPath = (path) => path.replace(/\[\d+\]/g, '');

	const findMatchingProperties = (path) => {
		const normalized = normalizedPath(path);
		for (const [ruleKey, ruleValue] of Object.entries(itemsPropertiesArr)) {
			const ruleKeyNormalized = normalizedPath(ruleKey.replace(includesKey, '').replace('}', ''));
			if (normalized === ruleKeyNormalized) {
				return ruleValue;
			}
		}
		return null;
	};

	const rawPath = dataArrayKey.replace(includesKey, '').replace('}', '');
	const properties = findMatchingProperties(rawPath);

	if (!properties) {
		return { valid: true, longMsg: '', dataArrayKey, dataArrayValue, MsgCode };
	}

	let pathInOut = includesKey === '@Out{' ? 'Outbound' : 'Inbound';
	const mappingSettingData = item.mapping_setting || {};
	const mappingOutboundSettingData = item.mapping_outbound_setting || {};
	let itemEnableLog = includesKey === '@Out{' ? mappingOutboundSettingData.enableLog : mappingSettingData.enableLog;
	itemEnableLog = itemEnableLog !== undefined ? itemEnableLog : 'off';

	let formula = properties.display?.value || '';
	formula = formula.replace(normalizedPath(dataArrayKey), dataArrayKey);
	dataArray[dataArrayKey] = dataArrayValue;

	// Apply formula if any
	if (!formula.startsWith('@') && formula.startsWith('=')) {
		formula = replacePlaceholders(formula, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
		formula = await processWebhookContent(formula, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
		dataArrayValue = await formulaGetValue(
			companyCode, formula, dataArrayValue, dataArrayKey, dataArray, inboundFormatData,
			includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError,
			querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
		);
	} else if (dataArrayValue !== null) {
		dataArrayValue = replacePlaceholders(formula, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
	} else {
		dataArrayValue = null;
	}

	// === VALIDATION RULES ===
	const validation = properties.validation || {};
	const isRequired = validation.isRequired;
	const valueMustbe = validation.valueMustbe;

	if (isRequired === 'TRUE' && (dataArrayValue === '' || dataArrayValue === null)) {
		longMsg = `Require value of ${dataArrayKey}.`;
		propertiesValidation = false;
		MsgCode = "400002";
		addToLogQueue({
			CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: `${pathInOut} Apply`, description: `${pathInOut} Property formula apply`, exception_type: "Formula Error", item: item.ItemName, detail_exception: `Error Formula on Mapping > ${pathInOut} > ${dataArrayKey} > General > isRequired : ${longMsg}`, request_id
		});
	}

	if (valueMustbe === 'NUMBER' && typeof dataArrayValue !== 'number') {
		longMsg = `value of ${dataArrayKey} must be number.`;
		MsgCode = "400008";
		propertiesValidation = false;
	} else if (valueMustbe === 'STRING' && typeof dataArrayValue !== 'string') {
		longMsg = `value of ${dataArrayKey} must be string.`;
		MsgCode = "400007";
		propertiesValidation = false;
	} else if (valueMustbe === 'DATE' && !(dataArrayValue instanceof Date)) {
		longMsg = `value of ${dataArrayKey} must be date.`;
		MsgCode = "400003"
		propertiesValidation = false;
	}

	if (!propertiesValidation && longMsg !== '') {
		addToLogQueue({
			CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: `${pathInOut} Apply`, description: `${pathInOut} Property formula apply`, exception_type: "Formula Error", item: item.ItemName, detail_exception: `Error Formula on Mapping > ${pathInOut} > ${dataArrayKey} > General > Mustbe ${valueMustbe} : ${longMsg}`, request_id
		});
	}

	// === FORMATTING RULES ===
	const format = properties.format || {};
	if (format.trim === 'TRUE' && typeof dataArrayValue === 'string') {
		dataArrayValue = dataArrayValue.trim();
	}

	if (format.enabeDecimal === 'TRUE') {
		const decimal = parseInt(format.decimal || '2', 10);
		if (!isNaN(decimal)) {
			const val = parseFloat(dataArrayValue);
			if (format.enableRounding === 'TRUE') {
				dataArrayValue = Number(val.toFixed(decimal));
			} else {
				const regex = new RegExp(`^-?\\d+(?:\\.\\d{0,${decimal}})?`, 'g');
				const match = val.toString().match(regex)?.[0];
				if (match) {
					const dotIndex = match.indexOf('.');
					if (dotIndex === -1) {
						dataArrayValue = match + '.' + '0'.repeat(decimal);
					} else {
						const pad = decimal - (match.length - dotIndex - 1);
						dataArrayValue = pad > 0 ? match + '0'.repeat(pad) : match;
					}
				}
			}
		}
	}

	// === TYPE CONVERSION ===
	const itemKey = properties.general?.itemKey;
	const record = nodeDataArray.find((item) => item.key === itemKey);
	if (record?.type === 'number' && typeof dataArrayValue === 'string') {
		dataArrayValue = stringToNumber(dataArrayValue);
	}

	// === DEFAULT VALUE ===
	let defaultValue = properties.display?.defaultValue;
	defaultValue = defaultValue.replace(normalizedPath(dataArrayKey), dataArrayKey);
	if (defaultValue != "" && (dataArrayValue == null || dataArrayValue == '' || dataArrayValue == 'null')) {
		let InboundDataValue = replacePlaceholders(defaultValue, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, schedulerUniqueId);
		InboundDataValue = await processWebhookContent(InboundDataValue, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
		InboundDataValue = await formulaGetValue(
			companyCode, InboundDataValue, dataArrayValue, dataArrayKey, dataArray, inboundFormatData,
			includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
		);
		if (record?.type === "string" && InboundDataValue === null) {
			InboundDataValue = "null";
		}
		dataArrayValue = InboundDataValue;
	}

	return {
		valid: propertiesValidation,
		longMsg,
		dataArrayKey,
		dataArrayValue,
		MsgCode
	};
}

// Apply HyperFormula function
async function formulaGetValue(companyCode, formula, dataArrayValue, dataArrayKey, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod) {
	let dataValuestrnumbool = "";
	let Irow = 1;
	let Icol = 0;
	let Acell = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
	let cellDataArr = [];

	if (typeof formula === "object" && formula != null) {
		return formula;
	}

	const formula1 = replacePlaceholders(formula, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);

	if (cleanAndValidateDate(formula1)) {
		return formula1.startsWith("=") ? formula1.substring(1).replace(/"/g, '') : formula1.replace(/"/g, '');
	} else {
		formula = replacePlaceholders(formula, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
	}

	for (let inbounddatakey in dataArray) {
		if (formula.includes(inbounddatakey)) {
			let newinboundvalue = dataArray[dataArrayKey];
			if (formula.includes("=HOUR(") || formula.includes("=MINUTE(") || formula.includes("=SECOND(")) {
				newinboundvalue = new Date("July 1, 1999, " + newinboundvalue);
			}
			if (formula.includes("=DATEDIF(") || formula.includes("=WEEKDAY(") || formula.includes("=DAYS(") || formula.includes("=DAYS360(") || formula.includes("=EDATE(")) {
				newinboundvalue = new Date(newinboundvalue);
			}
			formula = formula.replace('"' + dataArrayKey + '"', dataArrayKey);
			formula = formula.replace(dataArrayKey, Acell[Icol] + Irow);
			cellDataArr.push(newinboundvalue);
			if (Icol == 25) {
				Icol = 0;
				Irow++;
			} else {
				Icol++;
			}
		} else {
			if (formula.includes("=TODAY(") || formula.includes("=NOW(")) {
				let today = new Date();
				dataValuestrnumbool = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
				if (formula.includes("=NOW(")) {
					let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
					dataValuestrnumbool += " " + time;
				}
				return dataValuestrnumbool;
			}
		}
	}

	for (let queryStringdatakey in querystring) {
		let queryStringkey = `@querystring{${queryStringdatakey}}`;
		if (formula.includes(queryStringkey)) {
			let newinboundvalue = querystring[queryStringdatakey];
			if (formula.includes("=HOUR(") || formula.includes("=MINUTE(") || formula.includes("=SECOND(")) {
				newinboundvalue = new Date("July 1, 1999, " + newinboundvalue);
			}
			if (formula.includes("=DATEDIF(") || formula.includes("=WEEKDAY(") || formula.includes("=DAYS(") || formula.includes("=DAYS360(") || formula.includes("=EDATE(")) {
				newinboundvalue = new Date(newinboundvalue);
			}
			formula = formula.replace('"' + queryStringkey + '"', queryStringkey);
			formula = formula.replace(queryStringkey, Acell[Icol] + Irow);
			cellDataArr.push(newinboundvalue);
			if (Icol == 25) {
				Icol = 0;
				Irow++;
			} else {
				Icol++;
			}
		} else {
			if (formula.includes("=TODAY(") || formula.includes("=NOW(")) {
				let today = new Date();
				dataValuestrnumbool = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
				if (formula.includes("=NOW(")) {
					let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
					dataValuestrnumbool += " " + time;
				}
				return dataValuestrnumbool;
			}
		}
	}

	for (let headerdatakey in header) {
		let headerkey = `@header{${headerdatakey}}`;
		if (formula.includes(headerkey)) {
			let newinboundvalue = header[headerdatakey];
			if (formula.includes("=HOUR(") || formula.includes("=MINUTE(") || formula.includes("=SECOND(")) {
				newinboundvalue = new Date("July 1, 1999, " + newinboundvalue);
			}
			if (formula.includes("=DATEDIF(") || formula.includes("=WEEKDAY(") || formula.includes("=DAYS(") || formula.includes("=DAYS360(") || formula.includes("=EDATE(")) {
				newinboundvalue = new Date(newinboundvalue);
			}
			formula = formula.replace('"' + headerkey + '"', headerkey);
			formula = formula.replace(headerkey, Acell[Icol] + Irow);
			cellDataArr.push(newinboundvalue);
			if (Icol == 25) {
				Icol = 0;
				Irow++;
			} else {
				Icol++;
			}
		} else {
			if (formula.includes("=TODAY(") || formula.includes("=NOW(")) {
				let today = new Date();
				dataValuestrnumbool = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
				if (formula.includes("=NOW(")) {
					let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
					dataValuestrnumbool += " " + time;
				}
				return dataValuestrnumbool;
			}
		}
	}

	if (Object.entries(inboundFormatData).length > 0) {
		for (let inbounddatakey in inboundFormatData) {
			if (formula.includes(inbounddatakey)) {
				let newinboundvalue = inboundFormatData[dataArrayKey];
				if (formula.includes("=HOUR(") || formula.includes("=MINUTE(") || formula.includes("=SECOND(")) {
					newinboundvalue = new Date("July 1, 1999, " + newinboundvalue);
				}
				if (formula.includes("=DATEDIF(") || formula.includes("=WEEKDAY(") || formula.includes("=DAYS(") || formula.includes("=DAYS360(") || formula.includes("=EDATE(")) {
					newinboundvalue = new Date(newinboundvalue);
				}
				formula = formula.replace('"' + dataArrayKey + '"', dataArrayKey);
				formula = formula.replace(dataArrayKey, Acell[Icol] + Irow);
				cellDataArr.push(newinboundvalue);
				if (Icol == 25) {
					Icol = 0;
					Irow++;
				} else {
					Icol++;
				}
			} else {
				if (formula.includes("=TODAY(") || formula.includes("=NOW(")) {
					let today = new Date();
					dataValuestrnumbool = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
					if (formula.includes("=NOW(")) {
						let time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
						dataValuestrnumbool += " " + time;
					}
					return dataValuestrnumbool;
				}
			}
		}
	}

	formula = wrapDynamicPlaceholders(formula);

	if (formula.trim().startsWith('={') || formula.trim().startsWith('=[')) {
		try {
			const parsedValue = JSON.parse(formula.substring(1));
			return parsedValue;
		} catch (e) {
			return formula;
		}
	}

	if (formula.includes(":") && (formula.match(/:/g) || []).length > 1 && formula.match(/\)$/) && !formula.includes("=toJson") && !formula.includes("=toJson2") && !formula.includes("stringEncode") && !formula.includes("JSON_PARSE") && !formula.includes("BASE64ENCODE") && !formula.includes("BASE64DECODE")) {
		let lastcol = Icol - 1;
		let startindex = formula.indexOf(":") - 2;
		let lastindex = formula.lastIndexOf(":") + 3;
		let betweenstring = formula.substring(startindex, lastindex);
		formula = formula.replace(betweenstring, "A1:" + Acell[lastcol] + Irow);
	}

	function makeHyperFormulaString(input) {
		if (input.startsWith('"') && input.endsWith('"')) {
			input = input.slice(1, -1);
		}

		// Escape inner quotes for HyperFormula
		const escaped = input.replace(/"/g, '\\"');
		return `"${escaped}"`;
	}

	['stringEncode', 'BASE64ENCODE', 'BASE64DECODE'].forEach(fnName => {
		if (formula.includes(`${fnName}(`)) {
			const regex = new RegExp(`${fnName}\\((.*)\\)`, 's');
			const match = formula.match(regex);
			if (match && match[1]) {
				const rawArg = match[1].trim();
				const safeArg = makeHyperFormulaString(rawArg);
				formula = formula.replace(match[1], safeArg);
			}
		}
	});

	cellDataArr.push(formula);
	let data = [cellDataArr];

	let hfInstance = HyperFormula.buildFromArray(data, HyperFormulaOptions);
	let icol = Icol;
	let irow = (Irow == 1) ? 0 : Irow;
	let mySum = hfInstance.getCellValue({ col: icol, row: irow, sheet: 0 });

	if (typeof mySum == "object" && mySum == null) {
		dataValuestrnumbool = mySum;
	} else if (typeof mySum == "string" && mySum == "null") {
		dataValuestrnumbool = null;
	} else if (mySum["type"] == undefined) {
		dataValuestrnumbool = mySum;
	} else {
		let pathInOut = "Inbound";
		if (includesKey == "@Out{") {
			pathInOut = "Outbound";
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property formula apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + formula + " > General > Default Value : " + JSON.stringify(mySum), request_id });

		if (enableError.toLowerCase() == "true") {
			dataValuestrnumbool = JSON.stringify(mySum);
		} else {
			dataValuestrnumbool = dataArrayValue
		}
	}

	return dataValuestrnumbool;
}

// For additional validation apply function
async function propertiesAdditionalValidationApply(companyCode, itemsPropertiesArr, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, generalValues, type) {
	let longMsg = "";
	let MsgCode = "";
	let propertiesValidation = true;
	const normalizedPath = (path) => path.replace(/\[\d+\]/g, '');

	const mappingSettingData = item.mapping_setting || {};
	const mappingOutboundSettingData = item.mapping_outbound_setting || {};
	const pathInOut = includesKey === '@Out{' ? 'Outbound' : 'Inbound';
	const itemEnableLog = includesKey === '@Out{'
		? (mappingOutboundSettingData.enableLog ?? 'off')
		: (mappingSettingData.enableLog ?? 'off');

	for (const [key, value] of Object.entries(dataArray)) {
		if (!key.startsWith(includesKey) || !key.endsWith('}')) continue;

		const path = normalizedPath(key);
		const property = itemsPropertiesArr[path];

		if (!property?.validation?.additonal_rules?.length || value === undefined) continue;

		let itemDataValue = value;

		if (typeof value === 'string' && isNaN(value) && value !== null) {
			itemDataValue = value.toLowerCase();
		}
		const additonalRules = property.validation.additonal_rules;
		let conditionsValue = "";
		let andCondition = '', orCondition = '', andContainsString = '', andContainsValue = '', orContainsString = '', orContainsValue = '';
		let replaceCount = 0;
		for (const rule of additonalRules) {
			let original = rule.original;
			if (typeof original === 'string' && original.includes(path)) {
				original = original.replaceAll(path, key);
			}
			if (!original) continue;
			let { column, logical, operations, then: rulethen, formula: ruleformula } = rule;

			original = replacePlaceholders(original, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
			original = await processWebhookContent(original, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
			original = await formulaGetValue(companyCode, original, original, key, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			column = replacePlaceholders(column, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
			column = await processWebhookContent(column, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
			column = await formulaGetValue(companyCode, column, column, key, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			original = typeof original == "string" ? original.replace(/['"]+/g, '') : original;
			column = typeof column == "string" ? column.replace(/['"]+/g, '') : column;

			function cleanValue(value) {
				if (typeof value === "boolean") {
					return value.toString();
				}
				if (typeof value === "string" && !isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				if (!isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				return value;
			}

			column = cleanValue(column);
			original = cleanValue(original);

			if (operations == "<>") operations = "!=";

			if (logical == "AND" && operations != "Contains") {
				if (andCondition != "") { andCondition += " && "; conditionsValue += " && "; }
				andCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations != "Contains") {
				if (orCondition != "") { orCondition += " || "; conditionsValue += " || "; }
				orCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "AND" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " && "; }
				andContainsString = original;
				andContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " || "; }
				orContainsString = original;
				orContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			let inbounddatakey = original;

			replaceCount++;
			if (andCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andCondition = andCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (andContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andContainsString = andContainsString.replace(original, inboundFormatData[original]);
				}
			}

			if (orCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orCondition = orCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (orContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orContainsString = orContainsString.replace(original, inboundFormatData[original]);
				}
			}

			let andContainsValid = true;
			if (andContainsString != "" && andContainsValue != "") {
				andContainsValue = andContainsValue.toLowerCase();
				andContainsValid = andContainsString.includes(andContainsValue);
			}

			let orContainsValid = false;
			if (orContainsString != "" && orContainsValue != "") {
				orContainsValue = orContainsValue.toLowerCase();
				orContainsValid = orContainsString.includes(orContainsValue);
			}

			let andValid = true;
			if (andCondition != "") {
				let andConditionValid = eval(andCondition);

				if (andConditionValid && andContainsValid) {
					andValid = true;
				} else {
					andValid = false;
				}
			}

			let orValid = true;
			if (orCondition != "") {
				let orConditionValid = eval(orCondition);
				if (orConditionValid || orContainsValid) {
					orValid = true;
				} else {
					orValid = false;
				}
			}

			if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if ((andValid && andContainsValid) || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (andValid || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andValid && andContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString == "") {
				if (andValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = ruleformula;
						} else {
							fieldName = key;
							longMsg = fieldName + " field not valid data.";
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });

						propertiesValidation = false;
						break;
					} else {
						if (rulethen == "SKIP") {
							if (ruleformula != "") {
								longMsg = ruleformula;
							} else {
								fieldName = key;
								longMsg = fieldName + " field not valid data.";
							}
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: pathInOut + " Property additonal validations apply", exception_type: "Formula Error", item: item.ItemName, detail_exception: "Error Formula on Mapping > " + pathInOut + " > " + key + " > Properties > Additional Rules : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Fail", request_id });
						}

						propertiesValidation = false;
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Apply", description: conditionsValue + " = Pass", request_id });
				}
			}
		}

		if (!propertiesValidation) {
			propertiesValidation = false;
			MsgCode = "400009";
			break;
		}
	}

	return {
		valid: propertiesValidation,
		longMsg: longMsg,
		MsgCode,
		dataArray: dataArray
	};
}

// For additional visibility hidden rules apply function
async function propertiesAdditionalVisibilityHiddenRulesApply(companyCode, itemsPropertiesArr, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, endpointMeta, generalValues) {
	let longMsg = "";
	let propertiesValidation = true;
	const mappingSettingData = item.mapping_setting;
	const mappingOutboundSettingData = item.mapping_outbound_setting;

	let pathInOut = "Inbound";
	let itemEnableLog = mappingSettingData?.enableLog ?? "off";
	if (includesKey === "@Out{") {
		pathInOut = "Outbound";
		itemEnableLog = mappingOutboundSettingData?.enableLog ?? "off";
	}

	function isEmpty(value) {
		return (
			value === "" ||
			value == null ||
			(Array.isArray(value) && value.length === 0) ||
			(typeof value === "object" && value !== null && Object.keys(value).length === 0) ||
			(typeof value === "number" && isNaN(value))
		);
	}

	const normalizedPath = (path) => path.replace(/\[\d+\]/g, '');

	async function processMatchingKeys(dataArray, itemsPropertiesArr) {
		let updatedDataArray = { ...dataArray };

		for (const fullKey in updatedDataArray) {
			if (!fullKey.startsWith(includesKey)) continue;
			const value = updatedDataArray[fullKey];
			const normalizedKey = normalizedPath(fullKey);
			const properties = itemsPropertiesArr[normalizedKey];

			if (properties) {
				if (properties?.visibility?.hiddenWhenEmpty === "TRUE" && isEmpty(value)) {
					updatedDataArray = await deleteFormatData(fullKey, includesKey, updatedDataArray);
					updatedDataArray[fullKey] = "THIS-KEY-REMOVE-BY-VISIBILTY-RULE";
				}

				const response = await additionalVisibilityRulesApply(companyCode, properties, normalizedKey, fullKey, value, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, endpointMeta, generalValues);

				if (response.valid) {
					updatedDataArray = await deleteFormatData(fullKey, includesKey, updatedDataArray);
					updatedDataArray[fullKey] = "THIS-KEY-REMOVE-BY-VISIBILTY-RULE";
				}
			}
		}
		return updatedDataArray;
	}

	const updatedDataArray = await processMatchingKeys(dataArray, itemsPropertiesArr);

	return {
		valid: propertiesValidation,
		longMsg: longMsg,
		dataArray: updatedDataArray
	};
}

// For additional visibility hidden rules apply function
async function additionalVisibilityRulesApply(companyCode, properties, mainkey, itemsPropertiesArrkey, itemdatavalue, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, endpointMeta, generalValues) {
	let propertiesValidation = false;

	const mappingSettingData = item.mapping_setting;
	const mappingOutboundSettingData = item.mapping_outbound_setting;

	let pathInOut = "Inbound";
	let itemEnableLog = (mappingSettingData.enableLog != undefined) ? mappingSettingData.enableLog : "off";
	if (includesKey == "@Out{") {
		pathInOut = "Outbound";
		itemEnableLog = (mappingOutboundSettingData.enableLog != undefined) ? mappingOutboundSettingData.enableLog : "off";
	}

	let additionalRules = (properties && properties.visibility && properties.visibility.hidden_rules) || [];
	if (additionalRules != "" && additionalRules != undefined && additionalRules.length != undefined) {
		let tempCondition = "";
		let finalCondition = "";
		for (let i = 0; i < additionalRules.length; i++) {
			if (additionalRules[i].original) {
				let original = additionalRules[i].original;
				let column = additionalRules[i].column;

				original = original.split(mainkey).join(itemsPropertiesArrkey);
				column = column.split(mainkey).join(itemsPropertiesArrkey);

				original = replacePlaceholders(original, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
				original = await processWebhookContent(original, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
				original = await formulaGetValue(companyCode, original, original, itemsPropertiesArrkey, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod);

				column = replacePlaceholders(column, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
				column = await processWebhookContent(column, companyCode, dataArray, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, generalValues?.inboundPostData || {}, generalValues?.inboundMappingData || {}, generalValues?.body || {}, generalValues?.resTransfromBody || {}, {}, endpointMeta);
				column = await formulaGetValue(companyCode, column, column, itemsPropertiesArrkey, dataArray, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod);

				original = typeof original == "string" ? original.replace(/['"]+/g, '') : original;
				column = typeof column == "string" ? column.replace(/['"]+/g, '') : column;

				let logical = additionalRules[i].logical;
				let operations = additionalRules[i].operations;

				function cleanValue(value) {
					if (typeof value === "boolean") {
						return value.toString();
					}
					if (typeof value === "string" && !isNaN(value)) {
						if (value) {
							return Number(value);
						}
					}
					if (!isNaN(value)) {
						if (value) {
							return Number(value);
						}
					}
					return value;
				}

				original = cleanValue(original);
				column = cleanValue(column);

				let isNumeric = !isNaN(original) && !isNaN(column);

				if (operations == "<>") {
					operations = "!=";
				}

				let conditionStr;
				if (operations === "Contains") {
					conditionStr = `"${original}".includes("${column}")`;
				} else if (isNumeric && [">", ">=", "<", "<=", "==", "!="].includes(operations)) {
					conditionStr = `${original} ${operations} ${column}`;
				} else {
					conditionStr = `"${original}" ${operations} "${column}"`;
				}

				if (i === 0) {
					tempCondition = conditionStr;
				} else if (logical === "OR") {
					tempCondition = `${tempCondition} || ${conditionStr}`;
				} else {
					tempCondition = `${tempCondition} && ${conditionStr}`;
				}
			}
		}

		if (tempCondition) {
			finalCondition = tempCondition ? "(" + tempCondition + ")" : tempCondition;
			propertiesValidation = eval(finalCondition);
		}

	}

	return { valid: propertiesValidation };
}

// For orignal format convert data function outboundformatdata
function outboundformatdata(OutboundData, dataArr, newLinkDataArr, nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged) {
	let outboundFormatData = {};
	let dataValuestrnumbool = "";

	OutboundData = mergeOutboundWithMapping(OutboundData, dataArr);

	Object.entries(OutboundData).forEach((entry) => {
		let [key, value] = entry;

		let firstKey = "";
		if (outboundFormatDataParentKey.length != 0) {
			for (let i = 0; i < outboundFormatDataParentKey.length; i++) {
				if (outboundFormatDataParentKey[i] >= 0) {
					firstKey = firstKey + "[" + outboundFormatDataParentKey[i] + "]";
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}
					firstKey = firstKey + outboundFormatDataParentKey[i];
				}
			}

			if (firstKey != "") {
				if (key >= 0) {
					firstKey = firstKey + "[" + key + "]";
				} else {
					firstKey = firstKey + "." + key;
				}
			} else {
				firstKey = key;
			}
		} else {
			firstKey = key;
		}

		if (!Array.isArray(value) && value != null && typeof value === "object") {
			if (dataArr["@Out{" + firstKey + "}"] != undefined) {
				let isArray = Array.isArray(dataArr["@Out{" + firstKey + "}"]);
				let inType = (isArray ? "array" : typeof dataArr["@Out{" + firstKey + "}"]);
				dataValuestrnumbool = {};
				if (inType === "string" && dataArr["@Out{" + firstKey + "}"] === "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				} else if (inType === "string" || inType === "integer" || inType === "number" || inType === "boolean") {
					dataValuestrnumbool[key] = dataArr["@Out{" + firstKey + "}"];
				} else {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				}

				let secondObject = {};
				secondObject[key] = dataValuestrnumbool;
				outboundFormatData = Object.assign(outboundFormatData, secondObject);
				value = dataValuestrnumbool;
			}

			let objval = {};
			outboundFormatDataParentKey.push(key);
			if (typeof value === 'object' && value !== null) {
				objval = outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, value, dataArr, newLinkDataArr);
			} else {
				objval = value;
			}
			outboundFormatDataParentKey.pop();

			function isParentLinked1(key, linkMap) {
				if (!key.includes('.')) return linkMap.hasOwnProperty(key);
				const lastDot = key.lastIndexOf('.');
				const parentKey = key.substring(0, lastDot) + '}';
				return linkMap.hasOwnProperty(parentKey) && isParentLinked1(parentKey, linkMap);
			}

			function isAnyChildLinked1(path, linkMap) {
				for (const k in linkMap) {
					if (k.startsWith(`@Out{${path}.`) || k === `@Out{${path}}` || k.startsWith(`@Out{${path}[`)) {
						return true;
					}
				}
				return false;
			}

			function getTypeFromOutboundData1(path, data) {
				let current = data;
				const keys = path.split(".");
				for (let key of keys) {
					if (current && typeof current === 'object' && key in current) {
						current = current[key];
					} else {
						return { fullKey: path, type: 'not_found' };
					}
				}
				if (Array.isArray(current)) return { fullKey: path, type: 'array' };
				if (typeof current === 'object') return { fullKey: path, type: 'object' };
				return { fullKey: path, type: 'scalar' };
			}

			if (dataArr["@Out{" + firstKey + "}"] === null) {
				let startWithKey = "@Out{" + firstKey + ".";
				const newValue = {};
				const hasMatchingKey = Object.keys(dataArr).some(k => k.startsWith(startWithKey));

				function applyOutValue(key, value, finalObj, newLinkDataArr, OutboundData) {
					if (!key.startsWith('@Out{') || !key.endsWith('}')) return;
					const rawPath = key.slice(5, -1);

					const pathSegments = [];
					const regex = /([^[.\]]+)|\[(\d+)\]/g;
					let match;
					while ((match = regex.exec(rawPath))) {
						if (match[1]) pathSegments.push(match[1]); // property name
						else if (match[2]) pathSegments.push(Number(match[2])); // array index
					}

					let current = finalObj;
					let parents = [];
					let keysPath = [];

					for (let i = 0; i < pathSegments.length - 1; i++) {
						const key = pathSegments[i];
						const currentPath = pathSegments.slice(0, i + 1).join('.');
						const typeInfo = getTypeFromOutboundData1(currentPath, OutboundData);

						parents.push(current);
						keysPath.push(key);

						if (typeof key === 'number') {
							// if array doesn't exist, create
							const prevKey = keysPath[keysPath.length - 2];
							if (!Array.isArray(current)) {
								current[prevKey] = [];
								current = current[prevKey];
							}
							if (!current[key]) current[key] = {};
							current = current[key];
						} else if (typeof current === 'string' || current == "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
							return current;
						} else {
							if (!(key in current)) {
								current[key] = (typeInfo.type === 'array') ? [] : {};
							}
							current = current[key];
						}

						if (current === null) return;
					}

					const lastKey = pathSegments[pathSegments.length - 1];
					const fullKey = '@Out{' + rawPath + '}';
					const isLinked = newLinkDataArr[fullKey] !== undefined || isParentLinked1(fullKey, newLinkDataArr);
					const hasValue = value !== null && value !== undefined;

					if (!isLinked && !hasValue && !isAnyChildLinked1(rawPath, newLinkDataArr)) {
						// current[lastKey] = value;
						current[lastKey] = value;
					}

					let shouldSetNull = !isLinked && !hasValue;

					// SET FINAL VALUE
					if (typeof lastKey === 'number') {
						if (!Array.isArray(current)) return;
						let updatedValue = findValueJson(lastKey, objval);
						// current[lastKey] = value;
					} else {
						if (isLinked || hasValue) {
							let updatedValue = findValueJson(lastKey, objval);
							current[lastKey] = updatedValue === undefined ? value : updatedValue;
							// current[lastKey] = value;
						} else {
							shouldSetNull = true;
						}
					}

					// CLEAN UP IF NEEDED
					if (shouldSetNull) {
						for (let p = parents.length - 1; p >= 0; p--) {
							const parent = parents[p];
							const key = keysPath[p];
							const path = pathSegments.slice(0, p + 1).join('.');

							if (isAnyChildLinked1(path, newLinkDataArr)) break;

							const val = parent[key];
							const isEmpty = val === null ||
								(typeof val === 'object' && Object.keys(val).length === 0);

							if (isEmpty) {
								parent[key] = null;
							} else {
								break;
							}
						}
					}
				}

				Object.keys(dataArr).forEach(k => {
					const value = dataArr[k];
					applyOutValue(k, value, newValue, newLinkDataArr, OutboundData);

				});

				objval = hasMatchingKey ? newValue[firstKey] || newValue : null;
			} else if (dataArr["@Out{" + firstKey + "}"] === undefined) {
				objval = value;
			}
			let firstObject = {};
			firstObject[key] = objval;
			outboundFormatData = Object.assign(outboundFormatData, firstObject);
		} else if (Array.isArray(value) && typeof value === "object") {
			if (dataArr["@Out{" + firstKey + "}"] != undefined) {
				let isArray = Array.isArray(dataArr["@Out{" + firstKey + "}"]);
				let inType = (isArray ? "array" : typeof dataArr["@Out{" + firstKey + "}"]);
				dataValuestrnumbool = [];

				if (inType === "object") {
					dataValuestrnumbool.push(dataArr["@Out{" + firstKey + "}"]);
				} else if (inType === "array") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				} else if (inType === "boolean") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				} else if (inType === "string" && dataArr["@Out{" + firstKey + "}"] === "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				} else {
					let newObject = {};
					let newKey = newLinkDataArr["@Out{" + firstKey + "}"].replace("@In{", "").replace(/}$/, "");
					if (newKey === undefined) {
						newKey = key;
					}
					newObject[newKey] = dataArr["@Out{" + firstKey + "}"];
					dataValuestrnumbool.push(newObject);
				}

				for (let i = 0; i < value.length; i++) {
					let indexedKey = "@Out{" + firstKey + "[" + i + "]}";
					if (dataArr[indexedKey] != undefined) {
						let isArray1 = Array.isArray(dataArr[indexedKey]);
						let inType1 = (isArray1 ? "array" : typeof dataArr[indexedKey]);
						if (inType1 === "object") {
							let newObject = {};
							let newKey = newLinkDataArr[indexedKey]?.replace("@In{", "").replace(/}$/, "") || key;
							newObject[newKey] = dataArr[indexedKey];
							dataValuestrnumbool.push(dataArr[indexedKey]);
						} else if (inType1 === "array") {
							let dataArrlength = dataArr[indexedKey];
							for (let q = 0; q < dataArrlength.length; q++) {
								dataValuestrnumbool.push(dataArrlength[q]);
							}
						} else {
							let newObject = {};
							let newKey = newLinkDataArr[indexedKey]?.replace("@In{", "").replace(/}$/, "") || key;
							newObject[newKey] = dataArr[indexedKey];
							dataValuestrnumbool = newObject
							// dataValuestrnumbool.push(newObject);
						}
					}
				}

				let secondObject = {};
				if (key >= 0) {
					outboundFormatData = dataValuestrnumbool;
				} else {
					secondObject[key] = dataValuestrnumbool;
					outboundFormatData = Object.assign(outboundFormatData, secondObject);
				}
			}

			if (dataValuestrnumbool != "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
				let emptyArr = [];
				let objval = {};
				outboundFormatDataParentKey.push(key);
				let vararrdata = outboundFormatData[key] != undefined ? outboundFormatData[key] : value;

				if (typeof value === 'object' && value !== null) {
					objval = outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, vararrdata, dataArr, newLinkDataArr, vararrdata.length, 1);
				} else {
					objval = value;
				}

				outboundFormatDataParentKey.pop();

				const targetObj = dataArr["@Out{" + firstKey + "}"];

				// helper to normalize objval into array
				const normalizeToArray = (val) => {
					let arr = [];
					Object.entries(val).forEach(([k, v]) => {
						if (k >= 0 && !Array.isArray(v)) {
							arr.push(v);
						} else if (Array.isArray(v)) {
							arr.push(...v);
						}
					});
					return arr;
				};

				// check if newLinkDataArr has any mapping for this key
				const hasNewLinkKey = newLinkDataArr.hasOwnProperty("@Out{" + firstKey + "}")
				if (targetObj && typeof targetObj === "object") {
					if ("toJson" in targetObj) {
						let firstObject = {};
						firstObject[key] = targetObj;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					} else {
						let objfirst = {};
						objfirst[key] = normalizeToArray(objval);
						outboundFormatData = Object.assign(outboundFormatData, objfirst);
					}
				} else if (targetObj === null && !hasNewLinkKey) {
					if (
						((dataArr["@Out{" + firstKey + "}"] === null && objval != null) ||
							(!Array.isArray(objval) && objval != null && typeof objval === "object"))
					) {
						let objfirst = {};
						objfirst[key] = normalizeToArray(objval);
						outboundFormatData = Object.assign(outboundFormatData, objfirst);

					} else {
						let firstObject = {};
						firstObject[key] = null;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				} else if (
					(dataArr["@Out{" + firstKey + "}"] === null && objval != null) ||
					(!Array.isArray(objval) && objval != null && typeof objval === "object")
				) {
					let objfirst = {};
					objfirst[key] = normalizeToArray(objval);
					outboundFormatData = Object.assign(outboundFormatData, objfirst);
				} else {
					let firstObject = {};
					if (key >= 0) {
						outboundFormatData = objval == null
							? null
							: ((objval === "" || Object.entries(objval).length === 0) ? emptyArr : objval);
					} else {
						firstObject[key] = objval == null
							? null
							: ((objval === "" || Object.entries(objval).length === 0) ? emptyArr : objval);
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				}
			}
		} else if (!Array.isArray(value) && typeof value !== "object") {
			if (dataArr["@Out{" + firstKey + "}"] != undefined) {
				let outType = typeof value;
				let inType = typeof dataArr["@Out{" + firstKey + "}"];
				dataValuestrnumbool = "";

				if (inType === "string" && dataArr["@Out{" + firstKey + "}"] === "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"];
				} else if (dataArr["@Out{" + firstKey + "}"] && typeof dataArr["@Out{" + firstKey + "}"] === "object" && (outType === "string" || outType === "number" || outType === "boolean")) {
					const outputValue = dataArr["@Out{" + firstKey + "}"];
					const keys = Object.keys(outputValue);

					if (keys.length === 1 && keys[0] === "toJson") {
						dataValuestrnumbool = outputValue["toJson"];
					} else {
						if (inType === "object" && outType === "string") {
							dataValuestrnumbool = JSON.stringify(outputValue);
						} else if (inType === "array" && outType === "string") {
							dataValuestrnumbool = JSON.stringify(outputValue);
						} else if (inType === "integer" && outType === "string") {
							dataValuestrnumbool = outputValue.toString();
						} else if (inType === "integer" && outType === "boolean") {
							dataValuestrnumbool = outputValue != 0;
						} else if (inType === "number" && outType === "string") {
							dataValuestrnumbool = outputValue.toString();
						} else if (inType === "number" && outType === "boolean") {
							dataValuestrnumbool = outputValue != 0;
						} else if (inType === "boolean" && outType === "string") {
							dataValuestrnumbool = outputValue.toString();
						} else if (inType === "boolean" && (outType === "number" || outType === "integer")) {
							dataValuestrnumbool = outputValue ? 1 : 0;
						} else if (inType === "string" && outType === "boolean") {
							dataValuestrnumbool = stringToBoolean(outputValue);
						} else if (inType === "string" && outType === "number") {
							dataValuestrnumbool = stringToNumber(outputValue);
						} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "boolean") {
							dataValuestrnumbool = stringToBoolean(outputValue);
						} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "number") {
							dataValuestrnumbool = stringToNumber(outputValue);
						} else {
							dataValuestrnumbool = outputValue;
						}
					}
				} else if (inType === "array" && outType === "string") {
					dataValuestrnumbool = JSON.stringify(dataArr["@Out{" + firstKey + "}"]);
				} else if (inType === "integer" && outType === "string") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"].toString();
				} else if (inType === "integer" && outType === "boolean") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"] != 0;
				} else if (inType === "number" && outType === "string") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"].toString();
				} else if (inType === "number" && outType === "boolean") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"] != 0;
				} else if (inType === "boolean" && outType === "string") {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"].toString();
				} else if (inType === "boolean" && (outType === "number" || outType === "integer")) {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"] ? 1 : 0;
				} else if (inType === "string" && outType === "boolean") {
					dataValuestrnumbool = stringToBoolean(dataArr["@Out{" + firstKey + "}"]);
				} else if (inType === "string" && outType === "number") {
					dataValuestrnumbool = stringToNumber(dataArr["@Out{" + firstKey + "}"]);
				} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "boolean") {
					dataValuestrnumbool = stringToBoolean(dataArr["@Out{" + firstKey + "}"]);
				} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "number") {
					dataValuestrnumbool = stringToNumber(dataArr["@Out{" + firstKey + "}"]);
				} else {
					dataValuestrnumbool = dataArr["@Out{" + firstKey + "}"]
				}

				let firstObject = {};
				if (key >= 0) {
					outboundFormatData = dataValuestrnumbool;
				} else {
					firstObject[key] = dataValuestrnumbool;
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				}
			} else {
				if (dataArr["@Out{" + firstKey + "}"] === null) {
					let firstObject = {};
					if (key >= 0) {
						outboundFormatData = null;
					} else {
						firstObject[key] = null;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				} else if (dataArr["@Out{" + firstKey + "}"] === undefined) {
					let firstObject = {};
					if (key >= 0) {
						outboundFormatData = value;
					} else {
						firstObject[key] = value;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				}
			}
		} else {
			if (typeof dataArr["@Out{" + firstKey + "}"] === "string" && dataArr["@Out{" + firstKey + "}"] === "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
				let firstObject = {};
				if (key >= 0) {
					outboundFormatData = dataArr["@Out{" + firstKey + "}"];
				} else {
					firstObject[key] = dataArr["@Out{" + firstKey + "}"];
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				}
			} else {
				let firstObject = {};
				if (key >= 0) {
					outboundFormatData = value;
				} else {
					firstObject[key] = value;
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				}
			}
		}
	});

	return outboundFormatData;
}

function isLastIndexNumeric(arr) {
	if (!Array.isArray(arr) || arr.length === 0) return false; // Handle invalid cases

	const lastElement = arr[arr.length - 1]; // Get the last element
	return !isNaN(lastElement) && Number.isInteger(Number(lastElement));
}

function mergeKey(outboundFormatData, key, value) {
	if (Number.isInteger(Number(key))) {
		// ensure outboundFormatData is array
		if (!Array.isArray(outboundFormatData)) {
			outboundFormatData = [];
		}
		outboundFormatData[key] = value;
	} else {
		// ensure outboundFormatData is object
		if (outboundFormatData == null || typeof outboundFormatData !== 'object') {
			outboundFormatData = {};
		}
		outboundFormatData[key] = value;
	}
	return outboundFormatData;
}

function outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, OutboundData, dataArr, newLinkDataArr, arrayI = 0, isarr = 0, arracount = 1, itfromarrcount = 1) {
	let outboundFormatData = {};
	let dataValuestrnumbool = "";
	let i = 0;

	try {
		Object.entries(OutboundData).forEach((entry) => {
			let [key, value] = entry;

			let firstKey = "";
			if (outboundFormatDataParentKey.length != 0) {
				for (let i = 0; i < outboundFormatDataParentKey.length; i++) {
					if (outboundFormatDataParentKey[i] >= 0) {
						firstKey = firstKey + "[" + outboundFormatDataParentKey[i] + "]";
					} else {
						if (firstKey != "") {
							firstKey = firstKey + ".";
						}
						firstKey = firstKey + outboundFormatDataParentKey[i];
					}
				}

				if (firstKey != "") {
					if (key >= 0) {
						firstKey = firstKey + "[" + key + "]";
					} else {
						firstKey = firstKey + "." + key;
					}
				} else {
					firstKey = key;
				}
			} else {
				firstKey = key;
			}

			let indexedKey = "@Out{" + firstKey + "}";

			if (!Array.isArray(value) && value != null && typeof value === "object") {
				if (dataArr[indexedKey] != undefined && !mappingArrayMerged.includes(indexedKey)) {
					let isArray = Array.isArray(dataArr[indexedKey]);
					let inType = (isArray ? "array" : typeof dataArr[indexedKey]);
					dataValuestrnumbool = {};
					if (inType === "string" || inType === "integer" || inType === "number" || inType === "boolean") {
						dataValuestrnumbool[key] = dataArr[indexedKey];
					} else {
						dataValuestrnumbool = dataArr[indexedKey];
					}
					let secondObject = {};
					secondObject[key] = dataValuestrnumbool;
					outboundFormatData = Object.assign(outboundFormatData, secondObject);
					mappingArrayMerged.push(indexedKey);
				}

				if ((value.length != undefined && value.length > 0) || (Object.entries(value).length != undefined && Object.entries(value).length > 0)) {
					let objval = {};
					outboundFormatDataParentKey.push(key);
					let lastI = (isNaN(outboundFormatDataParentKey[outboundFormatDataParentKey.length - 1])) ? itfromarrcount : Number(outboundFormatDataParentKey[outboundFormatDataParentKey.length - 1]) + 1;
					let newarrayI = (key >= 0) ? arrayI : 0;
					let newisarr = (key >= 0) ? isarr : 0;
					let newarracount = (key >= 0) ? arracount + 1 : 1;

					if (isarr) {
						objval = outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, value, dataArr, newLinkDataArr, newarrayI, newisarr, newarracount, lastI);
						let firstObject = {};
						if (isLastIndexNumeric(outboundFormatDataParentKey)) {
							firstObject[i] = objval;
						} else {
							firstObject[outboundFormatDataParentKey[outboundFormatDataParentKey.length - 1]] = objval;
						}

						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					} else {

						objval = outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, value, dataArr, newLinkDataArr, newarrayI, newisarr, newarracount, lastI);
						if (key >= 0) {
							outboundFormatData[key] = objval;
						} else {
							outboundFormatData = mergeKey(outboundFormatData, key, objval);
						}
					}

					outboundFormatDataParentKey.pop();
				} else {
					let firstObject = {};
					// Preserve the original value if it exists
					firstObject[key] = value !== undefined ? value : {};
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				}

			} else if (Array.isArray(value) && value != null && typeof value === "object") {
				let hasNestedMappings = false;
				for (let j = 0; j < value.length; j++) {
					let arrayIndexedKey = "@Out{" + firstKey + "[" + j + "].";
					for (let key in dataArr) {
						if (key.startsWith(arrayIndexedKey)) {
							hasNestedMappings = true;
							break;
						}
					}
					if (hasNestedMappings) break;
				}

				if (dataArr[indexedKey] != undefined && !hasNestedMappings) {
					let isArray = Array.isArray(dataArr[indexedKey]);
					let inType = (isArray ? "array" : typeof dataArr[indexedKey]);
					dataValuestrnumbool = [];

					if (inType === "object") {
						dataValuestrnumbool.push(dataArr[indexedKey]);
					} else if (inType === "array") {
						dataValuestrnumbool = dataArr[indexedKey];
					} else {
						let newObject = {};
						let newKey = newLinkDataArr[indexedKey]?.replace("@In{", "").replace(/}$/, "") || key;
						newObject[newKey] = dataArr[indexedKey];
						dataValuestrnumbool.push(newObject);
					}

					// Check individual array indices
					for (let j = 0; j < value.length; j++) {
						let arrayIndexedKey = "@Out{" + firstKey + "[" + j + "]}";
						if (dataArr[arrayIndexedKey] != undefined) {
							let isArray1 = Array.isArray(dataArr[arrayIndexedKey]);
							let inType1 = (isArray1 ? "array" : typeof dataArr[arrayIndexedKey]);
							if (inType1 === "object") {
								dataValuestrnumbool.push(dataArr[arrayIndexedKey]);
							} else if (inType1 === "array") {
								let dataArrlength = dataArr[arrayIndexedKey];
								for (let q = 0; q < dataArrlength.length; q++) {
									dataValuestrnumbool.push(dataArrlength[q]);
								}
							} else {
								let newObject = {};
								let newKey = newLinkDataArr[arrayIndexedKey]?.replace("@In{", "").replace(/}$/, "") || key;
								newObject[newKey] = dataArr[arrayIndexedKey];
								dataValuestrnumbool.push(newObject);
							}
						}
					}

					// If we found mapped data, use it and skip recursive processing
					let secondObject = {};
					if (key >= 0) {
						outboundFormatData = dataValuestrnumbool;
					} else {
						secondObject[key] = dataValuestrnumbool;
						outboundFormatData = Object.assign(outboundFormatData, secondObject);
					}

					// Important: Don't do recursive processing if we have direct mapping
					// Skip the rest of array processing
					i++;
					return outboundFormatData;
				}

				let emptyArr = [];
				let objval = {};
				outboundFormatDataParentKey.push(key);
				let vararrdata = value;

				objval = outboundformatdata1(nodeDataArray, outboundFormatDataParentKey, mappingArrayMerged, vararrdata, dataArr, newLinkDataArr, vararrdata.length, 1, 1);
				outboundFormatDataParentKey.pop();

				const targetObj = dataArr[indexedKey];

				const normalizeToArray = (val) => {
					let arr = [];

					// If already an array, iterate through all indices
					if (Array.isArray(val)) {
						for (let idx = 0; idx < val.length; idx++) {
							arr.push(val[idx]);
						}
						return arr;
					}

					// If object with numeric keys, convert to array preserving order
					if (val && typeof val === 'object') {
						const keys = Object.keys(val).map(k => parseInt(k)).filter(k => !isNaN(k)).sort((a, b) => a - b);
						if (keys.length > 0) {
							// Has numeric keys, build array
							for (let idx = 0; idx <= keys[keys.length - 1]; idx++) {
								arr.push(val[idx] !== undefined ? val[idx] : null);
							}
						} else {
							// No numeric keys, not an array structure
							return val;
						}
					}
					return arr;
				};

				const hasNewLinkKey = newLinkDataArr.hasOwnProperty(indexedKey)
				if (targetObj && typeof targetObj === "object") {
					if ("toJson" in targetObj) {
						let firstObject = merged1 = {};
						firstObject[key] = targetObj;
						merged1 = Object.assign(outboundFormatData, firstObject);
					} else {
						let objfirst = {};
						objfirst[key] = normalizeToArray(objval);
						outboundFormatData = Object.assign(outboundFormatData, objfirst);
					}
				} else if (dataArr[indexedKey] === null) {
					if (
						(dataArr["@Out{" + firstKey + "}"] === null && objval != null) ||
						(!Array.isArray(objval) && objval != null && typeof objval === "object")
					) {
						let objfirst = {};
						if (value.length === 0) { objval = []; }
						objfirst[key] = normalizeToArray(objval);
						outboundFormatData = Object.assign(outboundFormatData, objfirst);
					} else {
						let firstObject = {};
						firstObject[key] = null;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}

				} else if (!Array.isArray(objval) && objval != null && typeof objval === "object") {
					let objfirst = {};
					let objvalarr = [];
					Object.entries(objval).forEach(([objvalkey, objvalvalue]) => {
						if (objvalkey >= 0 && !Array.isArray(objvalvalue)) {
							objvalarr.push(objvalvalue);
						} else if (Array.isArray(objvalvalue)) {
							objvalarr.push(...objvalvalue);
						}
					});
					objfirst[key] = objvalarr;
					outboundFormatData = Object.assign(outboundFormatData, objfirst);
				} else {
					let firstObject = {};
					if (key >= 0) {
						outboundFormatData = objval == null
							? null
							: ((objval === "" || Object.entries(objval).length === 0) ? emptyArr : objval);
					} else {
						firstObject[key] = objval == null
							? null
							: ((objval === "" || Object.entries(objval).length === 0) ? emptyArr : objval);
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				}
			} else if (!Array.isArray(value) && typeof value !== "object") {
				if (dataArr[indexedKey] != undefined) {
					const normalizedPath = (path) => path.replace(/\[\d+\]/g, '');
					const record = nodeDataArray.find((item) => item.key === normalizedPath(indexedKey));
					let outType = record?.type;
					let inType = typeof dataArr[indexedKey];
					dataValuestrnumbool = "";

					if (inType === "string" && dataArr[indexedKey] === "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
						dataValuestrnumbool = dataArr[indexedKey];
					} else if (dataArr[indexedKey] && typeof dataArr[indexedKey] === "object" && (outType === "string" || outType === "number" || outType === "boolean")) {
						const outputValue = dataArr[indexedKey];
						const keys = Object.keys(outputValue);

						if (keys.length === 1 && keys[0] === "toJson") {
							dataValuestrnumbool = outputValue["toJson"];
						} else {
							if (inType === "object" && outType === "string") {
								dataValuestrnumbool = JSON.stringify(outputValue);
							} else if (inType === "array" && outType === "string") {
								dataValuestrnumbool = JSON.stringify(outputValue);
							} else if (inType === "integer" && outType === "string") {
								dataValuestrnumbool = outputValue.toString();
							} else if (inType === "integer" && outType === "boolean") {
								dataValuestrnumbool = outputValue != 0;
							} else if (inType === "number" && outType === "string") {
								dataValuestrnumbool = outputValue.toString();
							} else if (inType === "number" && outType === "boolean") {
								dataValuestrnumbool = outputValue != 0;
							} else if (inType === "boolean" && outType === "string") {
								dataValuestrnumbool = outputValue.toString();
							} else if (inType === "boolean" && (outType === "number" || outType === "integer")) {
								dataValuestrnumbool = outputValue ? 1 : 0;
							} else if (inType === "string" && outType === "boolean") {
								dataValuestrnumbool = stringToBoolean(outputValue);
							} else if (inType === "string" && outType === "number") {
								dataValuestrnumbool = stringToNumber(outputValue);
							} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "boolean") {
								dataValuestrnumbool = stringToBoolean(outputValue);
							} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "number") {
								dataValuestrnumbool = stringToNumber(outputValue);
							} else {
								dataValuestrnumbool = outputValue;
							}
						}
					} else if (inType === "array" && outType === "string") {
						dataValuestrnumbool = JSON.stringify(dataArr[indexedKey]);
					} else if (inType === "integer" && outType === "string") {
						dataValuestrnumbool = dataArr[indexedKey].toString();
					} else if (inType === "integer" && outType === "boolean") {
						dataValuestrnumbool = dataArr[indexedKey] != 0;
					} else if (inType === "number" && outType === "string") {
						dataValuestrnumbool = dataArr[indexedKey].toString();
					} else if (inType === "number" && outType === "boolean") {
						dataValuestrnumbool = dataArr[indexedKey] != 0;
					} else if (inType === "boolean" && outType === "string") {
						dataValuestrnumbool = dataArr[indexedKey].toString();
					} else if (inType === "boolean" && (outType === "number" || outType === "integer")) {
						dataValuestrnumbool = dataArr[indexedKey] ? 1 : 0;
					} else if (inType === "string" && outType === "boolean") {
						dataValuestrnumbool = stringToBoolean(dataArr[indexedKey]);
					} else if (inType === "string" && outType === "number") {
						dataValuestrnumbool = stringToNumber(dataArr[indexedKey]);
					} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "boolean") {
						dataValuestrnumbool = stringToBoolean(dataArr[indexedKey]);
					} else if ((inType === "object" || inType === "undefined" || inType === "null") && outType === "number") {
						dataValuestrnumbool = stringToNumber(dataArr[indexedKey]);
					} else {
						dataValuestrnumbool = dataArr[indexedKey];
					}

					if (key >= 0) {
						outboundFormatData[key] = dataValuestrnumbool;
					} else {
						let firstObject = {};
						firstObject[key] = dataValuestrnumbool;
						outboundFormatData = Object.assign(outboundFormatData, firstObject);
					}
				} else {
					if (dataArr[indexedKey] === null) {
						let firstObject = {};
						if (key >= 0) {
							// When processing array items, build an object with numeric keys
							firstObject[key] = !(newLinkDataArr.hasOwnProperty(indexedKey)) && isParentLinked(indexedKey, newLinkDataArr) ? value : null;
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						} else {
							firstObject[key] = !(newLinkDataArr.hasOwnProperty(indexedKey)) && isParentLinkedFn(indexedKey, newLinkDataArr) ? value : null;
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						}

					} else if (dataArr[indexedKey] === undefined) {
						let firstObject = {};
						if (key >= 0) {
							// When processing array items, build an object with numeric keys
							firstObject[key] = value;
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						} else {
							firstObject[key] = value;
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						}
					} else {
						let firstObject = {};
						if (key >= 0) {
							// When processing array items, build an object with numeric keys
							firstObject[key] = dataArr[indexedKey];
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						} else {
							firstObject[key] = dataArr[indexedKey];
							outboundFormatData = Object.assign(outboundFormatData, firstObject);
						}
					}
				}
				isarr = 0;
			} else {
				let firstObject = {};
				if (key >= 0) {
					// When processing array items, build an object with numeric keys
					firstObject[key] = dataArr[indexedKey] || value;
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				} else {
					firstObject[key] = dataArr[indexedKey] || value;
					outboundFormatData = Object.assign(outboundFormatData, firstObject);
				}
			}
			i++;
		});
		return outboundFormatData;
	} catch (e) {
		console.log("ERROR:", e);
	}
}

function checkKeyExists(obj, keyPath) {
	// Remove @Out{} or @In{} wrapper if present
	keyPath = keyPath.replace(/^@(?:Out|In)\{|\}$/g, '');

	const parts = keyPath.split('.');
	let current = obj;

	for (let part of parts) {
		const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);

		if (arrayMatch) {
			const arrayKey = arrayMatch[1];

			if (!Array.isArray(current[arrayKey]) || current[arrayKey].length === 0) return false;

			// Always check first element (index ignored)
			current = current[arrayKey][0];
		} else {
			if (current == null || !(part in current)) return false;
			current = current[part];
		}
	}
	return true;
}


function mergeOutboundWithMapping(originalData, mappingInbound) {
	let updatedData = { ...originalData }; // Clone original data

	for (let key in mappingInbound) {
		let match = key.match(/@Out{(.+)}/);
		if (match) {
			let columnName = match[1]; // Extract column name from @Out{}

			// Ignore keys that contain "."
			if (!columnName.includes(".")) {
				// Only add if the key is completely missing in originalData
				if (!(columnName in originalData)) {
					updatedData[columnName] = mappingInbound[key];
				}
			}
		}
	}

	return updatedData;
}

// Outbound Validation function
async function outboundValidationHandler(outboundValidationSettingData, reqBody, enableLogs, outboundEnableLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, inboundPostData, outboundMappedData, resBody = {}, resTransFromBody = {}, type, logdir, logdatefilename) {
	if (type == "Scheduler") {
		const todaydate = new Date();
		const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
		var prelogtest = prelog.replace("keywords", "not defined");
	}

	if (outboundValidationSettingData != undefined) {
		const validations = outboundValidationSettingData || [];
		if (validations.length > 0) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Validation", request_id });

			if (type == "Scheduler") {
				await writelog(logdir + logdatefilename, prelogtest + "Outbound Validation" + "\n");
			}

			const outboundValidation = await outboundvalidationfunc(enableLogs, enableFullLogs, companyCode, validations, inboundFormatData, OutboundFormatData, enableError, "@In{", item, schedulerUniqueId, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, inboundPostData, outboundMappedData, resBody, resTransFromBody, type);

			if (!outboundValidation.valid) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Validation Error : " + outboundValidation.longMsg, request_id });

				return {
					code: "1",
					MsgCode: "400001",
					MsgType: "Trigger-Rules",
					MsgLang: "en",
					ShortMsg: "Fail",
					LongMsg: outboundValidation.longMsg,
					rule: outboundValidation.rule || '',
					InternalMsg: "",
					EnableAlert: "No",
					DisplayMsgBy: "LongMsg",
					Data: [],
					logQueueMsg: "Validation Fail",
				};
			}

			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Apply", description: "Outbound Validation Applied Successful", request_id });
		}
	}

	return {
		code: "0",
		rule: '',
	};
}

// Outbound Validation function
async function outboundvalidationfunc(enableLogs, enableFullLogs, companyCode, validations, inboundFormatData, OutboundFormatData, enableError, includesKey, item, schedulerUniqueId, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, endpointMeta, body, transformedBody, { }, { }, type) {
	let longMsg = "";
	let outboundValidation = true;
	let rule = "SKIP";
	const inboundSettingData = item.inbound_setting;
	const outboundSettingData = item.outbound_setting;

	let pathInOut = "Inbound";
	let itemEnableLog = (inboundSettingData.enableLog != undefined) ? inboundSettingData.enableLog : "off";
	if (includesKey == "@Out{") {
		pathInOut = "Outbound";
		itemEnableLog = (outboundSettingData.enableLog != undefined) ? outboundSettingData.enableLog : "off";
	}

	let fieldName = "", andCondition = "", andContainsString = "", andContainsValue = "", orCondition = "", orContainsString = "", orContainsValue = "", replaceCount = 0;
	let conditionsValue = "";
	for (let i = 0; i < validations.length; i++) {
		let original = validations[i].original;
		if (original != undefined) {
			let column = validations[i].column;
			let logical = validations[i].logical;
			let operations = validations[i].operations;
			let rulethen = validations[i].then;
			let ruleformula = validations[i].formula;

			original = replacePlaceholders(original, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);

			original = await processWebhookContent(original, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);

			original = await formulaGetValue(companyCode, original, original, '', OutboundFormatData, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			column = replacePlaceholders(column, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);

			column = await processWebhookContent(column, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);

			column = await formulaGetValue(companyCode, column, column, '', OutboundFormatData, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			column = typeof column == "string" ? column.replace(/['"]+/g, '') : column;
			original = typeof original == "string" ? original.replace(/['"]+/g, '') : original;

			function cleanValue(value) {
				if (typeof value === "boolean") {
					return value.toString();
				}
				if (typeof value === "string" && !isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				if (!isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				return value;
			}

			column = cleanValue(column);
			original = cleanValue(original);

			if (operations == "<>") {
				operations = "!=";
			}

			if (logical == "AND" && operations != "Contains") {
				if (andCondition != "") { andCondition += " && "; conditionsValue += " && "; }
				andCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations != "Contains") {
				if (orCondition != "") { orCondition += " || "; conditionsValue += " || "; }
				orCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "AND" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " && "; }
				andContainsString = original;
				andContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " || "; }
				orContainsString = original;
				orContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			let inbounddatakey = original;

			replaceCount++;
			if (andCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andCondition = andCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (andContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andContainsString = andContainsString.replace(original, inboundFormatData[original]);
				}
			}

			if (orCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orCondition = orCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (orContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orContainsString = orContainsString.replace(original, inboundFormatData[original]);
				}
			}

			let andContainsValid = true;
			if (andContainsString != "" && andContainsValue != "") {
				andContainsValue = andContainsValue.toLowerCase();
				andContainsValid = andContainsString.includes(andContainsValue);
			}

			let orContainsValid = false;
			if (orContainsString != "" && orContainsValue != "") {
				orContainsValue = orContainsValue.toLowerCase();
				orContainsValid = orContainsString.includes(orContainsValue);
			}

			let andValid = true;
			let andConditionValid = eval(andCondition);
			if (andConditionValid && andContainsValid) {
				andValid = true;
			} else {
				andValid = false;
			}

			let orValid = true;
			let orConditionValid = eval(orCondition);
			if (orConditionValid || orContainsValid) {
				orValid = true;
			} else {
				orValid = false;
			}

			if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if ((andValid && andContainsValid) || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (andValid || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid || orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					if (enableLogs == "on" || itemEnableLog == "on" || enableFullLogs == "on") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
					}
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andValid && andContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					if (enableLogs == "on" || itemEnableLog == "on" || enableFullLogs == "on") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
					}
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (orValid || orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString == "") {
				if (andValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (orValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });

				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (orContainsValid) {
					if (rulethen == "STOP") {
						if (ruleformula != "") {
							longMsg = replacePlaceholders(ruleformula, {}, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
							longMsg = await processWebhookContent(longMsg, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, body, transformedBody, {}, {}, {}, endpointMeta);
							longMsg = (longMsg != "") ? replacePlaceholdersInValidKeys(longMsg, {}, {}, querystring, header, global) : longMsg;
							longMsg = await formulaGetValue(
								companyCode, longMsg, longMsg, "", {}, inboundFormatData,
								includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError = "no", querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod
							);
							longMsg = typeof longMsg == "string" ? longMsg.replace(/['"]+/g, '') : longMsg;
						} else {
							longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						}

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });

						outboundValidation = false;
						rule = "STOP";
						break;
					} else {
						longMsg = 'No Outbound process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
						if (rulethen == "SKIP") {
							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

							addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Fail", request_id });
						}

						outboundValidation = false;
						rule = "SKIP";
						break;
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			}
		}

		if (!outboundValidation) {
			break;
		}
	}

	if (validations.length > 0 && outboundValidation) {
		for (let i = 0; i < validations.length; i++) {
			if (validations[i] != "") {
				let original = validations[i].original;
				if (original !== "" && original.startsWith("@In{")) {
					let startIndex = original.indexOf("@In{")
					let endIndex = original.indexOf("}");
					let originalkey = original.slice(startIndex, endIndex + 1);
					if (inboundFormatData[originalkey] == undefined) {
						longMsg = "Missing column of " + originalkey + ".";
						outboundValidation = false;
						break;
					}
				}
			}
		}
	}

	return { valid: outboundValidation, longMsg: longMsg, rule: rule };
}

// Outbound Validation function
async function actionValidationHandler(validationRule, includesKey, enableLogs, enableFullLogs, companyCode, schedulerUniqueId, item_id, inboundFormatData, OutboundFormatData, enableError, item, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type, logdir, logdatefilename) {
	try {
		if (type == "Scheduler") {
			const todaydate = new Date();
			const prelog = "[" + todaydate + "] - [/routers/scheduler_job.js] > [/outboundrun] > [keywords] > [Project Id] > " + item_id + " > "
			var prelogtest = prelog.replace("keywords", "not defined");
		}

		if (validationRule != undefined) {
			const validations = validationRule || [];
			if (validations.length > 0) {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Action", description: "Outbound Action Validation", request_id });

				if (type == "Scheduler") {
					await writelog(logdir + logdatefilename, prelogtest + "Outbound Action Validation" + "\n");
				}

				const outboundValidation = await outboundvalidationfuncForAction(enableLogs, enableFullLogs, companyCode, validations, inboundFormatData, OutboundFormatData, enableError, includesKey, item, schedulerUniqueId, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type);

				if (!outboundValidation.valid) {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Action", description: "Outbound Action Validation Error : " + outboundValidation.longMsg, request_id });

					return {
						code: "1",
						MsgCode: "50001",
						MsgType: "Action-Trigger-Rules",
						MsgLang: "en",
						ShortMsg: "Fail",
						LongMsg: outboundValidation.longMsg,
						rule: outboundValidation.rule || '',
						InternalMsg: "",
						EnableAlert: "No",
						DisplayMsgBy: "LongMsg",
						Data: [],
						logQueueMsg: "Validation Fail",
					};
				}

				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Action", description: "Outbound Action Validation Applied Successful", request_id });
			}
		}

		return {
			code: "0",
			rule: '',
		};
	} catch (err) {
		console.log("Error at actionValidationHandler:", err);
	}

}

async function outboundvalidationfuncForAction(enableLogs, enableFullLogs, companyCode, validations, inboundFormatData, OutboundFormatData, enableError, includesKey, item, schedulerUniqueId, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod, type) {
	let longMsg = "";
	let outboundValidation = true;
	let rule = "SKIP";
	const inboundSettingData = item.inbound_setting;
	const outboundSettingData = item.outbound_setting;

	let pathInOut = "Inbound";
	let itemEnableLog = (inboundSettingData.enableLog != undefined) ? inboundSettingData.enableLog : "off";
	if (includesKey == "@Out{") {
		pathInOut = "Outbound";
		itemEnableLog = (outboundSettingData.enableLog != undefined) ? outboundSettingData.enableLog : "off";
	}

	let fieldName = "", andCondition = "", andContainsString = "", andContainsValue = "", orCondition = "", orContainsString = "", orContainsValue = "", replaceCount = 0;
	let conditionsValue = "";
	for (let i = 0; i < validations.length; i++) {
		let original = validations[i].original;
		if (original != undefined) {
			let column = validations[i].column;
			let logical = validations[i].logical;
			let operations = validations[i].operations;
			let rulethen = validations[i].then;

			original = replacePlaceholders(original, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
			original = await formulaGetValue(companyCode, original, original, '', OutboundFormatData, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			column = replacePlaceholders(column, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
			column = await formulaGetValue(companyCode, column, column, '', OutboundFormatData, inboundFormatData, includesKey, item, schedulerUniqueId, itemEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

			column = typeof column == "string" ? column.replace(/['"]+/g, '') : column;
			original = typeof original == "string" ? original.replace(/['"]+/g, '') : original;

			function cleanValue(value) {
				if (typeof value === "boolean") {
					return value.toString();
				}
				if (typeof value === "string" && !isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				if (!isNaN(value)) {
					if (value) {
						return Number(value);
					}
				}
				return value;
			}

			column = cleanValue(column);
			original = cleanValue(original);

			if (operations == "<>") {
				operations = "!=";
			}

			if (logical == "AND" && operations != "Contains") {
				if (andCondition != "") { andCondition += " && "; conditionsValue += " && "; }
				andCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations != "Contains") {
				if (orCondition != "") { orCondition += " || "; conditionsValue += " || "; }
				orCondition += `"` + original + `" ` + operations + ` "` + column + `"`;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "AND" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " && "; }
				andContainsString = original;
				andContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			if (logical == "OR" && operations == "Contains") {
				if (conditionsValue != "") { conditionsValue += " || "; }
				orContainsString = original;
				orContainsValue = column;
				conditionsValue += `"` + original + `" ` + operations + ` "` + column + `"`;
			}

			let inbounddatakey = original;

			replaceCount++;
			if (andCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andCondition = andCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (andContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					andContainsString = andContainsString.replace(original, inboundFormatData[original]);
				}
			}

			if (orCondition.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orCondition = orCondition.replace(original, inboundFormatData[original]);
				}
			}

			if (orContainsString.includes(inbounddatakey) && typeof original === "string" && original.startsWith("@In{")) {
				for (let i = 0; i < replaceCount; i++) {
					orContainsString = orContainsString.replace(original, inboundFormatData[original]);
				}
			}

			let andContainsValid = true;
			if (andContainsString != "" && andContainsValue != "") {
				andContainsValue = andContainsValue.toLowerCase();
				andContainsValid = andContainsString.includes(andContainsValue);
			}

			let orContainsValid = false;
			if (orContainsString != "" && orContainsValue != "") {
				orContainsValue = orContainsValue.toLowerCase();
				orContainsValid = orContainsString.includes(orContainsValue);
			}

			let andValid = true;
			let andConditionValid = eval(andCondition);
			if (andConditionValid && andContainsValid) {
				andValid = true;
			} else {
				andValid = false;
			}

			let orValid = true;
			let orConditionValid = eval(orCondition);
			if (orConditionValid || orContainsValid) {
				orValid = true;
			} else {
				orValid = false;
			}

			if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if ((andValid && andContainsValid) || orValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if ((andValid && andContainsValid) || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (andValid || orValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid || orValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString != "") {
				if (andContainsValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					if (enableLogs == "on" || itemEnableLog == "on" || enableFullLogs == "on") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
					}
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andValid && andContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					if (enableLogs == "on" || itemEnableLog == "on" || enableFullLogs == "on") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
					}
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (andValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString != "") {
				if (orValid || orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition != "" && orCondition == "" && andContainsString == "" && orContainsString == "") {
				if (andValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition != "" && andContainsString == "" && orContainsString == "") {
				if (orValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });

				}
			} else if (andCondition == "" && orCondition == "" && andContainsString != "" && orContainsString == "") {
				if (andContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			} else if (andCondition == "" && orCondition == "" && andContainsString == "" && orContainsString != "") {
				if (orContainsValid) {
					longMsg = 'No Action process there cause by ' + original + ` ` + operations + ` ` + column + ` matched to ` + rulethen;
					if (rulethen == "SKIP") {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: pathInOut + " validations apply", exception_type: "Validation Error", item: item.ItemName, detail_exception: "Error Validation > " + pathInOut + " > " + inbounddatakey + " : " + longMsg, request_id });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Fail", request_id });
					}

					outboundValidation = false;
					rule = "SKIP";
					break;
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: type == "Scheduler" ? "Outbound" : "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: pathInOut + " Action Validation Apply", description: conditionsValue + " = Pass", request_id });
				}
			}
		}

		if (!outboundValidation) {
			break;
		}
	}

	if (validations.length > 0 && outboundValidation) {
		for (let i = 0; i < validations.length; i++) {
			if (validations[i] != "") {
				let original = validations[i].original;
				if (original !== "" && original.startsWith("@In{")) {
					let startIndex = original.indexOf("@In{")
					let endIndex = original.indexOf("}");
					let originalkey = original.slice(startIndex, endIndex + 1);
					if (inboundFormatData[originalkey] == undefined) {
						longMsg = "Missing column of " + originalkey + ".";
						outboundValidation = false;
						break;
					}
				}
			}
		}
	}

	return { valid: outboundValidation, longMsg: longMsg, rule: rule };
}

function findArrayParentWithLength(data, path) {
	const parts = path.replace(/\]/g, '').split(/\.|\[/);
	let current = data;
	let currentPath = '';
	let arrayParentPath = null;
	let array = [];
	let arrayLength = 0;

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (!part) continue;

		// Track current path
		currentPath = currentPath ? `${currentPath}.${part}` : part;

		if (Array.isArray(current)) {
			arrayParentPath = currentPath.split('.').slice(0, -1).join('.');
			array = current;
			arrayLength = current.length;
		}

		if (current && typeof current === 'object') {
			current = current[part];
		} else {
			break;
		}
	}

	// Handle if the last object is array
	if (Array.isArray(current)) {
		arrayParentPath = currentPath;
		array = current;
		arrayLength = current.length;
	}

	return {
		isArray: !!arrayParentPath,
		parentKey: arrayParentPath,
		length: arrayLength,
		array: array
	};
}

async function adjustArrayWithoutLinkedLengths(inboundPostData, OutboundFormatData, tempDataArr1, newLinkDataArr) {
	Object.entries(newLinkDataArr).forEach(([outKey, inKey]) => {
		if (!outKey.startsWith('@Out{') || !inKey.startsWith('@In{')) return;

		const inPath = inKey.slice(4, -1);   // Remove @In{...}
		const outPath = outKey.slice(5, -1); // Remove @Out{...}

		const inArrayInfo = findArrayParentWithLength(inboundPostData, inPath);
		const outArrayInfo = findArrayParentWithLength(OutboundFormatData, outPath);

		if (
			inArrayInfo.isArray &&
			outArrayInfo.isArray &&
			!newLinkDataArr[`@Out{${outArrayInfo.parentKey}}`]
		) {
			const parentOutKey = `@Out{${outArrayInfo.parentKey}}`;

			if (inArrayInfo.length === 0) {
				tempDataArr1[parentOutKey] = [];
			} else if (inArrayInfo.length > 0 && outArrayInfo.length > 0) {
				const diff = inArrayInfo.length - outArrayInfo.length;
				let tempArr = outArrayInfo.array;

				if (diff > 0) {
					for (let i = 0; i < diff; i++) {
						tempArr.push(JSON.parse(JSON.stringify(tempArr[0])));
					}
				} else {
					tempArr.length = inArrayInfo.length;
				}

				tempDataArr1[parentOutKey] = tempArr;
			}
		}
	});

	return tempDataArr1;
}

async function adjustArrayLengths(tempDataArr, newLinkDataArr, inboundFormatData, outboundFormatDataArr) {
	for (const outKey of Object.keys(newLinkDataArr)) {
		const inKey = newLinkDataArr[outKey];
		const inboundData = inboundFormatData[inKey];
		const outboundData = outboundFormatDataArr[outKey];

		if (Array.isArray(inboundData) && Array.isArray(outboundData)) {
			const lengthDiff = inboundData.length - outboundData.length;

			if (lengthDiff > 0) {
				tempDataArr = await addKeysLengthDifference(tempDataArr, outKey, outboundData, lengthDiff, newLinkDataArr, outboundFormatDataArr, inboundFormatData);
			} else if (lengthDiff < 0) {
				tempDataArr = await removeKeysLengthDifference(tempDataArr, outKey, inboundData, -lengthDiff, newLinkDataArr);
			}
		} else if (inboundData && typeof inboundData === 'object' && outboundData && typeof outboundData === 'object') {
			tempDataArr = await processNestedObject(tempDataArr, outKey, inKey, inboundData, outboundData, newLinkDataArr, outboundFormatDataArr, inboundFormatData);
		}
	}
	return tempDataArr;
}

async function processNestedObject(tempDataArr, outKey, inKey, inboundData, outboundData, newLinkDataArr, outboundFormatDataArr, inboundFormatData) {
	for (const key of Object.keys(inboundData)) {
		const nestedOutKey = `${outKey}.${key}`;
		const nestedInKey = `${inKey}.${key}`;
		const nestedInbound = inboundData[key];
		const nestedOutbound = outboundData[key];

		if (Array.isArray(nestedInbound) && Array.isArray(nestedOutbound)) {
			const lengthDiff = nestedInbound.length - nestedOutbound.length;

			if (lengthDiff > 0) {
				tempDataArr = await addKeysLengthDifference(tempDataArr, nestedOutKey, nestedOutbound, lengthDiff, newLinkDataArr, outboundFormatDataArr, inboundFormatData);
			} else if (lengthDiff < 0) {
				tempDataArr = await removeKeysLengthDifference(tempDataArr, nestedOutKey, nestedInbound, -lengthDiff, newLinkDataArr);
			}
		} else if (nestedInbound && typeof nestedInbound === 'object' && nestedOutbound && typeof nestedOutbound === 'object') {
			tempDataArr = await processNestedObject(tempDataArr, nestedOutKey, nestedInKey, nestedInbound, nestedOutbound, newLinkDataArr, outboundFormatDataArr, inboundFormatData);
		}
	}
	return tempDataArr;
}


function normalizePathkeys(path) {
	return path.replace(/\[(\d+)\](?:\[\d+\])+/g, (_, idx) => `[${idx}]`);
}

function generateOutKeysRecursively(tempDataArr, basePath, value) {
	// Check for null/undefined first
	if (value === null || value === undefined) {
		tempDataArr[`@Out{${normalizePathkeys(basePath)}}`] = value;
		return;
	}

	// Check if it's an array
	if (Array.isArray(value)) {
		const isPrimitiveArray = value.every(
			v => v === null || v === undefined || typeof v !== 'object'
		);

		if (isPrimitiveArray) {
			// Directly assign this array as a value, without recursing deeper
			tempDataArr[`@Out{${normalizePathkeys(basePath)}}`] = value;
			return;
		}
		value.forEach((item, index) => {
			const newPath = `${basePath}[${index}]`;
			generateOutKeysRecursively(tempDataArr, newPath, item);
		});
		return;
	}

	// Check if it's a primitive (string, number, boolean)
	if (typeof value !== 'object') {
		tempDataArr[`@Out{${normalizePathkeys(basePath)}}`] = value;
		return;
	}

	// Check if it's a "string-like object" (has numeric keys 0,1,2...)
	const keys = Object.keys(value);
	const isStringObject = keys.length > 0 && keys.every((k, i) => k === String(i));

	if (isStringObject) {
		// Convert back to string and treat as primitive
		const str = keys.map(k => value[k]).join('');
		tempDataArr[`@Out{${normalizePathkeys(basePath)}}`] = str;
		return;
	}

	// Plain object - recurse into properties
	keys.forEach(fieldName => {
		const newPath = `${basePath}.${fieldName}`;
		tempDataArr[`@Out{${normalizePathkeys(newPath)}}`] = value[fieldName];
		generateOutKeysRecursively(tempDataArr, newPath, value[fieldName]);
	});
}

async function addKeysLengthDifference(tempDataArr, outKey, outboundArray, lengthDiff, newLinkDataArr, outboundFormatDataArr, inboundFormatData) {
	const baseArrayFirstItem = outboundArray[0] || {};
	const startingLength = outboundArray.length;

	// Find inbound array for this key
	const inKey = newLinkDataArr[outKey];
	const inboundArray = inboundFormatData[inKey] || [];

	for (let i = 0; i < lengthDiff; i++) {
		const newIndex = startingLength + i;
		const inboundItem = inboundArray[newIndex] || {};

		// Deep clone to avoid converting strings to objects
		const newItem = JSON.parse(JSON.stringify(baseArrayFirstItem));

		// Add new element to array
		tempDataArr[outKey] = tempDataArr[outKey] || [];
		tempDataArr[outKey].push(newItem);

		generateOutKeysRecursively(tempDataArr, outKey.replace(/^@Out{|}$/g, "") + `[${newIndex}]`, newItem);

		// Update format data
		tempDataArr = await updateFormatData(outKey, tempDataArr[outKey], "@Out{", tempDataArr);
	}

	return tempDataArr;
}

async function removeKeysLengthDifference(tempDataArr, outKey, targetInboundArray, lengthDiff, newLinkDataArr) {
	const currentLength = tempDataArr[outKey] ? tempDataArr[outKey].length : 0;

	for (let i = 0; i < lengthDiff; i++) {
		const indexToRemove = currentLength - 1 - i;

		// Remove element from the array
		if (tempDataArr[outKey] && Array.isArray(tempDataArr[outKey])) {
			tempDataArr[outKey].pop();
		}

		// Remove all keys for this array index recursively
		tempDataArr = removeNestedKeysForIndex(tempDataArr, outKey, indexToRemove);

		// Update format data for the parent array
		tempDataArr = await updateFormatData(outKey, tempDataArr[outKey], "@Out{", tempDataArr);
	}

	return tempDataArr;
}

function removeNestedKeysForIndex(tempDataArr, baseKey, indexToRemove) {
	const indexPattern = baseKey.replace("}", `[${indexToRemove}]`);

	const keysToRemove = Object.keys(tempDataArr).filter(key => {
		return key.startsWith(indexPattern);
	});

	keysToRemove.forEach(key => {
		delete tempDataArr[key];
	});

	return tempDataArr;
}

function removeKeyFromJson(data, keyToRemove = "THIS-KEY-REMOVE-BY-VISIBILTY-RULE") {
	if (Array.isArray(data)) {
		return data.map(item => removeKeyFromJson(item, keyToRemove));
	} else if (typeof data === 'object' && data !== null) {
		return Object.fromEntries(
			Object.entries(data)
				.filter(([_, value]) => value !== keyToRemove)
				.map(([key, value]) => [key, removeKeyFromJson(value, keyToRemove)])
		);
	}
	return data;
}

function findValue(path, obj) {
	if (!obj || !path) return undefined;
	const parts = path.match(/([^[.\]]+)/g);

	let current = obj;
	for (let part of parts) {
		if (current === undefined || current === null) return undefined;
		current = current[part];
	}
	return current;
}

function findValueJson(path, obj) {
	if (!path || typeof obj !== "object" || obj === null) return undefined;

	// Convert [0] style to .0 for easier splitting
	const normalizedPath = path.replace(/\[(\d+)\]/g, ".$1");
	const keys = normalizedPath.split(".");

	return keys.reduce((acc, key) => {
		if (acc === undefined || acc === null) return undefined;
		return acc[key];
	}, obj);
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

function ddepInboundEmailSend(enableLogs, enableFullLogs, companyCode, item, result, logDescription, disableInboundEmail, specificEmail, inboundPostData, errorBody, emailDdepInputPath, outboundApiUrls, outboundLastPath, queryString, schedulerUniqueId, querystring, header, disabledInboundEmailFailuresNotice) {
	return new Promise(async (resolve) => {
		const item_id = item._id;
		const CompanyCode = item.inbound_setting.CompanyCode;
		const inboundEnableLog = (item.inbound_setting.enableLog != undefined) ? item.inbound_setting.enableLog : "off";
		const inbound_setting = item.inbound_setting;

		let historyStatus = "fail";
		if (result != undefined && result == 1) {
			historyStatus = "success";
		}

		const logHistoryResult = await createInboundLogHistory({ "item_id": item._id, "status": historyStatus });
		if (logHistoryResult.status == 0) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Error while save inbound history " + logHistoryResult.message });
		} else {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Inbound history saved successfully" });
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "Inbound successfully run" });

		const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
		if (smtpResult.status === 1) {
			if (smtpResult?.data?.smtpActive == "1") {
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
					const isInboundDdepApiSuccess = (notification?.status == 1 && notification?.data?.isInboundDdepApiSuccess == "on") ? "Enabled" : "Disabled";
					const isInboundDdepApiFail = (notification?.status == 1 && notification?.data?.isInboundDdepApiFail == "on") ? "Enabled" : "Disabled";

					if (result == 1) {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: "FTP/SFTP > DDEP Inbound Successful : " + isInboundDdepApiSuccess });
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Option", description: "FTP/SFTP > DDEP Inbound Fail : " + isInboundDdepApiFail });
					}

					let isSend = notification?.data?.isInboundDdepApiSuccess;
					if (result != 1) {
						isSend = notification?.data?.isInboundDdepApiFail;
					}

					let email_failures_return_url = notification?.data?.email_failures_return_url || ""

					if (notification.status == 1 && isSend == "on" && !disableInboundEmail) {
						const projectDetails = await findProject(item.ProjectId);
						let usertoMail = "";
						let userTitle = "";
						if (projectDetails.status == 1) {
							usertoMail = projectDetails?.data?.email;
							userTitle = projectDetails?.data?.emailTitle;
						}

						// Extract item details
						const item_code = item.ItemCode;
						const item_name = item.ItemName;
						const inboundSetting = item.inbound_setting;
						const serverName = config.domain + "/" + config.ddepPrefix + "/" + CompanyCode + emailDdepInputPath;
						const outboundSetting = item.outbound_setting;
						let outboundApiUrl = outboundApiUrls.length > 0 ? outboundApiUrls[0] : "";

						if (outboundLastPath != "") {
							outboundApiUrl += outboundLastPath;
						}

						if (queryString != "") {
							outboundApiUrl += "?" + queryString;
						}

						const logURL = config.domain + "/" + "logs" + "/" + schedulerUniqueId;
						const providerName = notification.data.providerName;
						const toEmail = notification.data.email;

						const userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''}${logDescription ? ` - ${logDescription}` : ''} - ${result === 1 ? 'Inbound Successful' : 'Inbound Failure'} - ${item_code} - ${item_name}`;

						// Build email content
						let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DDEP Inbound Successful</title><style type="text/css">td{}</style></head><body style=""><center><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left;">`;

						mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Entrypoint URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${serverName}</td></tr>`;
						if (inboundSetting.email_endpoint_url) {
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Endpoint URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${outboundApiUrl}</td></tr>`;
						}
						if (inboundSetting.email_log_url) {
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Logs URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${logURL}</td></tr>`;
						}
						if (result != 1) {
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>HTTP STATUS:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">400 - Bad Request</td></tr>`;
						}
						mailContent += `</table>`;

						if (inboundSetting.email_request_header) {
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Request Header:</strong></td></tr>`;
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Key</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Value</strong></td></tr>`;
							for (const [key, value] of Object.entries(header)) {
								mailContent += `<tr><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;">${key}</td><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${value}</td></tr>`;
							}
							mailContent += `</table>`;
						}

						if (inboundSetting.email_query_params) {
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Query Params:</strong></td></tr>`;
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Key</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Value</strong></td></tr>`;
							for (const [key, value] of Object.entries(querystring)) {
								mailContent += `<tr><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;">${key}</td><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${value}</td></tr>`;
							}
							mailContent += `</table>`;
						}

						// Body section
						if (inboundSetting.email_body) {
							const jsonString = JSON.stringify(inboundPostData, null, 4);
							const formattedJsonString1 = formatJsonWithLineNumbers(jsonString);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body:</strong></td></tr>`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedJsonString1}</tbody></table></td></tr>`;
							mailContent += `</table>`;
						}

						if (inboundSetting.email_body_html) {
							try {
								let tableHtml = '';

								if (inboundPostData && typeof inboundPostData === 'object') {
									tableHtml = jsonToDynamicTable(inboundPostData, {
										maxDepth: 100,
										tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
										headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
										cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
										keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
									});
								} else {
									tableHtml = `<table style="width: 100%; border-collapse: collapse;">
													<tr>
														<td style="padding: 8px; border: 1px solid #ddd;">${formatPrimitiveValue(inboundPostData)}</td>
													</tr>
												</table>`;
								}

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
								mailContent += `</table>`;

							} catch (error) {
								console.error('Error generating HTML table:', error);
								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd; font-style: italic; color: #666;">""</tr>`;
								mailContent += `</table>`;
							}
						}

						if (inboundSetting.email_validation_message) {
							if (result != 1) {
								const errorString = JSON.stringify(errorBody, null, 4);
								const formattedErrorStringJsonString = formatJsonWithLineNumbers(errorString);

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Vaildation Message:</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedErrorStringJsonString}</tbody></table></td></tr>`;
								mailContent += `</table>`;
							}
						}

						/* if (inboundSetting.email_logs) {
							const logHistoriesResult = await getLoghistories(item_id, schedulerUniqueId, "DDEP Inbound");
							const logHistoriesResults = logHistoriesResult;
							const logHistoriesResultsData = logHistoriesResults.data;
							const filteredLogHistoriesResultsData = logHistoriesResultsData.filter(item =>
								['Inbound Start', 'Inbound Get', 'Inbound found', 'Inbound Item', 'Inbound User Posting']
									.includes(item.action)
							);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="6" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Logs:</strong></td></tr>`;
							let logEvents = '';
							if (filteredLogHistoriesResultsData.length > 0) {
								logEvents += `<tr><td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>No</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Action</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Description</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Type</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Http Status</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;"><strong>Created At</strong></td></tr>`;
							}
							for (let i = 0; i < filteredLogHistoriesResultsData.length; i++) {
								logEvents += `<tr>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${i + 1}</td>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].action}</td>`;

								try {
									const jsonparse = JSON.parse(filteredLogHistoriesResultsData[i].description);
									if (jsonparse.inbound_setting?.ftp_password) {
										delete jsonparse.inbound_setting.ftp_password;
									}
									if (jsonparse.ftp_password) {
										delete jsonparse.ftp_password;
									}
									let jsonstringify = JSON.stringify(jsonparse, null, " ").split("\n").join("<br>");
									logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;">${jsonstringify}</td>`;
								} catch (err) {
									logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].description}</td>`;
								}

								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].type}</td>`;
								const httpStatus = filteredLogHistoriesResultsData[i].httpStatus !== undefined ? filteredLogHistoriesResultsData[i].httpStatus : '';
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${httpStatus}</td>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].createdAt}</td>`;
								logEvents += `</tr>`;
							}

							mailContent += logEvents
						} */

						mailContent += `</table>`;

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

						let dateTime = new Date();

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Connect", description: "Queuing", queueId, createdAt: dateTime });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Send", description: "Queuing", queueId, createdAt: dateTime });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound Email Failure", description: "No", queueId, createdAt: dateTime });

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
							infoData: { itemId: item_id, uniqueId: schedulerUniqueId, itemName: item_name, entrypointURL: serverName, endpointURL: outboundApiUrl, emailTo: combinedTo, emailSubject: takenSubject, body: inboundPostData, transformedBody: errorBody, responseBody: "", transformedResponseBody: "", emailHtml: mailContent, dateTime, action: "Inbound Email Failure", description: "Yes", CompanyCode, queueId, email_failures_return_url, disbleFlag: disabledInboundEmailFailuresNotice },

							successDescription: item_id + " > Sent DDEP Inbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Success",
							errorDescription: item_id + " > Sent DDEP Inbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Fail : Error : "
						}

						await queue.add(mailQueueConfig.name, mockJobData, { jobId: queueId, delay: 0, removeOnComplete: 10, removeOnFail: 10 });

						resolve({ code: "1", response: "" });

					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: "Inbound DDEP API Success Notification Disabled" });

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
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Inbound", description: smtpResult.message + " - Some error occurred while getting the SMTP setting." });

			resolve();
		}

	});
}

function jsonToDynamicTable(data, options = {}) {
	const defaultOptions = {
		tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
		headerStyle: 'font-weight: bold; text-align: left; padding: 8px; border: 1px solid #ddd;',
		cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
		keyCellStyle: 'width: 30%;',
		maxDepth: 100,
		currentDepth: 0,
		parentKey: ''
	};

	const config = { ...defaultOptions, ...options };

	if (config.currentDepth >= config.maxDepth) {
		return `<span style="color: #666; font-style: italic;">
						[Deeply nested data - ${config.parentKey}]
				</span>`;
	}

	// Handle primitive values
	if (data === null || data === undefined || typeof data !== 'object') {
		return `<td colspan="2" style="${config.cellStyle}">${formatPrimitiveValue(data)}</td>`;
	}

	// Handle arrays
	if (Array.isArray(data)) {
		if (data.length === 0) {
			return `<td colspan="2" style="${config.cellStyle}">[]</td>`;
		}

		let html = `<table style="${config.tableStyle}">`;

		const isObjectArray = data.some(item => typeof item === 'object' && item !== null);

		if (isObjectArray) {
			const allKeys = [...new Set(data.flatMap(item =>
				item ? Object.keys(item) : []
			))];

			// Header row
			html += `<tr>`;
			allKeys.forEach(key => {
				html += `<th style="${config.headerStyle}">${key}</th>`;
			});
			html += `</tr>`;

			// Data rows
			data.forEach((item, index) => {
				html += `<tr>`;
				if (!item) {
					html += `<td style="${config.cellStyle}" colspan="${allKeys.length}">null or undefined</td>`;
				} else {
					allKeys.forEach(key => {
						const value = item[key];
						html += `<td style="${config.cellStyle}">`;
						if (typeof value === 'object' && value !== null) {
							html += jsonToDynamicTable(value, {
								...config,
								currentDepth: config.currentDepth + 1,
								parentKey: key
							});
						} else {
							html += formatPrimitiveValue(value);
						}
						html += `</td>`;
					});
				}
				html += `</tr>`;
			});
		} else {
			// Simple array of primitives
			html += `<tr><th style="${config.headerStyle}">Index</th><th style="${config.headerStyle}">Value</th></tr>`;
			data.forEach((item, index) => {
				html += `<tr>
							<td style="${config.cellStyle}">${index}</td>
							<td style="${config.cellStyle}">${formatPrimitiveValue(item)}</td>
						</tr>`;
			});
		}

		html += `</table>`;
		return html;
	}

	// Handle objects
	let html = `<table style="${config.tableStyle}">`;

	for (const [key, value] of Object.entries(data)) {
		html += `<tr>
					<td style="${config.cellStyle} ${config.keyCellStyle}">${key}</td>
					<td style="${config.cellStyle}">`;

		if (typeof value === 'object' && value !== null) {
			html += jsonToDynamicTable(value, {
				...config,
				currentDepth: config.currentDepth + 1,
				parentKey: key
			});
		} else {
			html += formatPrimitiveValue(value);
		}

		html += `</td></tr>`;
	}

	html += `</table>`;
	return html;
}

function formatPrimitiveValue(value) {
	if (value === null) return '<span>null</span>';
	if (value === undefined) return '<span>undefined</span>';
	if (value === '') return '<span></span>';
	if (typeof value === 'boolean') return value ? '<span>true</span>' : '<span>false</span>';
	if (typeof value === 'number') return `<span>${value}</span>`;
	if (typeof value === 'string') {
		if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
			return `<span>${value}</span>`;
		}
		return value;
	}
	return value;
}

function ddepOutboundEmailSend(enableLogs, enableFullLogs, companyCode, item, result, logDescription, disableOutboundEmail, specificEmail, emailDdepInputPath = "", postBody = {}, inboundMappingData = {}, outbound_api_options_body = {}, responseBody = {}, transformedBody = {}, errorBody = {}, httpStatus, schedulerUniqueId, querystring, header, disabledOutboundEmailFailuresNotice) {
	return new Promise(async (resolve) => {
		const item_id = item._id;
		const CompanyCode = item.inbound_setting.CompanyCode;
		const outboundEnableLog = (item.outbound_setting.enableLog != undefined) ? item.outbound_setting.enableLog : "off";
		const outbound_setting = item.outbound_setting;

		let historyStatus = "fail";
		if (result != undefined && result == 1) {
			historyStatus = "success";
		}

		const logHistoryResult = await createOutboundLogHistory({ "item_id": item._id, "status": historyStatus });
		if (logHistoryResult.status == 0) {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Error while save outbound history " + logHistoryResult.message });
		} else {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Save", description: "Outbound history saved successfully" });
		}

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "Outbound successfully run" });

		const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
		if (smtpResult.status === 1) {
			if (smtpResult?.data?.smtpActive == "1") {
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
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

					let email_failures_return_url = notification?.data?.email_failures_return_url || ""

					if (notification.status == 1 && isSend == "on" && !disableOutboundEmail) {
						const logHistoriesResult = await getLoghistories(item_id, schedulerUniqueId, "DDEP Outbound");
						const logHistoriesResults = logHistoriesResult;
						const logHistoriesResultsData = logHistoriesResults.data;
						const item_code = item.ItemCode;
						const item_name = item.ItemName;
						const inboundSetting = item.inbound_setting;
						const serverName = config.domain + "/" + config.ddepPrefix + "/" + CompanyCode + emailDdepInputPath;
						const outboundSetting = item.outbound_setting;
						let outboundApiUrl = outboundSetting.api_url;
						const projectDetails = await findProject(item.ProjectId);
						let usertoMail = "";
						let userTitle = "";
						if (projectDetails.status == 1) {
							usertoMail = projectDetails?.data?.email;
							userTitle = projectDetails?.data?.emailTitle;
						}
						let queryString = "";
						Object.entries(querystring).forEach(([key, value]) => {
							if (queryString != "") { queryString += "&"; }
							queryString += key + "=" + value;
						});

						if (queryString != "") {
							outboundApiUrl += "?" + queryString;
						}

						const providerName = notification.data.providerName;
						const toEmail = notification.data.email;
						const logURL = config.domain + "/" + "logs" + "/" + schedulerUniqueId;

						const userEmailSubject = `${providerName}${userTitle ? ` - ${userTitle}` : ''}${logDescription ? ` - ${logDescription}` : ''} - ${result === 1 ? 'Outbound Successful' : 'Outbound Failure'} - ${item_code} - ${item_name}`;
						const timeConsumed = getTimeConsumed(logHistoriesResultsData);


						let mailContent = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DDEP Inbound Successful</title><style type="text/css"></style></head><body style=""><center><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left;">`;
						mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Entrypoint URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${serverName}</td></tr>`;

						if (outbound_setting.email_endpoint_url) {
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Endpoint URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${outboundApiUrl}</td></tr>`;
						}
						if (outbound_setting.email_log_url) {
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Logs URL:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${logURL}</td></tr>`;
						}
						mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>HTTP STATUS:</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${httpStatus}</td></tr>`;
						mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Time Consumed (ms):</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;">${timeConsumed}</td></tr>`;
						mailContent += `</table>`;

						if (outbound_setting.email_request_header) {
							// Request Header
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Request Header:</strong></td></tr>`;
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Key</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Value</strong></td></tr>`;
							for (const [key, value] of Object.entries(header)) {
								mailContent += `<tr><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${key}</td><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${value}</td></tr>`;
							}
							mailContent += `</table>`;
						}

						if (outbound_setting.email_transformed_header) {
							// Transformed Request Header
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Transformed Request Header:</strong></td></tr>`;
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Key</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Value</strong></td></tr>`;
							for (const [key, value] of Object.entries(outbound_api_options_body.headers)) {
								mailContent += `<tr><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${key}</td><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${value}</td></tr>`;
							}
							mailContent += `</table>`;
						}

						if (outbound_setting.email_query_params) {
							// Query Params
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Query Params:</strong></td></tr>`;
							mailContent += `<tr><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Key</strong></td><td style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Value</strong></td></tr>`;
							for (const [key, value] of Object.entries(querystring)) {
								mailContent += `<tr><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${key}</td><td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${value}</td></tr>`;
							}
							mailContent += `</table>`;
						}

						if (outbound_setting.email_body) {
							// Body
							const bodyString = JSON.stringify(postBody, null, 4);
							const formattedbodyString = formatJsonWithLineNumbers(bodyString);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body:</strong></td></tr>`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedbodyString}</tbody></table></td></tr>`;
							mailContent += `</table>`;
						}

						if (outbound_setting.email_body_html) {
							try {
								let tableHtml = '';

								if (postBody && typeof postBody === 'object') {
									tableHtml = jsonToDynamicTable(postBody, {
										maxDepth: 100,
										tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
										headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
										cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
										keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
									});
								} else {
									tableHtml = `<table style="width: 100%; border-collapse: collapse;">
													<tr>
														<td style="padding: 8px; border: 1px solid #ddd;">${formatPrimitiveValue(postBody)}</td>
													</tr>
												</table>`;
								}

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
								mailContent += `</table>`;

							} catch (error) {
								console.error('Error generating HTML table:', error);
								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd; font-style: italic; color: #666;">""</tr>`;
								mailContent += `</table>`;
							}
						}

						if (outbound_setting.email_transformed_body) {
							// Transformed Body
							const jsonInboundMappingDataString = JSON.stringify(inboundMappingData, null, 4);
							const formattedjsonInboundMappingDataStringJsonString = formatJsonWithLineNumbers(jsonInboundMappingDataString);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Transformed Body:</strong></td></tr>`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedjsonInboundMappingDataStringJsonString}</tbody></table></td></tr>`;
							mailContent += `</table>`;
						}

						if (outbound_setting.email_transformed_body_html) {
							try {
								let tableHtml = '';

								if (inboundMappingData && typeof inboundMappingData === 'object') {
									tableHtml = jsonToDynamicTable(inboundMappingData, {
										maxDepth: 100,
										tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
										headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
										cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
										keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
									});
								} else {
									tableHtml = `<table style="width: 100%; border-collapse: collapse;">
													<tr>
														<td style="padding: 8px; border: 1px solid #ddd;">${formatPrimitiveValue(inboundMappingData)}</td>
													</tr>
												</table>`;
								}

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Transformed Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
								mailContent += `</table>`;

							} catch (error) {
								console.error('Error generating HTML table:', error);
								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd; font-style: italic; color: #666;">""</tr>`;
								mailContent += `</table>`;
							}
						}

						if (outbound_setting.email_request_endpoint_url_information) {
							// Request to Endpoint URL Information
							const jsonOutboundOpitonsString = JSON.stringify(outbound_api_options_body, null, 4);
							const formattedjOutboundOptionsStringJsonString = formatJsonWithLineNumbers(jsonOutboundOpitonsString);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Request to Endpoint URL Information:</strong></td></tr>`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedjOutboundOptionsStringJsonString}</tbody></table></td></tr>`;
							mailContent += `</table>`;
						}

						if (outbound_setting.email_response) {
							// Response
							const jsonOutboundResponseBodyString = JSON.stringify(responseBody, null, 4);
							const formattedResponseBodyString = formatJsonWithLineNumbers(jsonOutboundResponseBodyString);

							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Response:</strong></td></tr>`;
							mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedResponseBodyString}</tbody></table></td></tr>`;
							mailContent += `</table>`;
						}

						if (outbound_setting.email_response_html) {
							try {
								let tableHtml = '';

								if (responseBody && typeof responseBody === 'object') {
									tableHtml = jsonToDynamicTable(responseBody, {
										maxDepth: 100,
										tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
										headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
										cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
										keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
									});
								} else {
									tableHtml = `<table style="width: 100%; border-collapse: collapse;">
													<tr>
														<td style="padding: 8px; border: 1px solid #ddd;">${formatPrimitiveValue(responseBody)}</td>
													</tr>
												</table>`;
								}

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Response (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
								mailContent += `</table>`;

							} catch (error) {
								console.error('Error generating HTML table:', error);
								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd; font-style: italic; color: #666;">""</tr>`;
								mailContent += `</table>`;
							}
						}

						if (outbound_setting.email_transformed_response) {
							// Transformed Response
							if (result == 1 || Object.keys(errorBody).length == 0) {
								const jsontransformedOutboundResponseBodyString = JSON.stringify(transformedBody, null, 4);
								const formattedTransformedResponseBodyString = formatJsonWithLineNumbers(jsontransformedOutboundResponseBodyString);

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Transformed Response:</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedTransformedResponseBodyString}</tbody></table></td></tr>`;
								mailContent += `</table>`;
							}
						}

						if (outbound_setting.email_transformed_response_html) {
							if (result == 1 || Object.keys(errorBody).length == 0) {
								try {
									let tableHtml = '';

									if (transformedBody && typeof transformedBody === 'object') {
										tableHtml = jsonToDynamicTable(transformedBody, {
											maxDepth: 100,
											tableStyle: 'width: 100%; border-collapse: collapse; font-family: Arial, sans-serif;',
											headerStyle: 'font-weight: bold; padding: 8px; border: 1px solid #ddd;',
											cellStyle: 'padding: 8px; border: 1px solid #ddd; vertical-align: top;',
											keyCellStyle: 'width: 30%; background-color: #f5f5f5; font-weight: bold;'
										});
									} else {
										tableHtml = `<table style="width: 100%; border-collapse: collapse;">
													<tr>
														<td style="padding: 8px; border: 1px solid #ddd;">${formatPrimitiveValue(transformedBody)}</td>
													</tr>
												</table>`;
									}

									mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Transformed Response (Table):</strong></td></tr>`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd; border-bottom: none;">${tableHtml}</td></tr>`;
									mailContent += `</table>`;

								} catch (error) {
									console.error('Error generating HTML table:', error);
									mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; text-align: left; margin-top:30px">`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Body (Table):</strong></td></tr>`;
									mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd; font-style: italic; color: #666;">""</tr>`;
									mailContent += `</table>`;
								}
							}
						}

						if (outbound_setting.email_validation_message) {
							// Vaildation Message
							if (result != 1 && Object.keys(errorBody).length > 0) {
								const errorString = JSON.stringify(errorBody, null, 4);
								const formattedErrorStringJsonString = formatJsonWithLineNumbers(errorString);

								mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Vaildation Message:</strong></td></tr>`;
								mailContent += `<tr><td colspan="2" style="background-color:#FFFFFF; color:#000000; padding:0px; border: 1px solid #ddd;"><table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%; border-collapse: collapse;"><tbody>${formattedErrorStringJsonString}</tbody></table></td></tr>`;
								mailContent += `</table>`;
							}
						}

						/* if (outbound_setting.email_logs) {
							const EXCLUDED_ACTIONS = [
								'Start',
								'Inbound Email Option',
								'Inbound Email Connect',
								'Inbound Email Send',
								'Outbound Email Option',
								'Outbound Email Connect',
								'Outbound Email Send'
							];

							const filteredLogHistoriesResultsData = logHistoriesResultsData.filter(item => {
								return !EXCLUDED_ACTIONS.includes(item.action);
							});
							mailContent += `<table width="100%" cellpadding="0" cellspacing="0" style="min-width:100%;text-align: left; margin-top:30px">`;
							mailContent += `<tr><td colspan="6" style="background-color:#FFFFFF; color:#000000; padding:10px; border: 1px solid #ddd;"><strong>Logs:</strong></td></tr>`;
							let logEvents = '';
							if (filteredLogHistoriesResultsData.length > 0) {
								logEvents += `<tr><td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;"><strong>No</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Action</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Description</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Type</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Http Status</strong></td>`;
								logEvents += `<td scope="col" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px;border: 1px solid #ddd;"><strong>Created At</strong></td></tr>`;
							}

							for (let i = 0; i < filteredLogHistoriesResultsData.length; i++) {
								logEvents += `<tr>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${i + 1}</td>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].action}</td>`;

								try {
									const jsonparse = JSON.parse(filteredLogHistoriesResultsData[i].description);
									if (jsonparse.inbound_setting?.ftp_password) {
										delete jsonparse.inbound_setting.ftp_password;
									}
									if (jsonparse.ftp_password) {
										delete jsonparse.ftp_password;
									}
									let jsonstringify = JSON.stringify(jsonparse, null, " ").split("\n").join("<br>");
									logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${jsonstringify}</td>`;
								} catch (err) {
									logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].description}</td>`;
								}

								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].type}</td>`;
								const httpStatus = filteredLogHistoriesResultsData[i].httpStatus !== undefined ? filteredLogHistoriesResultsData[i].httpStatus : '';
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${httpStatus}</td>`;
								logEvents += `<td valign="top" style="padding:10px; font-family: Arial,sans-serif; font-size: 14px; line-height:20px; border: 1px solid #ddd;">${filteredLogHistoriesResultsData[i].createdAt}</td>`;
								logEvents += `</tr>`;
							}
							mailContent += logEvents
						} */

						mailContent += `</table></center></body></html>`;

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

						let dateTime = new Date();

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Connect", description: "Queuing", queueId, createdAt: dateTime });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Send", description: "Queuing", queueId, createdAt: dateTime });

						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound Email Failure", description: "No", queueId, createdAt: dateTime });

						const queue = mailQueue;

						let out_body;
						let out_transformedBody;
						let out_res_body;
						let out_res_transformedBody;
						out_body = postBody !== undefined && postBody !== null ? safeJSONWithOutStringify(postBody, config.dataSize) : {};

						out_transformedBody = isNonEmptyObjectOrArray(inboundMappingData) ? safeJSONWithOutStringify(inboundMappingData, config.dataSize) : {};

						if (isNonEmptyObjectOrArray(responseBody)) {
							out_res_body = safeJSONWithOutStringify(responseBody, config.dataSize);
						} else {
							out_res_body = safeJSONWithOutStringify(responseBody, config.dataSize) || {};
						}

						if (isNonEmptyObjectOrArray(transformedBody)) {
							out_res_transformedBody = safeJSONWithOutStringify(transformedBody, config.dataSize);
						} else {
							out_res_transformedBody = errorBody || {};
						}

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

							infoData: { itemId: item_id, uniqueId: schedulerUniqueId, itemName: item_name, entrypointURL: serverName, endpointURL: outboundApiUrl, emailTo: combinedTo, emailSubject: takenSubject, body: out_body, transformedBody: out_transformedBody, responseBody: out_res_body, transformedResponseBody: out_res_transformedBody, emailHtml: mailContent, dateTime, action: "Outbound Email Failure", description: "Yes", CompanyCode, queueId, email_failures_return_url, disbleFlag: disabledOutboundEmailFailuresNotice },

							successDescription: item_id + " > Sent DDEP Outbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Success",
							errorDescription: item_id + " > Sent DDEP Outbound " + (result == 1 ? "Successful" : "Fail") + " Email to " + combinedTo + " : Fail : Error : "
						}

						await queue.add(mailQueueConfig.name, mockJobData, { delay: 0, removeOnComplete: 10, removeOnFail: 10 });

						resolve({ code: "1", response: "" });
					} else {
						addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "Outbound DDEP API Success Notification Disabled" });

						resolve();
					}
				} else {
					addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: notification.message + " - Some error occurred while getting the notification setting." });

					resolve();
				}
			} else {
				addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: "SMTP setting not active." });

				resolve();
			}
		} else {
			addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id: item._id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound", description: smtpResult.message + " - Some error occurred while getting the SMTP setting." });
			resolve();
		}
	});
}

function isNonEmptyObjectOrArray(val) {
	if (val === null || val === undefined) return false;

	if (Array.isArray(val)) return val.length > 0;
	if (typeof val === 'object') return Object.keys(val).length > 0;

	return false;
}

async function getLoghistories(item_id, schedulerUniqueId, type) {
	try {
		const result = await findAllLogFullListForLogHistory(item_id, schedulerUniqueId, type);
		return result;
	} catch (err) {
		return { status: 0, message: "Failed to fetch log histories.", error: err };
	}
}

function formatJsonWithLineNumbers(jsonString) {
	const lines = jsonString.split('\n');
	let formattedString = '';

	lines.forEach((line, index) => {
		// Only border after line number column and fixed 50px width
		formattedString +=
			`<tr style="line-height: 1.5;">` +
			`<td style="width: 50px; color: #666; font-size: 14px; font-family: Courier, monospace; padding:2px 8px; text-align: left; vertical-align: top; border: none; border-right: 1px solid #ddd;">${index + 1}</td>` +
			`<td style="font-family: Courier, monospace; font-size: 14px; padding:2px 8px; vertical-align: top; border: none;">${line.replace(/ /g, '&nbsp;')}</td>` +
			`</tr>`;
	});

	return formattedString;
}

function getTimeConsumed(data) {
	if (!Array.isArray(data) || data.length === 0) return 0;

	const record = data.find((item) => item.action === "Start" && item.item_id);
	if (!record || !record.createdAt || !data[0]?.last_end_log_history?.createdAt) {
		console.warn("Start or End record missing or invalid.");
		return 0;
	}

	const startDate = new Date(record.createdAt);
	const endDate = new Date(data[0].last_end_log_history.createdAt);

	const differenceInMilliseconds = endDate - startDate;
	return differenceInMilliseconds;
}

async function generateCurlCommand({
	method,
	protocol,
	host,
	originalUrl,
	headers = {},
	query = {},
	body = null,
	bodyType = "JSON" // JSON | TEXT | HTML | XML | FORM_URLENCODED | FORM_DATA | RAW
}) {
	const upperMethod = method.toUpperCase();

	/* ---------------- URL ---------------- */
	const queryStr = new URLSearchParams(query).toString();
	const fullUrl = `${protocol}://${host}${originalUrl}${queryStr ? `?${queryStr}` : ""}`;

	/* ---------------- Headers ---------------- */
	const finalHeaders = { ...headers };

	// Set content-type from bodyType if not already present
	const contentType =
		finalHeaders["content-type"] ||
		finalHeaders["Content-Type"] ||
		getContentType(bodyType);

	if (!finalHeaders["content-type"] && !finalHeaders["Content-Type"]) {
		finalHeaders["Content-Type"] = contentType;
	}

	const headersStr = Object.entries(finalHeaders)
		.map(([k, v]) => `  -H '${k}: ${String(v).replace(/'/g, `'\\''`)}' \\`)
		.join("\n");

	let curl = `curl -X ${upperMethod} '${fullUrl}' \\\n${headersStr}`;

	/* ---------------- Body Handling (POSTMAN STYLE) ---------------- */
	if (!["GET", "HEAD"].includes(upperMethod) && body !== null && body !== undefined) {

		// ---------- JSON ----------
		if (bodyType === "JSON") {
			let jsonBody = body;

			// Parse only if string JSON
			if (typeof body === "string") {
				try {
					jsonBody = JSON.parse(body);
				} catch {
					// Not valid JSON → keep raw string
					jsonBody = body;
				}
			}

			if (typeof jsonBody === "object") {
				curl += `\n  --data-raw '${JSON.stringify(jsonBody, null, 2).replace(/'/g, `'\\''`)}'`;
			} else {
				curl += `\n  --data-raw '${String(jsonBody).replace(/'/g, `'\\''`)}'`;
			}
		}

		// ---------- TEXT / HTML / XML ----------
		else if (["TEXT", "HTML", "XML", "RAW"].includes(bodyType)) {
			curl += `\n  --data-raw '${String(body).replace(/'/g, `'\\''`)}'`;
		}

		// ---------- x-www-form-urlencoded ----------
		else if (bodyType === "FORM_URLENCODED" && typeof body === "object") {
			const encoded = Object.entries(body)
				.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
				.join("&");

			curl += `\n  --data '${encoded}'`;
		}

		// ---------- multipart/form-data ----------
		else if (bodyType === "FORM_DATA" && typeof body === "object") {
			const formParts = Object.entries(body)
				.map(
					([k, v]) =>
						`  --form '${k}="${String(v).replace(/"/g, '\\"')}"' \\`
				)
				.join("\n");

			curl += `\n${formParts}`;
		}

		// ---------- Fallback ----------
		else {
			curl += `\n  --data-raw '${String(body).replace(/'/g, `'\\''`)}'`;
		}
	}

	return curl.replace(/\\\s*$/, "");
}


async function generateLogDescriptionFormulaForMail({ logDescriptionTemplate, companyCode, OutboundFormatData, inboundFormatData, item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method, endpointMeta, body, transformedBody, resBody, resTransformedBody }) {
	let replacedDescription = replacePlaceholders(logDescriptionTemplate || '', {}, {}, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);

	replacedDescription = await processWebhookContent(replacedDescription, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, body, transformedBody, resBody, resTransformedBody, {}, endpointMeta);

	let logDescriptionFormula = await formulaGetValue(companyCode, replacedDescription, replacedDescription, "", {}, {}, includesKey = "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, request_method);

	return logDescriptionFormula;
}

async function handleOutboundFailure({ item_id, schedulerUniqueId, item, fullUrl, outbound_api_url, inboundPostData, inboundMappingData, body, resTransformedBody, response_failures_return_url, CompanyCode, enableFullLogs, enableLogs, outboundEnableLog, request_id, httpStatus, type }) {
	const prepareBody = (data) => (data && isNonEmptyObjectOrArray(data)) ? safeJSONWithOutStringify(data, config.dataSize) : data || {};

	const out_body = prepareBody(inboundPostData);
	const out_transformedBody = prepareBody(inboundMappingData);
	const out_res_body = prepareBody(body);
	const out_res_transformedBody = prepareBody(resTransformedBody);

	const successCodes = [200, 201, 202, 203, 204, 205, 206, 207, 208, 226];
	if (!response_failures_return_url || successCodes.includes(httpStatus)) return;

	const dateTime = new Date();

	const infoData = {
		itemId: item_id,
		uniqueId: schedulerUniqueId,
		itemName: item.ItemName,
		entrypointURL: fullUrl,
		endpointURL: outbound_api_url,
		body: out_body,
		transformedBody: out_transformedBody,
		responseBody: out_res_body,
		transformedResponseBody: out_res_transformedBody,
		dateTime,
		CompanyCode,
		httpStatus: httpStatus
	};

	const payload = {
		...infoData,
		body: convertIfJSON(infoData.body),
		transformedBody: convertIfJSON(infoData.transformedBody),
		responseBody: convertIfJSON(infoData.responseBody),
		transformedResponseBody: convertIfJSON(infoData.transformedResponseBody)
	};

	// Log outbound failure post data
	addToLogQueue({ CompanyCode, unique_id: schedulerUniqueId, type: type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Failure Post Data", description: "Posting Data", datas: (enableFullLogs === "on" || (enableLogs === "on" && outboundEnableLog === "on")) ? JSON.stringify(payload) : "", request_id });

	const response_failure = await excuteResponseReturnUrl(infoData, response_failures_return_url);

	// Log response
	if (response_failure.success) {
		addToLogQueue({ CompanyCode, unique_id: schedulerUniqueId, type: type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Failure Response", description: "Response Data", datas: (enableFullLogs === "on" || (enableLogs === "on" && outboundEnableLog === "on")) ? JSON.stringify(response_failure.data) : "", request_id });
	} else {
		addToLogQueue({ CompanyCode, unique_id: schedulerUniqueId, type: type, item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Outbound API Failure Response", description: `${response_failure.errorMessage} - Some error occurred while sending failure response to returnUrl.`, httpStatus: "500 SERVER ERROR", request_id });
	}
}

async function handleDiffCheckerReturnUrl(notifyBaseLogData, diffCheckReturnUrl, recordToStore) {
	const payload = { ...recordToStore };
	// Log outbound failure post data
	addToLogDiffQueue({ ...notifyBaseLogData, action: `${recordToStore.type} Diff Checker Return URL Post Data`, description: "Posting Data", datas: JSON.stringify(payload) });

	const diff_checker = await diffCheckerReturnUrl(payload, diffCheckReturnUrl);
	// Log response
	if (diff_checker.success) {
		addToLogDiffQueue({ ...notifyBaseLogData, action: `${recordToStore.type} Diff Checker Return URL Response Data`, description: "Response Data", datas: JSON.stringify(diff_checker.data), httpStatus: diff_checker.status });
	} else {
		addToLogDiffQueue({ ...notifyBaseLogData, action: `${recordToStore.type} Response`, description: `${diff_checker.errorMessage} - Some error occurred while sending response to returnUrl.`, httpStatus: diff_checker.status });
	}
}

async function emailSend({ triggerWhen, email, emailSubject, result, enableLogs, itemLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id, disabledMail, body, transformedBody, responseBody, transformedResponseBody, entrypointURL, endpointURL }) {
	try {
		const queueId = uuidv4();
		let dateTime = new Date();

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Email Connect", description: "Queuing", queueId, createdAt: dateTime, request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: `Action-Email Trigger when , ${triggerWhen} Sending Email`, description: "Queuing", queueId, createdAt: dateTime, request_id });

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "Email", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Email Failure", description: "No", queueId, createdAt: dateTime, request_id });

		const smtpResult = await getGeneralSetting(companyCode, "email-smtp");
		if (smtpResult.status === 1) {
			if (smtpResult?.data?.smtpActive == "1") {
				const notification = await getNotificationSettings(companyCode, "notification");
				if (notification.status == 1) {
					const item_name = item.ItemName;
					let out_body;
					let out_transformedBody;
					let out_res_body;
					let out_res_transformedBody;
					out_body = body !== undefined && body !== null ? safeJSONWithOutStringify(body, config.dataSize) : {};
					out_transformedBody = isNonEmptyObjectOrArray(transformedBody) ? safeJSONWithOutStringify(transformedBody, config.dataSize) : {};

					if (isNonEmptyObjectOrArray(responseBody)) {
						out_res_body = safeJSONWithOutStringify(responseBody, config.dataSize);
					} else {
						out_res_body = safeJSONWithOutStringify(responseBody, config.dataSize) || {};
					}

					if (isNonEmptyObjectOrArray(transformedResponseBody)) {
						out_res_transformedBody = safeJSONWithOutStringify(transformedResponseBody, config.dataSize);
					} else {
						out_res_transformedBody = transformedResponseBody || {};
					}

					let email_failures_return_url = notification?.data?.email_failures_return_url || "";
					const queue = mailActionQueue;
					const providerName = notification.data.providerName;
					const smtpSecure = smtpResult.data.smtpPort == 465;
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
							to: email.to,
							subject: emailSubject,
							html: result,
						},
						logDataConnect: {
							action: "Action-Email Connect",
							description: "SMTP " + smtpResult.data.smtpServer + " connected"
						},
						logDataSend: {
							action: `Action-Email Trigger when , ${triggerWhen} Sending Email`,
						},
						infoData: { itemId: item_id, uniqueId: schedulerUniqueId, itemName: item_name, emailTo: email.to, emailSubject: emailSubject, body: out_body, transformedBody: out_transformedBody, responseBody: out_res_body, transformedResponseBody: out_res_transformedBody, emailHtml: result, dateTime, action: "Action-Email Failure", description: "Yes", CompanyCode: companyCode, queueId, email_failures_return_url, disbleFlag: disabledMail, entrypointURL, endpointURL },
						successDescription: item_id + " > Sent Action-Email " + " Email to " + email.to + " : Success",
						errorDescription: item_id + " > Sent Action-Email " + " Email to " + email.to + " : Fail : Error : "
					}
					await queue.add(mailQueueConfig.name_action_mail, mockJobData, { delay: 0, removeOnComplete: 10, removeOnFail: 10 });
				}
			}
		}

	} catch (error) {
		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Email", description: `${triggerWhen} Email Send Failed`, datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? JSON.stringify({ error: error.message }) : "", httpStatus: "500 Error", request_id });
	}
}

async function webhook_call({ upUrl, methodType, triggerWhen, webhook, result, actionHeaders, enableLogs, itemLog, enableFullLogs, companyCode, schedulerUniqueId, item_id, item, request_id }) {
	try {
		const method = methodType || "POST";
		const url = upUrl;

		let bodyToSend = null;

		switch (webhook.bodyType) {
			case "JSON":
				try {
					bodyToSend = JSON.parse(result);
				} catch {
					bodyToSend = result;
				}
				break;

			case "TEXT":
			case "HTML":
			case "XML":
				bodyToSend = result;
				break;

			default:
				bodyToSend = result;
				break;
		}

		const finalHeaders = {
			...actionHeaders,
			"Content-Type": getContentType(webhook.bodyType)
		};

		const axiosConfig = {
			method,
			url,
			headers: finalHeaders || {},
			data: bodyToSend,
			maxBodyLength: Infinity,
			maxContentLength: Infinity,
		};

		let reqOptions = JSON.stringify({ ...axiosConfig, data: safeJSONStringify(axiosConfig.data, config.dataSize) })

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Webhook", description: `${triggerWhen} Posting Data`, datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? reqOptions : "", request_id });

		const response = await axios(axiosConfig);

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Webhook", description: `${triggerWhen} Response Data`, datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? JSON.stringify(response.data) : "", httpStatus: response?.status + " " + response?.statusText, request_id });

	} catch (error) {
		console.error("Webhook Call Error:", error.message);

		addToLogQueue({ CompanyCode: companyCode, unique_id: schedulerUniqueId, type: "DDEP API", item_id, projectId: item.ProjectId, companyId: item.companyId, environmentId: item.environmentId, companyName: item.companyName, projectName: item.projectName, environmentName: item.environmentName, action: "Action-Webhook", description: `${triggerWhen} Response Data`, datas: (enableFullLogs == "on" || (enableLogs == "on" && itemLog == "on")) ? JSON.stringify(error?.response?.data) : "", httpStatus: error?.response?.status + " " + error?.response?.statusText, request_id });
	}

}

function getContentType(type) {
	switch (type) {
		case "JSON": return "application/json";
		case "TEXT": return "text/plain";
		case "HTML": return "text/html";
		case "XML": return "application/xml";
		default: return "application/octet-stream";
	}
}

const processVariablesAndHeaders = async (companyCode, items, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, item) => {
	const result = {};
	if (!items || items.length === 0) return result;

	try {
		const cloned = JSON.parse(JSON.stringify(items));

		for (let i = 0; i < cloned.length; i++) {
			const { key, value, enabled } = cloned[i];
			if ((enabled === true || enabled === "true") && key) {
				let val = value || '';
				val = replacePlaceholders(val, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId);
				val = await formulaGetValue(companyCode, val, val, "", {}, {}, "@Out{", item, schedulerUniqueId, outboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method);
				result[key] = val;
			}
		}
		return result;
	} catch (cloneErr) {
		console.error("Error in processVariablesAndHeaders:", cloneErr.message);
		return result;
	}
};

const processWebhookContent = async (webhookContent, companyCode, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, outboundMappedData, actionVariables, endpointMeta) => {
	if (!webhookContent || typeof webhookContent !== 'string') {
		return webhookContent;
	}

	// Build context from all data sources
	const context = await buildWebhookContext(querystring, header, reqIn, reqOut, resIn, resOut, global, request_method, schedulerUniqueId, inboundPostData, inboundMappingData, body, outboundMappedData, OutboundFormatData, inboundFormatData, actionVariables, endpointMeta);

	// Extract all {{ }} blocks
	const expressions = extractHyperFormulaBlocks(webhookContent);

	if (expressions.length === 0) {
		const trimmed = webhookContent.trim();
		if (trimmed in context) {
			return context[trimmed];
		}
		return webhookContent;
	}

	// Check if entire content is a single expression returning an object
	if (expressions.length === 1 && webhookContent.trim() === expressions[0].fullMatch.trim()) {
		const expr = expressions[0].expression.trim();

		// Check for direct object reference
		if (context[expr] !== undefined && typeof context[expr] === 'object') {
			return context[expr];
		}
	}


	// Evaluate all expressions
	const results = evaluateExpressionsWithHyperFormula(expressions, context);

	// Replace expressions in template
	let processedContent = webhookContent;

	for (const { original, value } of results) {
		let replacement;
		const isMustache =
			typeof original === "string" && original.trim().startsWith('{{') &&
			typeof original === "string" && original.trim().endsWith('}}') && typeof value === "string" && value.startsWith('{{') &&
			typeof value === "string" && value.trim().endsWith('}}');
		if (original == value && isMustache) {
			replacement = 'null';
		} else if (typeof value === 'object' && value !== null) {
			// If entire content is this object, return it
			if (processedContent.trim() === original.trim()) {
				return value;
			}
			// Otherwise stringify for JSON context
			replacement = JSON.stringify(value);
		} else if (value === null) {
			replacement = 'null';
		} else {
			replacement = String(value);
		}

		console.log(`Replacing "${original}" with "${replacement}"`);
		processedContent = processedContent.replace(original, replacement);
	}

	// Try to parse as JSON if it looks like JSON
	if (processedContent.trim().startsWith('{') || processedContent.trim().startsWith('[')) {
		try {
			const parsed = JSON.parse(processedContent);
			return parsed;
		} catch (e) {
			console.log('Not valid JSON, returning as string:', e.message);
		}
	}

	return processedContent;

};


function evaluateExpressionsWithHyperFormula(expressions, context = {}) {
	try {

		// Initialize HyperFormula
		const rowCount = Math.max(Object.keys(context).length + 100, 1000);

		const hf = HyperFormula.buildFromSheets(
			{ Sheet1: Array.from({ length: rowCount }, () => ['', '']) },
			{ licenseKey: 'gpl-v3' }
		);

		const sheetId = hf.getSheetId('Sheet1');

		if (typeof sheetId !== 'number') {
			throw new Error('Invalid sheetId from HyperFormula');
		}

		// Map context keys to HyperFormula cells
		const keyToCell = {};
		let cellRow = 0;


		for (const [key, value] of Object.entries(context)) {
			let cellValue = value;

			if (typeof value === 'boolean') {
				cellValue = value.toString();
			} else if (typeof value === 'object' && value !== null) {
				cellValue = JSON.stringify(value);
			}

			hf.setCellContents(
				{ sheet: sheetId, col: 0, row: cellRow },
				[[cellValue]]
			);

			keyToCell[key] = { row: cellRow, cell: `A${cellRow + 1}` };
			cellRow++;
		}

		// ---------------- FIND MISSING VARIABLES ----------------
		const allPotentialKeys = new Set();

		for (const expr of expressions) {
			const matches = expr.expression.match(/@[\w.\[\]{}]+/g) || [];
			matches.forEach(m => allPotentialKeys.add(m));
		}

		for (const key of allPotentialKeys) {
			if (!(key in keyToCell)) {
				hf.setCellContents(
					{ sheet: sheetId, col: 0, row: cellRow },
					[['null']]
				);

				keyToCell[key] = { row: cellRow, cell: `A${cellRow + 1}` };

				console.warn(`[HF MISSING] ${key} not found → stored NULL at ${keyToCell[key].cell}`);

				cellRow++;
			}
		}

		// ---------------- PROCESS EXPRESSIONS ----------------
		const results = [];
		let formulaRow = cellRow;

		for (let i = 0; i < expressions.length; i++) {
			const { expression, fullMatch } = expressions[i];
			const trimmedExpr = expression.trim();


			// NON-formula
			if (!trimmedExpr.startsWith('=')) {
				const value = context[trimmedExpr] ?? fullMatch;

				results.push({
					original: fullMatch,
					value
				});
				continue;
			}

			let formulaExpr = trimmedExpr.slice(1).trim();

			// -------- KEY PATTERNS --------
			const keyPatterns = [
				/@\w+\[\d+\]\{[^}]+\}/g,
				/@\w+(?:\.\w+)+\{[^}]+\}/g,
				/@\w+\{[^}]+\}/g,
				/@\w+\[\d+\]\.[a-zA-Z0-9_.]+/g,
				/@\w+\[\d+\]/g,
				/@\w+(?:\.\w+)+/g,
				/@\w+/g
			];

			let keysNeeded = [];
			for (const p of keyPatterns) {
				const m = formulaExpr.match(p);
				if (m) keysNeeded.push(...m);
			}
			keysNeeded = [...new Set(keysNeeded)];

			const resolvableKeys = keysNeeded.filter(k => k in keyToCell);

			const keysToReplace = resolvableKeys.sort((a, b) => {
				const aBrace = a.includes('{');
				const bBrace = b.includes('{');
				if (aBrace && !bBrace) return -1;
				if (!aBrace && bBrace) return 1;
				return b.length - a.length;
			});

			formulaExpr = replaceVariablesSmartly(formulaExpr, keyToCell, keysToReplace);

			// -------- EVALUATE --------
			try {
				const finalFormula = `=${formulaExpr}`;

				hf.setCellContents(
					{ sheet: sheetId, col: 1, row: formulaRow },
					[[finalFormula]]
				);

				const value = hf.getCellValue({
					sheet: sheetId,
					col: 1,
					row: formulaRow
				});

				results.push({
					original: fullMatch,
					value: value && value.type === 'ERROR' ? fullMatch : value
				});
			} catch (e) {
				console.error('[HF EVAL ERROR]', e);
				results.push({
					original: fullMatch,
					value: fullMatch
				});
			}

			formulaRow++;
		}

		return results;

	} catch (error) {
		console.error('[HF FATAL ERROR]', error.stack);
		return expressions.map(expr => ({
			original: expr.fullMatch,
			value: null
		}));
	}
}

function replaceVariablesSmartly(formulaExpr, keyToCell, keysToReplace) {
	let result = formulaExpr;

	for (const key of keysToReplace) {
		if (!(key in keyToCell)) continue;

		const { cell } = keyToCell[key];
		const escKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

		result = result.replace(
			new RegExp(`"(?:[^"\\\\]|\\\\.)*"|${escKey}`, 'g'),
			(match) => {
				if (match.startsWith('"')) return match;
				return cell;
			}
		);
	}

	return result;
}

function extractHyperFormulaBlocks(template) {
	const matches = [];
	let i = 0;

	while (i < template.length) {
		// Find opening {{
		const startIdx = template.indexOf('{{', i);
		if (startIdx === -1) break;

		let endIdx = startIdx + 2;
		let braceCount = 1; // Track nesting of { }

		// Find the matching closing }} accounting for nested braces
		while (endIdx < template.length - 1) {
			if (template[endIdx] === '{') {
				braceCount++;
			} else if (template[endIdx] === '}') {
				braceCount--;
				// When we find }} (two closing braces in a row and braceCount hits 0)
				if (braceCount === 0 && template[endIdx + 1] === '}') {
					break;
				}
			}
			endIdx++;
		}

		// Extract content between {{ and }}
		const fullMatch = template.substring(startIdx, endIdx + 2);
		let expression = template.substring(startIdx + 2, endIdx).trim();

		matches.push({
			fullMatch: fullMatch,
			expression: expression,
			index: startIdx,
			startIndex: startIdx,
			endIndex: endIdx + 2
		});

		i = endIdx + 2;
	}

	const trimmed = template.trim();

	if (trimmed.startsWith('=')) {
		return [{
			fullMatch: template,
			expression: trimmed,
			startIndex: 0,
			endIndex: template.length
		}];
	}

	return matches;
}

const buildWebhookContext = async (querystring = {}, header = {}, reqIn = [], reqOut = [], resIn = [], resOut = [], globalArray = [], reqMethod = "", unique_id = "", inboundPostData = {}, inboundMappingData = {}, body = {}, outboundMappedData = {}, OutboundFormatData = {}, inboundFormatData = {}, actionVariables = {}, endpointMeta = {}) => {
	const context = {};

	context['@req.method'] = reqMethod || '';
	context['@logs.logId'] = unique_id || '';

	context['@endpoint.url'] = endpointMeta?.url || '';
	context['@endpoint.row'] = endpointMeta?.row ?? 0;

	const endpointHeaders = endpointMeta?.headers ?? {};
	const endpointQuerystrings = endpointMeta?.querystrings ?? {};

	context['@endpoint.headers'] =
		Object.keys(endpointHeaders).length > 0
			? JSON.stringify(endpointHeaders)
			: {};

	context['@endpoint.querystrings'] =
		Object.keys(endpointQuerystrings).length > 0
			? JSON.stringify(endpointQuerystrings)
			: {};

	context['@endpoint.body'] = inboundMappingData || inboundPostData || {};

	for (const [key, value] of Object.entries(header || {})) {
		context[`@endpoint.header{${key}}`] = value;
	}

	for (const [key, value] of Object.entries(querystring || {})) {
		context[`@endpoint.querystring{${key}}`] = value;
	}

	// Request Headers
	context['@req.headers'] = header ? JSON.stringify(header) : {};
	for (const [key, value] of Object.entries(header || {})) {
		context[`@req.header{${key}}`] = value;
		context[`@header{${key}}`] = value; // alias
	}

	// Request Querystrings
	context['@req.querystrings'] = querystring ? JSON.stringify(querystring) : {};
	for (const [key, value] of Object.entries(querystring || {})) {
		context[`@req.querystring{${key}}`] = value;
		context[`@querystring{${key}}`] = value; // alias
	}

	// Request Body
	context['@req.body'] = inboundPostData;
	if (typeof inboundPostData === 'object') {
		Object.assign(context, flattenObject(inboundPostData, '@req.body', false));
	}

	// Request Transformed Body
	context['@req.transformedBody'] = inboundMappingData;
	if (typeof inboundMappingData === 'object') {
		Object.assign(context, flattenObject(inboundMappingData, '@req.transformedBody', false));
	}

	context['@res.body'] = body;
	if (typeof body === 'object') {
		Object.assign(context, flattenObject(body, '@res.body', false));
	}

	context['@res.transformedBody'] = outboundMappedData;
	if (typeof outboundMappedData === 'object') {
		Object.assign(context, flattenObject(outboundMappedData, '@res.transformedBody', false));
	}

	context['@res.timeMs'] = endpointMeta?.responseTimeMs || 0;
	context['@res.httpStatusCode'] = endpointMeta?.statusCode || 200;
	context['@res.error'] = endpointMeta?.error || false;
	context['@res.errorMessage'] = endpointMeta?.errorMessage || '';

	context['@res.headers'] = body?.headers ? JSON.stringify(body?.headers) : {};
	for (const [key, value] of Object.entries(body?.headers || {})) {
		context[`@res.header{${key}}`] = value;
	}

	const addRowContext = (arr, prefix) => {
		if (!Array.isArray(arr)) return;
		arr.forEach((item, index) => {
			if (item && typeof item === 'object') {
				context[`${prefix}[${index}]`] = item;
				Object.assign(context, flattenObject(item, `${prefix}[${index}]`, false));
				Object.assign(context, flattenObject(item, `${prefix}[${index}]`, true));
			}
		});
	};

	addRowContext(reqIn, '@reqIn');
	addRowContext(reqOut, '@reqOut');
	addRowContext(resIn, '@resIn');
	addRowContext(resOut, '@resOut');

	const global = Array.isArray(globalArray)
		? globalArray.reduce((acc, obj) => ({ ...acc, ...(obj || {}) }), {})
		: {};

	for (const [key, value] of Object.entries(global)) {
		context[`@global.${key}`] = value;
		context[`@global{${key}}`] = value;
	}

	for (const [key, value] of Object.entries(actionVariables || {})) {
		context[`@Vars{${key}}`] = value;
	}

	for (const [key, value] of Object.entries(inboundFormatData || {})) {
		context[key] = value;
	}

	for (const [key, value] of Object.entries(OutboundFormatData || {})) {
		context[key] = value;
	}

	return context;
};

// Flattens nested objects into dot notation keys
function flattenObject(obj, prefix = '', useCurlyBrace = false) {
	const result = {};
	if (!obj || typeof obj !== 'object') return result;

	for (const [key, value] of Object.entries(obj)) {
		let newKey;

		if (useCurlyBrace) {
			if (prefix.includes('{') && prefix.endsWith('}')) {
				newKey = prefix.slice(0, -1) + '.' + key + '}';
			} else if (prefix) {
				newKey = prefix + '{' + key + '}';
			} else {
				newKey = key;
			}
		} else {
			newKey = prefix ? `${prefix}.${key}` : key;
		}

		result[newKey] = value;

		// If object, continue flattening
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			Object.assign(result, flattenObject(value, newKey, useCurlyBrace));
		}
	}

	return result;
}

async function buildFinalReturnUrl(ctx) {
	const { url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId, companyCode, inboundEnableLog, enableLogs, enableFullLogs, enableError, item, request_id } = ctx;

	let updatedReturnUrl = resolveDirectFormula(url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);

	updatedReturnUrl = await formulaGetValue(companyCode, updatedReturnUrl, updatedReturnUrl, "", OutboundFormatData, inboundFormatData, "@Out{", item, schedulerUniqueId, inboundEnableLog, enableLogs, enableFullLogs, enableError, querystring, header, reqIn, reqOut, resIn, resOut, global, request_id, reqMethod);

	updatedReturnUrl = decodeURIComponent(updatedReturnUrl?.trim?.() || "");

	if (!updatedReturnUrl) {
		const originalUrl = url;
		try {
			const queryParams = parseReturnUrl(originalUrl);
			const urlObj = new URL(originalUrl);

			for (const [key, value] of Object.entries(queryParams)) {
				const newValue = getValueForGlobal(value, querystring, header, global);
				urlObj.searchParams.set(key, newValue);
			}

			return urlObj.toString();
		} catch (err) {
			console.error("Invalid fallback URL:", originalUrl, err.message);
			return "";
		}
	}

	return updatedReturnUrl;
}

function resolveDirectFormula(url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId) {
	let resolvedValue;
	if (url.startsWith('=@')) {
		resolvedValue = replacePlaceholders(url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
		if (resolvedValue) {
			return resolvedValue.startsWith('"') && resolvedValue.endsWith('"')
				? resolvedValue.replace(/['"]+/g, '')
				: resolvedValue;
		} else {
			return url;
		}
	} else {
		resolvedValue = replacePlaceholders(url, OutboundFormatData, inboundFormatData, querystring, header, reqIn, reqOut, resIn, resOut, global, reqMethod, schedulerUniqueId);
		if (resolvedValue) {
			return resolvedValue.startsWith('"') && resolvedValue.endsWith('"')
				? resolvedValue.replace(/['"]+/g, '')
				: resolvedValue;
		} else {
			return url;
		}
	}
	return url;
}

function parseReturnUrl(url) {
	const queryString = url.split('?')[1];
	if (!queryString) {
		return {};
	}

	return queryString.split('&').reduce((acc, param) => {
		const [key, value] = param.split('=');
		acc[decodeURIComponent(key)] = decodeURIComponent(value || '');
		return acc;
	}, {});
}

module.exports = { inboundFilterHandler, outboundFilterHandler, inboundMappingHandler, outboundMappingHandler, outboundValidationHandler, addToLogQueue, jsonOriginal, writelog, ddepInboundEmailSend, ddepOutboundEmailSend, inboundreplacementformatdata, replacePlaceholdersForheader, formulaGetValue, generateCurlCommand, replacePlaceholders, generateLogDescriptionFormulaForMail, wrapDynamicPlaceholders, isNonEmptyObjectOrArray, handleOutboundFailure, replaceToJson, actionValidationHandler, processVariablesAndHeaders, webhook_call, emailSend, processWebhookContent, buildFinalReturnUrl, resolveDirectFormula, parseReturnUrl, flattenObject, buildWebhookContext, getContentType, addToLogAlertQueue, addToLogDiffQueue, handleDiffCheckerReturnUrl }
