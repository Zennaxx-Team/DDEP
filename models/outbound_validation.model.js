const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	validations: [ mongoose.Schema.Types.Mixed ],
	createdBy: String,
	updateBy: String,
	CompanyCode: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });

module.exports = mongoose.model("outbound_validation", schema);