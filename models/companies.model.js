const mongoose = require("mongoose");

const schema = mongoose.Schema({
	code: String,
	name: String,
	description: String,
	sequence: Number,
	isUrlPerfix: { type: Boolean, default: false },
	defaultProjectPrefix: { type: String, default: "/default" },
	isDisableDefaultProjectPrefix: { type: Boolean, default: false },
	isSystemCompany: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyCode: 1 });

module.exports = mongoose.model("company", schema);