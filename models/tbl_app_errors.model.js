const mongoose = require("mongoose");

const schema = mongoose.Schema({
	Error_ID : Number,
	Error_Datetime: Date,
	Error_Page: String,
	Error_Module: String,
	Error_Info: String,
	Error_URL: String,
	Error_HTTP_status_code: String,
	Error_Username: String,
	Error_Companycode: String
}, {
	timestamps: true
});

module.exports = mongoose.model("tbl_app_error", schema);