const mongoose = require("mongoose");

const schema = mongoose.Schema({
	guid_key: String,
	role_id: String,
	user_name: String,
	project_code: String,
	create_by: String,
	create_date: String,
	branch_code: String,
	companyCode: String
}, {
	timestamps: true
});

module.exports = mongoose.model("tbl_staffrole", schema);