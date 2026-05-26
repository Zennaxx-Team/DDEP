const mongoose = require("mongoose");

const schema = mongoose.Schema({
	branch_code: String,
	branch_name: String,
	create_by: String,
	create_date: String,
	update_by: String,
	update_date: String,
	remark: String,
	companyCode: String
}, {
	timestamps: true
});

module.exports = mongoose.model("tbl_branch", schema);