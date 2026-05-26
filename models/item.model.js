const mongoose = require("mongoose");

const schema = mongoose.Schema({
	ItemCode: { type: String },
	ItemName: String,
	description: String,
	ProjectId: { type: mongoose.Schema.Types.ObjectId, ref: "project", default: null },
	companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company" },
	environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "environment", default: null },
	isActive: { type: String, default: "1" },
	CompanyCode: String,
	createdBy: String,
	updateBy: String
}, {
	timestamps: true
});

schema.index({ ProjectId: 1 });
schema.index({ CompanyCode: 1 });
schema.index({ isActive: 1 });

module.exports = mongoose.model("item", schema);