const mongoose = require("mongoose");

const schema = mongoose.Schema({
	permissionCode: String,
	name: String,
	description: String,
	isAdmin: { type: Boolean, default: true },
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyCode: 1 });

module.exports = mongoose.model("permission", schema);