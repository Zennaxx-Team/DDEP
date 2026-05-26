process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const EnableGimaEnv = process.env.EnableGima;
const express = require("express");
const router = express.Router();
const bodyParser = require("body-parser");
const path = require("path");
const request = require("request");
const { json } = require("body-parser");
const ase = require("../my_modules/aes");
const config = require("../config");
const users = require("../controllers/user.controller");
const branch = require("../controllers/branch.controller");
const department = require("../controllers/department.controller");
const legal_entity = require("../controllers/legel_entity.controller");
const staf_role = require("../controllers/staff_role.controller");
const { checkAuthorization } = require("../middleware");

router.use(express.urlencoded({ extended: false }));
router.use(express.static(path.join(__dirname, "public")));
router.use(express.static("public"));

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.get("/all", users.all);

router.post("/sync-user", users.create);

router.post("/single-user", users.findOne);

router.post("/list", users.list);

router.put("/:id", users.update);

router.delete("/:id", users.deleteUser);

router.post("/branch", branch.create);

router.post("/single-branch", branch.findOne);

router.put("/branch/:id", branch.update);

router.delete("/branch/:id", branch.deleteBranch);

router.post("/department", department.create);

router.post("/single-department", department.findOne);

router.put("/department/:id", department.update);

router.delete("/department/:id", department.deleteDepartment);

router.post("/legal_entity", legal_entity.create);

router.post("/single-legal_entity", legal_entity.findOne);

router.put("/legal_entity/:id", legal_entity.update);

router.delete("/legal_entity/:id", legal_entity.deleteLegalEntity);

router.post("/staffrole", staf_role.create);

router.post("/single-staf_role", staf_role.findOne);

router.put("/staffrole/:id", staf_role.update);

router.delete("/staffrole/:id", staf_role.deleteStaffRole);

