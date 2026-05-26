const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: {
		type: mongoose.Schema.Types.ObjectId,
		ref: "Item",
		required: false,
		set: v => (v === "" ? null : v),
		index: true
	},
	unique_id: { type: String, index: true },
	type: String,
	action: { type: String, index: true },
	description: String,
	exception_type: { type: String, index: true },
	project: String,
	environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "environment", index: true },
	projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project", index: true },
	companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company", index: true },
	companyName: String,
	projectName: String,
	environmentName: String,
	item: String,
	detail_exception: String,
	datas: String,
	path: { type: String, index: true },
	isTriggeredOutbound: { type: Boolean },
	queueId: String,
	request_id: { type: String },
	httpStatus: String,
	CompanyCode: { type: String, index: true }
}, {
	timestamps: true
});

schema.index({
	CompanyCode: 1,
	exception_type: 1,
	path: 1,
	createdAt: -1
});

schema.index({
	CompanyCode: 1,
	companyId: 1,
	projectId: 1,
	environmentId: 1,
	createdAt: -1
});

schema.index({
	unique_id: 1,
	action: 1,
	createdAt: -1
});

schema.index({
	unique_id: 1,
	action: 1,
	description: 1
});

schema.index({
	item_id: 1,
	CompanyCode: 1,
	createdAt: -1
});

schema.index({
	exception_type: 1,
	CompanyCode: 1,
	createdAt: -1
});

schema.index({ unique_id: 1 });
schema.index({ createdAt: -1 });

module.exports = mongoose.model("log_history", schema);