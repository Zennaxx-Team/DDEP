const express = require("express");
const request = require("request");
const fs = require("fs");
const router = express.Router();
const bodyParser = require("body-parser");
const path = require("path");
const { json } = require("body-parser");
const config = require("../config");
const ItemModel = require("../models/item.model");
const ProjectModel = require("../models/projects.model");
const InboundSetting = require("../models/inbound_setting.model");
const OutboundSetting = require("../models/outbound_setting.model");
const ScheduleSetting = require("../models/schedule_setting.model");
const MappingSetting = require("../models/mapping.model");
const inbound_setting = require("../controllers/inbound_setting.controller");
const outbound_setting = require("../controllers/outbound_setting.controller");
const schedule_setting = require("../controllers/schedule_setting.controller");
const projectController = require("../controllers/projects.controller");
const itemController = require("../controllers/item.controller");

router.use(express.urlencoded({ extended: false }));
router.use(express.json());
router.use(express.static(path.join(__dirname, "public")));
router.use(express.static("public"));

router.post("/item/save", itemController.createAPI);

router.post("/item/checkbasic", itemController.checkAPI);

router.post("/item/update/:id", itemController.updateAPI);

router.get("/item/fulllist", itemController.fullProjectAPI);

router.post("/item/add", async (req, res) => {
	let item_id = "";
	let data;
	let result = {};
	let duplicate = "";
	for (let i = 0; i < req.body.length; i++) {
		if (duplicate != "") break;
		switch (req.body[i].type) {
			case "basic":
				await new Promise((resolve) => {
					request.post(config.domain + "/project/item/checkbasic", {form: {itemCode: req.body[i].ItemCode}}, function (error, response, body) {
							data = JSON.parse(body);

							if (data.result == false) {
								duplicate = "ItemCode already exists";
							}

							resolve({});
						});
					}
				);
				if (duplicate != "") break;
				await new Promise((resolve) => {
					request.post(config.domain + "/project/item/create", {form: req.body[i]}, function (error, response, body) {
						data = JSON.parse(body);
						item_id = data.item_id
						result = { ...result, basic: data };

						if (item_id != "") {
							resolve({});
						}
					});
				});
				break;
			case "inbound":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				if (item_id != "") data = { ...data, project_id: item_id };
				if (data.api_type == "DDEP_API") {
					await new Promise((resolve) => {
						request.post(config.domain + "/inbound_setting/checkddepinputexist", {form: data}, function (error, response, body) {
							let data1 = JSON.parse(body);

							if (data1 == false) {
								duplicate = "DDEP API already exists";
							}

							resolve({});
						});
					});
				}

				if (duplicate != "") break;
				await new Promise((resolve) => {
					request.post(config.domain + "/inbound_setting/save", {form:data}, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, inbound: data};
						resolve({});
					});
				});
				break;
			case "outbound":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				if (item_id != "") data = { ...data, project_id: item_id };
				await new Promise((resolve) => {
					request.post(config.domain + "/outbound_setting/save", {form:data}, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, outbound: data};
						resolve({});
					});
				});
				break;
			case "schedule":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				if (item_id != "") data = { ...data, project_id: item_id };
				await new Promise((resolve) => {
					request.post(config.domain + "/schedule_setting/save", {form:data}, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, schedule: data };
						resolve({});
					});
				});
				break;
			case "mapping":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				if (item_id != "") data = { ...data, project_id: item_id };
				await new Promise((resolve) => {
					request.post(config.domain + "/project/item/mapping/save", {form:data}, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, schedule: data };
						resolve({});
					});
				});
				break;
			default:
				break;
		}
	}

	if (duplicate != "") {
		res.status(500).json({msg: duplicate});
	} else {
		res.status(200).json({data: result});
	}
});

router.post("/item/modify", async (req, res) => {
	let data;
	let result = {};
	let duplicate = "";
	for (let i = 0; i < req.body.length; i++) {
		switch (req.body[i].type) {
			case "basic":
				await new Promise((resolve) => {
					request.post(config.domain + "/project/item/update/" + req.body[i].item_id, { form: req.body[i] }, function (error, response, body) {
						data = JSON.parse(body);
						result = { ...result, basic: data };
						resolve({});
					});
				});
				break;
			case "inbound":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				await new Promise((resolve) => {
					request.put(config.domain + "/inbound_setting/update/" + req.body[i].inbound_id, { form: data }, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, inbound: data };
						resolve({});
					});
				});
				break;
			case "outbound":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				await new Promise((resolve) => {
					request.put( config.domain + "/outbound_setting/update/" + req.body[i].outbound_id, { form: data }, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, outbound: data };
						resolve({});
					});
				});
				break;
			case "schedule":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				await new Promise((resolve) => {
					request.put( config.domain + "/schedule_setting/update/" + req.body[i].schedule_id, { form: data }, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, schedule: data };
						resolve({});
					});
				});
				break;
			case "mapping":
				data = req.body[i];
				data = { ...data, project_id: data.item_id };
				await new Promise((resolve) => {
					request.put(config.domain + "/project/item/mapping/update/" + req.body[i].mapping_id, {form:data}, function (error, response, body) {
						var data = JSON.parse(body);
						result = { ...result, mapping: data };
						resolve({});
					});
				});
				break;
			default:
				break;
		}
	}

	if (duplicate != "") {
		res.status(500).json({msg: duplicate});
	} else {
		res.status(200).json({data: result});
	}
});

