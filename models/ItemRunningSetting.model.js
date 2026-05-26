const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	is_inbound_running: { type: String, default: "0" },
	is_outbound_running: { type: String, default: "0" }
}, {
	timestamps: true
});

schema.index({ item_id: 1 });

module.exports = mongoose.model("ItemRunningSetting", schema);