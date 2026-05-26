const mongoose = require("mongoose");

const schema = mongoose.Schema({
	slug: String,
	providerName: String,
	email: String,
	email_failures_return_url: String,
	response_failures_return_url: String,
	isInboundFtpSuccess: String,
	isInboundFtpFail: String,
	isOutboundFtpSuccess: String,
	isOutboundFtpFail: String,
	isInboundDdepApiSuccess: String,
	isInboundDdepApiFail: String,
	isOutboundDdepApiSuccess: String,
	isOutboundDdepApiFail: String,
	createdBy: String,
	updateBy: String,
	companyCode: String
}, {
	timestamps: true
});

schema.index({ slug: 1 });
schema.index({ companyCode: 1 });

module.exports = mongoose.model("notification", schema);