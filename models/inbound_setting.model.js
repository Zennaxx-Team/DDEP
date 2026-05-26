const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	inbound_format: { type: Array, default: [] },
	urlPrefix: String,
	api_type: String,
	api_ddep_api: String,
	api_user_api: String,
	ddep_api_auth_type: String,
	ddep_api_authorization_api_keys: [mongoose.Schema.Types.Mixed],
	sync_type: String,
	ftp_server_link: String,
	ftp_port: String,
	ftp_login_name: String,
	ftp_password: String,
	ftp_folder: String,
	ftp_backup_folder: String,
	max_file_download: { type: String, default: "50" },
	disabledInboundEmailFailuresNotice: { type: String, default: "off" },
	enableLog: { type: String, default: "off" },
	enableEmail: { type: String, default: "off" },
	email_endpoint_url: { type: Boolean, default: false },
	email_log_url: { type: Boolean, default: false },
	email_request_header: { type: Boolean, default: false },
	email_query_params: { type: Boolean, default: false },
	email_body: { type: Boolean, default: false },
	email_body_html: { type: Boolean, default: false },
	email_validation_message: { type: Boolean, default: false },
	email_logs: { type: Boolean, default: false },
	is_active: { type: String, default: "Active" },
	CompanyCode: String,
	createdBy: String,
	updateBy: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });
schema.index({ CompanyCode: 1 });
schema.index({ is_active: 1 });
schema.index({ sync_type: 1 });
schema.index({ api_type: 1 });
schema.index({ api_ddep_api: 1 });

module.exports = mongoose.model("inboundsetting", schema);