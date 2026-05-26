const mongoose = require("mongoose");

const schema = mongoose.Schema({
	partyId: { type: mongoose.Schema.Types.ObjectId, ref: "permission" },
	environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "permission" },
	domainPrefix: String,
	domain: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

schema.index({ partyId: 1 });

module.exports = mongoose.model("parties_environment", schema);