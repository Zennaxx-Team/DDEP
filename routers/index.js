const bodyParser = require("body-parser");
const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer();
const parseString = require("xml2js").parseString;
const xml2js = require("xml2js");
const { v4: uuidv4 } = require("uuid");
const jwtDecode = require("jwt-decode");
const ase = require("../my_modules/aes");
const config = require("../config");
const { checkAuthorization } = require("../middleware");
var jsonSchemaGenerator = require("json-schema-generator"), obj = { some: { object: true } }, schemaObj;
const { getUserPermissionByUsername } = require("../controllers/permissions.controller");
const { getCompanyByCompanyCode } = require("../controllers/companies.controller");
const { _ddep_api_function } = require("../handler/dapi");
const { jsonOriginal } = require("../common/common");

router.use(express.json());
router.use(upload.array());
router.use(express.static("public"));
router.use(express.urlencoded({ extended: true }));
router.use(bodyParser.text({ type: "text/*" }));
router.use(bodyParser.raw({ type: "application/*" }));

const stringConstructor = "test".constructor;
const numberConstructor = (3.14).constructor;
const booleanConstructor = false.constructor;
const arrayConstructor = [].constructor;
const objectConstructor = ({}).constructor;
const dateConstructor = new Date().constructor;

let mainKey = [], keyArray = [];
let checkArr = 0, isSchema = 0;

const renderPage = (res, page, alldata = null) => res.render(page, { ddepVersion: config.ddepVersion, companyCode: config.companyCode, alldata, isProject: true });

router.get("/", checkAuthorization, (req, res) => {
	// res.redirect("/projects/project-list");
	res.redirect("/dashboard");
	
});

router.get("/tools", checkAuthorization, (req, res) => {
	let headerData = {};
	const headerJs = [];

	headerData["js"] = headerJs;
	headerData["companyCode"] = config.companyCode;

	let footerData = {};
	const js = [
		"/app-assets/js/tools.js"
	];

	footerData["js"] = js;

	res.render("pages/tools", { companyCode: config.companyCode, headerData: headerData, footerData: footerData, isProject: true });
});

router.get("/not-authorized", function (req, res) {
	let headerData = {};
	const headerJs = [];

	headerData["js"] = headerJs;

	let footerData = {};
	const js = [];

	footerData["js"] = js;

	res.render("pages/not-authorized", { headerData: headerData, footerData: footerData, isProject: true });
});

router.get("/not-authorize", function (req, res) {
	res.redirect(process.env.GIMA_SITE_URL);
});

router.get("/404", function (req, res) {
	renderPage(res, "404");
});

router.get("/500", function (req, res) {
	renderPage(res, "500");
});

router.post("/setCookies", _set_cookies_function);
router.options("/setCookies", _set_cookies_function); // Handle preflight requests (OPTIONS)

