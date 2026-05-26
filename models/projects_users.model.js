const mongoose = require("mongoose");

const schema = mongoose.Schema({
	projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project" },
	userId: String,
	permissionId: String,
	createdBy: String,
	updatedBy: String
},{
	timestamps: true
});

module.exports = mongoose.model("projects_user", schema);