router.get("/item/detail/:id", async function (req, res) {
	let id = req.params.id;
	let data = [];

	await ItemModel.findOne({ _id: id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await InboundSetting.findOne({item_id:id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await OutboundSetting.findOne({item_id:id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await ScheduleSetting.findOne({item_id:id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await MappingSetting.findOne({item_id:id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await ProjectModel.findOne({item_id:id})
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	res.status(200).json({
		data: {
			item_ID: data[0]._id,
			pj_ID: data[0].ProjectId,
			projectCode: data[5].ProjectCode,
			projectName: data[5].ProjectName,
			projectDescr: data[5].ProjectDescr,
			sequence: data[5].Sequence  || "",
			isActive: data[5].isActive,
			createdAt: data[5].createdAt,
			updatedAt: data[5].updatedAt,
			__v: data[0].__v,
			basic: data[0],
			inbound_setting: data[1],
			outbound_setting: data[2],
			schedule_setting: data[3],
			mapping: data[4],
			inbound_history: [],
			outbound_history: []
		},
	});
});

router.get("/fulllist", async function (req, res) {
	let data = [];

	await ItemModel.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await InboundSetting.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await OutboundSetting.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await ScheduleSetting.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await MappingSetting.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	await ProjectModel.find()
	.then((res) => {
		data.push(res);
	})
	.catch((err) => {
		return res.status(200).json({err: err});
	});

	let result = [];
	await data[5].map(async project => {
		let items = [];
		dataItems = data[0].filter(item => item.ProjectId != undefined && item.ProjectId != "")
		await dataItems
		.filter(item => item.ProjectId.toString() == project._id.toString())
		.map((i) => {
			let inbound = data[1].filter(d => d.item_id.toString() == i._id.toString());
			let outbound = data[2].filter(d => d.item_id.toString() == i._id.toString());
			let schedule = data[3].filter(d => d.item_id.toString() == i._id.toString());

			let inboundType = inbound.length == 0 ? "" : inbound[0].api_ddep_api;
			let inboundFormat = inbound.length == 0 ? "" : inbound[0].inbound_format;
			let outboundFormat = outbound.length == 0 ? "" : outbound[0].outbound_format;
			let scheduleDescr = schedule.length == 0 ? "" : schedule[0].occurs_inbound;

			items.push({
				item_ID: i._id,
				itemCode: i.ItemCode,
				itemName: i.ItemName,
				itemDescr: i.CompanyName,
				isActive: i.isActive,
				version: i.__v,
				inboundType: inboundType,
				inboundFormat: inboundFormat,
				outboundFormat: outboundFormat,
				scheduleDescr: scheduleDescr
			});

			return;
		});

		result.push({
			pj_ID: project._id,
			projectCode: project.ProjectCode,
			projectName: project.ProjectName,
			projectDescr: project.ProjectDescr,
			sequence: project.Sequence || "",
			group: project.group,
			isActive: project.isActive,
			createdAt: project.createdAt,
			updatedAt: project.updatedAt,
			items: items
		})

		return;
	});

	res.send({data: result});
});

router.post("/add", async function (req, res) {
	let result = await projectController.create(req.body);
	res.status(200).json(result);
});

router.post("/modify/:id", async function (req, res) {
	let result = await projectController.update(req.params.id, req.body);
	res.status(200).json(result);
});

router.get("/detail/:id", async function (req, res) {
	let result = await projectController.findOne(req.params.id);
	res.status(200).json(result);
});

router.get("/list", function (req, res) {
	res.status(200).json({
		data: [
			{
				pj_ID: "62592d4a5c4b8a9d970b56aa",
				projectCode: "iRMS-External-Exchange",
				projectName: "i-RMS External Exchange Data",
				projectDescr:
					"all External Parties requested integrate data will be added in here",
				group: "",
				isActive: "1",
				createdAt: "2022-04-15T08:31:06.196Z",
				updatedAt: "2022-05-19T06:42:06.239Z",
			},
		],
	});
});

module.exports = router;