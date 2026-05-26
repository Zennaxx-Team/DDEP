const mongoose = require("mongoose");

const schema = mongoose.Schema({
	permissionId: { type: mongoose.Schema.Types.ObjectId, ref: "permission" },
	type: String,
	canView: { type: Boolean, default: false },
	canCreate: { type: Boolean, default: false },
	canModify: { type: Boolean, default: false },
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

module.exports = mongoose.model("permissions_type", schema);