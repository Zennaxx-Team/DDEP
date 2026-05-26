const mongoose = require("mongoose");

const schema = mongoose.Schema({
	name: { type: String, required: true },
	description : String,
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyCode: 1 });

module.exports = mongoose.model("alert_policies", schema);