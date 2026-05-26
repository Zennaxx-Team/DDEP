const mongoose = require("mongoose");

const schema = mongoose.Schema({
	policyId: { type: mongoose.Schema.Types.ObjectId, ref: "alert_policies" },
	name: { type: String, required: true },
	description : String,
	moniterRules: { type: Array, default: [] },
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyCode: 1 });
schema.index({ policyId: 1 });

module.exports = mongoose.model("alert_conditions", schema);