const request = require("request");
const config = require("../config");
const { getGeneralSetting } = require("../controllers/settings.controller");

const getGeneralSettings = async (companyCode) => {
	try {
		const response = await getGeneralSetting(companyCode, "general-settings");

		return JSON.stringify(response);
	} catch (error) {
		console.error("Error while fetching general settings:", error.message);
		return JSON.stringify({
			status: 0,
			message: "Failed to fetch general settings",
			data: null
		});
	}
};

module.exports = { getGeneralSettings }