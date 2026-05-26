const mongoose = require("mongoose");

const schema = mongoose.Schema({
	companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company" },
	projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project", default: null },
	name: String,
	description: String,
	sequence: Number,
	ddepApiPrefix: String,
	isUrlPerfix: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyId: 1 });
schema.index({ projectId: 1 });

module.exports = mongoose.model("environment", schema);