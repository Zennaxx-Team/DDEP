const mongoose = require("mongoose");

const schema = mongoose.Schema({
	isActive: { type: Boolean, default: true },
	companyCode: String,
	createdBy: String,
	updatedBy: String
}, {
	timestamps: true
});

module.exports = mongoose.model("mapping_profile", schema);