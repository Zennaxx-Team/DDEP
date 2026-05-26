const mongoose = require("mongoose");

const schema = mongoose.Schema({
	mappingProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "mapping_profile" },
	companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company" },
	projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project", default: null },
	name: { type: String, required: true },
	version: { type: String, required: true },
	description: String,
	returnUrl: String,
	sendCollectionOnebyOne: { type: Boolean, default: false },
	collectionsName: String,
	filters: { type: Array, default: [] },
	inboundFormat: { type: String, default: "json" },
	outboundFormat: { type: String, default: "json" },
	inboundFormatData: { type: String, default: "" },
	outboundFormatData: { type: String, default: "" },
	mappingData: { type: Object, default: {} },
	properties: { type: Array, default: [] },
	isCurrentVersion: { type: Boolean, default: true },
	isActive: { type: Boolean, default: true },
	createdBy: String,
	updatedBy: String
}, {
	timestamps: true
});

module.exports = mongoose.model("mapping_profiles_history", schema);