const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	status: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });
schema.index({ status: 1 });

module.exports = mongoose.model("InboundHistory", schema);