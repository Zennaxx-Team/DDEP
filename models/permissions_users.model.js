const mongoose = require("mongoose");

const schema = mongoose.Schema({
	permissionId: { type: mongoose.Schema.Types.ObjectId, ref: "permission" },
	userName: String,
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

module.exports = mongoose.model("permissions_user", schema);