const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	outbound_format: { type: Array , default: [] },
	sync_type_out: String,
	flowType: String,
	api_url: String,
	defaultInboundMapping: { type: mongoose.Schema.Types.ObjectId, ref: "mapping_profile", default: null },
	defaultOutboundMapping: { type: mongoose.Schema.Types.ObjectId, ref: "mapping_profile", default: null },
	defaultInboundMappingVersion : String,
	defaultOutboundMappingVersion : String,
	endpoints: { type: Array , default: [] },
	globalHeaders: { type: Array , default: [] },
	specifyHeaders: { type: Object , default: {} },
	max_file_post: { type: String, default: "50" },
	sendCollectionOnebyOne: {type: String, default: "off" },
	collections_name: String,
	disabledOutboundResponseFailuresNotice: { type: String, default: "off"},
	disabledOutboundEmailFailuresNotice: { type: String, default: "off"},
	enableLog: { type: String, default: "off"},
	enableEmail: {type: String, default: "off"},
	email_endpoint_url: { type: Boolean, default: false },
	email_log_url : { type: Boolean, default: false },
	email_request_header: { type: Boolean, default: false },
	email_transformed_header : { type: Boolean, default: false },
	email_query_params: { type: Boolean, default: false },
	email_body: { type: Boolean, default: false },
	email_body_html : { type: Boolean, default: false },
	email_transformed_body: { type: Boolean, default: false },
	email_transformed_body_html: { type: Boolean, default: false },
	email_request_endpoint_url_information: { type: Boolean, default: false },
	email_response: { type: Boolean, default: false },
	email_response_html: { type: Boolean, default: false },
	email_transformed_response: { type: Boolean, default: false },
	email_transformed_response_html: { type: Boolean, default: false },
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

module.exports = mongoose.model("OutboundSetting", schema);