async function _set_cookies_function(req, res) {
	try {
		const cookies = req.body; // Array of cookies

		let userName;
		let token;
		let companyCode;

		// Remove http:// or https:// from the domain
		const domainWithoutProtocol = config.domain.replace(/(^\w+:|^)\/\//, ""); 

		cookies.forEach(cookie => {
			res.clearCookie(cookie.name, {
				domain: domainWithoutProtocol,  // Ensure it clears from the same domain
				path: "/",                      // Same path as where it was set
				secure: true,                   // Same security properties as the cookie
				sameSite: "None",               // SameSite policy (if needed)
			});
		});

		// Loop through each cookie in the array and set it
		cookies.forEach(cookie => {
			const cookieSize = encodeURIComponent(cookie.name + "=" + cookie.value).length;
			res.cookie(cookie.name, cookie.value, {
				domain: domainWithoutProtocol,	// Ensure cookies are valid across the domain
				path: "/",						// Available throughout the domain
				secure: true,					// Only transmitted over HTTPS
				sameSite: "None",				// Allows cross-origin requests
				maxAge: 10 * 60 * 60 * 1000		// Set expiry to 10 hours (in milliseconds)
			});

			if (cookie.name === "Token") {
				token = cookie.value;
			}

			if (cookie.name === "companyCode") {
				companyCode = cookie.value
			}
		});

		// Optional: Fetch user permissions and set a "permissions" cookie
		if (cookies && token) {
			try {
				let decoded = jwtDecode(token);
				userName = decoded.username;

				const userPermissions = await getUserPermissionByUsername(userName, companyCode);

				if (userPermissions?.status === 1 && userPermissions?.data) {
					// Set permissions as a cookie
					res.cookie("permissions", JSON.stringify(userPermissions.data), {
						domain: domainWithoutProtocol,
						path: "/",
						secure: true,
						sameSite: "None",
						maxAge: 10 * 60 * 60 * 1000
					});
				} else {
					console.error("Error: Unable to set permissions cookie");
				}
			} catch (err) {
				console.error("Error fetching permissions:", err.message);
			}
		}

		if (cookies && companyCode) {
			const companiesData = await getCompanyByCompanyCode(companyCode);

			if (companiesData?.status === 1 && companiesData?.data) {
				res.cookie("selectedCompany", companiesData?.data?._id.toString(), {
					domain: domainWithoutProtocol,
					path: "/",
					secure: true,
					sameSite: "None",
					maxAge: 10 * 60 * 60 * 1000
				});
				res.cookie("selectedProject", "", {
					domain: domainWithoutProtocol,
					path: "/",
					secure: true,
					sameSite: "None",
					maxAge: 10 * 60 * 60 * 1000
				});
				res.cookie("selectedProjectName", "Default", {
					domain: domainWithoutProtocol,
					path: "/",
					secure: true,
					sameSite: "None",
					maxAge: 10 * 60 * 60 * 1000
				});
			}
		}

		// Set CORS headers for cross-origin requests
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Access-Control-Allow-Origin", process.env.GIMA_SITE_URL); // Set the allowed origin dynamically
		res.setHeader("Access-Control-Allow-Headers", "Content-Type");
		res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");

		// Respond after setting basic cookies, regardless of permissions outcome
		return res.status(200).send({ status: 1, message: "Cookies have been set!" });
	} catch (err) {
		return res.status(200).send({ status: 0, message: `Cookies not set! ${err.message}` });
	}
}

router.post("/generatekey", function (req, res) {
	const reqBody = req.body;
	const ddep_api_auth_type = reqBody.ddep_api_auth_type;
	const jwt_algorithm_type = reqBody.jwt_algorithm_type;
	const base64Encode = reqBody.base64Encode;
	const type = reqBody.Type;
	const key = reqBody.Key;
	const description = reqBody.Description;
	const date = new Date();

	const randomKey = uuidv4();

	let data = {};
	data["date"] = date;

	if (ddep_api_auth_type === "JWT_Bearer") {
		data["key"] = (base64Encode) ? Buffer.from(randomKey).toString('base64') : randomKey;
	} else {
		data["key"] = randomKey;
	}

	return res.status(200).send({ status: 1, message: "Key generated successfully!", data });
});

router.post("/encode", function (req, res) {
	const { key } = req.body;
	const encodedKey = Buffer.from(key).toString('base64');
	return res.status(200).send({ key: encodedKey });
});

router.get("/" + config.ddepPrefix + "/:companyCode/:ddepInput/:ddepInput1?/:ddepInput2?/:ddepInput3?/:ddepInput4?/:ddepInput5?/:ddepInput6?/:ddepInput7?/:ddepInput8?/:ddepInput9?/:ddepInput10?/:ddepInput11?/:ddepInput12?", _ddep_api_function);
router.put("/" + config.ddepPrefix + "/:companyCode/:ddepInput/:ddepInput1?/:ddepInput2?/:ddepInput3?/:ddepInput4?/:ddepInput5?/:ddepInput6?/:ddepInput7?/:ddepInput8?/:ddepInput9?/:ddepInput10?/:ddepInput11?/:ddepInput12?", _ddep_api_function);
router.post("/" + config.ddepPrefix + "/:companyCode/:ddepInput/:ddepInput1?/:ddepInput2?/:ddepInput3?/:ddepInput4?/:ddepInput5?/:ddepInput6?/:ddepInput7?/:ddepInput8?/:ddepInput9?/:ddepInput10?/:ddepInput11?/:ddepInput12?", _ddep_api_function);
router.patch("/" + config.ddepPrefix + "/:companyCode/:ddepInput/:ddepInput1?/:ddepInput2?/:ddepInput3?/:ddepInput4?/:ddepInput5?/:ddepInput6?/:ddepInput7?/:ddepInput8?/:ddepInput9?/:ddepInput10?/:ddepInput11?/:ddepInput12?", _ddep_api_function);
router.delete("/" + config.ddepPrefix + "/:companyCode/:ddepInput/:ddepInput1?/:ddepInput2?/:ddepInput3?/:ddepInput4?/:ddepInput5?/:ddepInput6?/:ddepInput7?/:ddepInput8?/:ddepInput9?/:ddepInput10?/:ddepInput11?/:ddepInput12?", _ddep_api_function);

router.post("/mapping/convert/injson2GOJSD", function (req, res) {
	const reqBody = req.body;
	mainKey = [];
	keyArray = [];
	checkArr = 0; isSchema = 0;

	const schema = jsonSchemaGenerator(reqBody);

	let mainObject = {};
	if (whatIsIt(schema) == "Object") {
		mainObject = object_for_each(schema);
	}

	const keys = make_inbound_keys(mainObject);

	let gojsd = {};
	gojsd["schema"] = mainObject;
	gojsd["keys"] = keyArray;

	return res.status(200).send(gojsd);
});

router.post("/mapping/convert/outjson2GOJSD", function (req, res) {
	const reqBody = req.body;
	mainKey = [];
	keyArray = [];
	checkArr = 0; isSchema = 0;

	const schema = jsonSchemaGenerator(reqBody);

	let mainObject = {};
	if (whatIsIt(schema) == "Object") {
		mainObject = object_for_each(schema);
	}

	const keys = make_outbound_keys(mainObject);

	let gojsd = {};
	gojsd["schema"] = mainObject;
	gojsd["keys"] = keyArray;

	return res.status(200).send(gojsd);
});

router.post("/mapping/convert/xml2JSON", function (req, res) {
	let reqBody = req.body;

	parseString(reqBody, function (err, result) {
		reqBody = jsonOriginal(result);
	});

	return res.status(200).send(reqBody);
});

router.post("/mapping/convert/inxml2GOJSD", function (req, res) {
	let reqBody = req.body;
	mainKey = [];
	keyArray = [];
	checkArr = 0; isSchema = 0;

	parseString(reqBody, function (err, result) {
		reqBody = jsonOriginal(result);
	});

	const schema = jsonSchemaGenerator(reqBody);

	let mainObject = {};
	if (whatIsIt(schema) == "Object") {
		mainObject = object_for_each(schema);
	}

	const keys = make_inbound_keys(mainObject);

	let gojsd = {};
	gojsd["schema"] = mainObject;
	gojsd["keys"] = keyArray;

	return res.status(200).send(gojsd);
});

router.post("/mapping/convert/outxml2GOJSD", function (req, res) {
	let reqBody = req.body;
	mainKey = [];
	keyArray = [];
	checkArr = 0; isSchema = 0;

	parseString(reqBody, function (err, result) {
		reqBody = jsonOriginal(result);
	});

	const schema = jsonSchemaGenerator(reqBody);

	let mainObject = {};
	if (whatIsIt(schema) == "Object") {
		mainObject = object_for_each(schema);
	}

	const keys = make_outbound_keys(mainObject);

	let gojsd = {};
	gojsd["schema"] = mainObject;
	gojsd["keys"] = keyArray;

	return res.status(200).send(gojsd);
});

function object_for_each(data) {
	let mainObject = {};
	let secondObject = {};
	let merged1 = {};
	let i = 0;
	let j = 0;

	Object.entries(data).forEach(([key, value]) => {
		if (key == "$schema") { isSchema = 1; }
		if (key != "format") {
			let getvalue = object_for_each1(key, value);
			if (whatIsIt(getvalue) == "Object") {
				if (Object.entries(getvalue).length !== 0) {
					if (whatIsIt(getvalue) == "Object") {
						merged1 = Object.assign(secondObject, secondObject, getvalue);
					} else {
						secondObject[i] = getvalue;
						i += 1;
					}
					if (key == "format") {
						return false;
					}
				}
			} else if (whatIsIt(getvalue) != "Object" && whatIsIt(getvalue) != "Array") {
				mainObject = getvalue;
				if (key == "format") {
					return false;
				}
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

function object_for_each1(key, value) {
	let mainObject = {};

	if (key == "format" || key == "$schema" || key == "minLength" || key == "minItems" || key == "uniqueItems") {
		return mainObject;
	}

	if (key == "description" && isSchema == 1) {
		isSchema = 0;
		return mainObject;
	}

	let secondObject = {};
	let i = 0;
	let j = 0;
	let isarray = 0;

	if (whatIsIt(value) == "Object") {
		j += 1;
		let firstObject = object_for_each(value);
		if (key == "type" && firstObject != "string" && firstObject != "array" && firstObject != "number" && firstObject != "object" && firstObject != "integer") {
			return mainObject = firstObject;
		} else if (key == "properties") {
			if (whatIsIt(firstObject) == "Object") {
				secondObject = firstObject;
			} else {
				secondObject[i] = firstObject;
				i += 1;
			}
		} else if (key != "properties") {
			if (checkArr == 0 || key != "items") {
				if (whatIsIt(firstObject) == "Object") {
					let mainObjectTest = {};
					Object.entries(firstObject).forEach(([key1, value1]) => {
						let mT = {};
						if (whatIsIt(value1) == "Array" && (key1 == "items" || key1 >= 0)) {
							let newArr1 = [];
							newArr1.push(value1);
							mT = Object.assign(mainObjectTest, mainObjectTest, newArr1);
						} else {
							mT = Object.assign(mainObjectTest, mainObjectTest, firstObject);
						}
					});

					if (mainObjectTest[0] != undefined && Object.entries(mainObjectTest).length === 1) {
						mainObject[key] = mainObjectTest[0];
					} else {
						delete mainObjectTest[0];
						mainObject[key] = mainObjectTest;
					}
				} else {
					mainObject[key] = firstObject;
				}
			} else {
				let newArr = [];
				if (Object.entries(firstObject).length === 0) {
					firstObject = "string";
				}

				newArr.push(firstObject);
				mainObject[key] = newArr;
				checkArr -= 1;
			}
		}
	} else if (whatIsIt(value) != "Object" && whatIsIt(value) != "Array") {
		if (value != "array" && value != "object") {
			if (key == "type") {
				return mainObject = value;
			} else if (key == "properties") {
				if (whatIsIt(value) == "Object") {
					secondObject = value;
				} else {
					secondObject[i] = value;
					i += 1;
				}
			} else if (key != "properties") {
				if (checkArr == 0 || key != "items") {
					mainObject[key] = value;
				} else {
					let newArr = [];
					newArr.push(value);
					mainObject[key] = newArr;
					checkArr -= 1;
				}
			}
		} else if (value == "array") {
			checkArr += 1;
		}
	}

	let merged = {};
	Object.entries(secondObject).forEach(([key, value]) => {
		let newtest = {};
		newtest[key] = value;
		merged = Object.assign(mainObject, mainObject, newtest);
	});

	if (Object.entries(merged).length === 0) {
		merged = mainObject;
	}

	return merged;
}

function make_inbound_keys(data) {
	let mainObject = {};

	Object.entries(data).forEach(([key, value]) => {
		let getvalue = get_inbound_key_obj(key, value);
	});

	return mainObject;
}

function get_inbound_key_obj(key, value) {
	let mainObject = {};
	let newKey = "";

	if (whatIsIt(value) == "Object") {
		if (mainKey.length == 0) {
			newKey = "@In{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0) {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@In{" + key + "}";
				} else {
					newKey = "@In{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}
		mainKey.push(key);
		newKey = make_inbound_keys(value);
		let mainKeyPopped = mainKey.pop();
	} else if (whatIsIt(value) == "Array") {
		if (mainKey.length == 0) {
			newKey = "@In{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0) {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@In{" + key + "}";
				} else {
					newKey = "@In{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}

		if (key >= 0) {
		} else {
			mainKey.push(key);
		}

		newKey = make_inbound_keys(value);
		let mainKeyPopped = mainKey.pop();
	} else if (whatIsIt(value) != "Object" && whatIsIt(value) != "Array") {
		let keyObj = {};
		if (mainKey.length == 0) {
			newKey = "@In{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0 || mainKey[i] == "0") {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@In{" + key + "}";
				} else {
					newKey = "@In{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}
	}

	return mainObject;
}

function make_outbound_keys(data) {
	let mainObject = {};

	Object.entries(data).forEach(([key, value]) => {
		let getvalue = get_outbound_key_obj(key, value);
	});

	return mainObject;
}

function get_outbound_key_obj(key, value) {
	let mainObject = {};
	let newKey = "";

	if (whatIsIt(value) == "Object") {
		if (mainKey.length == 0) {
			newKey = "@Out{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0) {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}
					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@Out{" + key + "}";
				} else {
					newKey = "@Out{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}

		mainKey.push(key);
		newKey = make_outbound_keys(value);
		let mainKeyPopped = mainKey.pop();
	} else if (whatIsIt(value) == "Array") {
		if (mainKey.length == 0) {
			newKey = "@Out{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0) {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@Out{" + key + "}";
				} else {
					newKey = "@Out{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}

		if (key >= 0) {
		} else {
			mainKey.push(key);
		}

		newKey = make_outbound_keys(value);
		let mainKeyPopped = mainKey.pop();
	} else if (whatIsIt(value) != "Object" && whatIsIt(value) != "Array") {
		let keyObj = {};
		if (mainKey.length == 0) {
			newKey = "@Out{" + key + "}";
			keyObj = { key: newKey };
			keyArray.push(keyObj);
		} else {
			let firstKey = "";
			for (let i = 0; i < mainKey.length; i++) {
				if (mainKey[i] == 0 || mainKey[i] == "0") {
				} else {
					if (firstKey != "") {
						firstKey = firstKey + ".";
					}

					firstKey = firstKey + mainKey[i];
				}
			}

			if (key >= 0) { } else {
				if (firstKey == "") {
					newKey = "@Out{" + key + "}";
				} else {
					newKey = "@Out{" + firstKey + "." + key + "}";
				}

				keyObj = { key: newKey };
				keyArray.push(keyObj);
			}
		}
	}

	return mainObject;
}

function json_schema_to_json(data) {
	let newMainObject = {};

	Object.entries(data).forEach(([key, value]) => {
		newMainObject[key] = set_json_value(value);
	});

	return newMainObject;
}

function set_json_value(value) {
	if (whatIsIt(value) == "Object") {
		return json_schema_to_json(value);
	} else if (whatIsIt(value) == "Array") {
		let valArr = [];
		for (let i = 0; i < value.length; i++) {
			if (whatIsIt(value[i]) == "Object") {
				valArr.push(json_schema_to_json(value[i]));
			} else {
				valArr.push(get_value_for_key(value[i]));
			}
		}
		return valArr;
	} else if (whatIsIt(value) == "String") {
		return get_value_for_key(value);
	}

	return "";
}

function get_value_for_key(value) {
	if (value == "string") {
		return "abcd";
	} else if (value == "integer") {
		return 123;
	} else if (value == "number") {
		return 12.30;
	}

	return "dcba";
}

function whatIsIt(object) {
	if (object === null) {
		return "null";
	} else if (object === undefined) {
		return "undefined";
	} else if (object.constructor === stringConstructor) {
		return "String";
	} else if (object.constructor === arrayConstructor) {
		return "Array";
	} else if (object.constructor === objectConstructor) {
		return "Object";
	} else if (object.constructor === numberConstructor) {
		return "Number";
	} else if (object.constructor === booleanConstructor) {
		return "Boolean";
	} else {
		return "Unknown";
	}
}



module.exports = router;