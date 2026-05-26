const mongoose = require("mongoose");

const schema = mongoose.Schema({
	companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company" },
	code: String,
	name: String,
	description: String,
	sequence: Number,
	email: String,
	emailTitle: String,
	isUrlPerfix: { type: Boolean, default: false },
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ companyCode: 1 });
schema.index({ companyId: 1 });

module.exports = mongoose.model("project", schema);