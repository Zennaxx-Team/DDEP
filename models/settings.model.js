const mongoose = require("mongoose");

const schema = mongoose.Schema({
	slug: String,
	smtpServer: String,
	smtpPort: String,
	smtpProperties: String,
	smtpEmail: String,
	smtpAccount: String,
	smtpPassword: String,
	smtpAuthenticationSPA: String,
	smtpActive: String,
	data: [ mongoose.Schema.Types.Mixed ],
	createdBy: String,
	updateBy: String,
	companyCode: String
}, {
	timestamps: true
});

schema.index({ slug: 1 });
schema.index({ csompanyCode: 1 });

module.exports = mongoose.model("settings", schema);