router.post("/syncuser", function (req, res, next) {
	const Aes = new ase();
	const jsondata = req.body;
	const querydata = req.query;
	const companyCode = querydata?.companycode || null;

	if (!jsondata.SyncData) {
		return res.status(400).json({
			"Status": "0",
			"Msg": "SyncData is missing",
			"ErrMsg": "SyncData is required",
			"Data": []
		});
	}

	if (!companyCode) {
		return res.status(400).json({
			"Status": "0",
			"Msg": "companyCode is missing",
			"ErrMsg": "companyCode is required",
			"Data": []
		});
	}

	try {
		const post_data_s = Aes.Decrypt(unescape(jsondata.SyncData));
		let syncjson = eval("(" + post_data_s + ")");
		let counter = 0;

		syncjson.forEach(tablelist => {
			if (tablelist.tbl_staff != undefined) {
				tablelist.tbl_staff.forEach(item => {
					const options = {
						method: "POST",
						url: `${config.domain}/users/single-user`,
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ id: item.user_name, companyCode })
					};

					request(options, function (error, response) {
						if (error) {
							console.log(error);
							throw new Error(error);
						}
						if (response.statusCode == 200) {
							const result = JSON.parse(response.body);
							if (result.status) {
								if (item.OperationType != "delete") {
									const options = {
										method: "PUT",
										url: `${config.domain}/users/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify({ ...item, companyCode }),
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								} else {
									const options = {
										method: "DELETE",
										url: `${config.domain}/users/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										}
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									}); 
								}
							} else {
								if (item.OperationType != "delete") {
									const options = {
										method: "POST",
										url: `${config.domain}/users/sync-user`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify({ ...item, companyCode })
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
										if (response.statusCode == 200) {
											counter = eval(counter + 1);
										}
									});
								}
							}
						}
					});
				});
			}

			if (tablelist.tbl_staffrole != undefined) {
				tablelist.tbl_staffrole.forEach(item => {
					const options = {
						method: "POST",
						url: `${config.domain}/users/single-staf_role`,
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ id: item.guid_key })
					};

					request(options, function (error, response) {
						if (error) {
							console.log(error);
							throw new Error(error);
						}
						if (response.statusCode == 200) {
							const result = JSON.parse(response.body);
							if (result.status) {
								if (item.OperationType != "delete") {
									const options = {
										method: "PUT",
										url: `${config.domain}/users/staff_role/${result.data}`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								} else {
									const options = {
										method: "DELETE",
										url: `${config.domain}/users/staff_role/${result.data}`,
										headers: {
											"Content-Type": "application/json"
										}
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								}
							} else {
								if (item.OperationType != "delete") {
									item['companyCode'] = companyCode;
									const options = {
										method: "POST",
										url: `${config.domain}/users/staffrole`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
										if (response.statusCode == 200) {
											counter = eval(counter + 1);
										}
									});
								}
							}
						}
					});
				});
			}

			if (tablelist.tbl_branch != undefined) {
				tablelist.tbl_branch.forEach(item => {
					const options = {
						method: "POST",
						url: `${config.domain}/users/single-branch`,
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ id: item.branch_code })
					};

					request(options, function (error, response) {
						if (error) {
							console.log(error);
							throw new Error(error);
						}
						if (response.statusCode == 200) {
							const result = JSON.parse(response.body);
							if (result.status) {
								if (item.OperationType != "delete") {
									const options = {
										method: "PUT",
										url: `${config.domain}/users/branch/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								} else {
									const options = {
										method: "DELETE",
										url: `${config.domain}/users/branch/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										} 
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								}
							} else {
								if (item.OperationType != "delete") {
									item["companyCode"] = companyCode;
									const options = {
										method: "POST",
										url: `${config.domain}/users/branch`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
										if (response.statusCode == 200) {
											counter = eval(counter + 1);
										}
									});
								}
							}
						}
					});
				});
			}

			if (tablelist.tbl_department != undefined) {
				tablelist.tbl_department.forEach(item => {
					const options = {
						method: "POST",
						url: `${config.domain}/users/single-department`,
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ id: item.department_code }) 
					};

					request(options, function (error, response) {
						if (error) {
							console.log(error);
							throw new Error(error);
						}
						if (response.statusCode == 200) {
							const result = JSON.parse(response.body);
							if (result.status) {
								if (item.OperationType != "delete") {
									const options = {
										method: "PUT",
										url: `${config.domain}/users/department/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								} else {
									const options = {
										method: "DELETE",
										url: `${config.domain}/users/department/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										}
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								}
							} else {
								if (item.OperationType != "delete") {
									item["companyCode"] = companyCode;
									const options = {
										method: "POST",
										url: `${config.domain}/users/department`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
										if (response.statusCode == 200) {
											counter = eval(counter + 1);
										}
									});
								}
							}
						}
					});
				});
			}

			if (tablelist.tbl_legal_entity != undefined) {
				tablelist.tbl_legal_entity.forEach(item => {
					const options = {
						method: "POST",
						url: `${config.domain}/users/single-legal_entity`,
						headers: {
							"Content-Type": "application/json"
						},
						body: JSON.stringify({ id: item.legal_entity_code })
					};

					request(options, function (error, response) {
						if (error) {
							console.log(error);
							throw new Error(error);
						}
						if (response.statusCode == 200) {
							const result = JSON.parse(response.body);
							if (result.status) {
								if (item.OperationType != "delete") {
									const options = {
										method: "PUT",
										url: `${config.domain}/users/legal_entity/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								} else {
									const options = {
										method: "DELETE",
										url: `${config.domain}/users/legal_entity/${result.data._id}`,
										headers: {
											"Content-Type": "application/json"
										}
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
									});
								}
							} else {
								if (item.OperationType != "delete") {
									item["companyCode"] = companyCode;
									const options = {
										method: "POST",
										url: `${config.domain}/users/legal_entity`,
										headers: {
											"Content-Type": "application/json"
										},
										body: JSON.stringify(item)
									};

									request(options, function (error, response) {
										if (error) {
											console.log(error);
											throw new Error(error);
										}
										if (response.statusCode == 200) {
											counter = eval(counter + 1);
										}
									});
								}
							}
						}
					});
				});
			}
		});

		return res.status(200).send({ Status: "1", Msg: "Records Saved successfully" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
});

router.get("/", checkAuthorization, (req, res) => {
	renderPage(res, "user-list");
});

module.exports = router;