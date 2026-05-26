const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	inbound_filter: [ mongoose.Schema.Types.Mixed ],
	is_active: { type: String, default: "Active" },
	enableLog: { type: String, default: "off" },
	createdBy: String,
	updateBy: String,
	CompanyCode: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });

module.exports = mongoose.model("inbound_filters", schema);