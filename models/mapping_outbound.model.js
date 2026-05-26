const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "items" },
	inbound_format: String,
	outbound_format: String,
	mapping_data: String,
	is_active: { type: String, default: "Active" },
	enableLog: { type: String, default: "off" },
	createdBy: String,
	updateBy: String,
	CompanyCode: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });

module.exports = mongoose.model("mapping_outbound", schema);