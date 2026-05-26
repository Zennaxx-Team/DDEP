const mongoose = require("mongoose");

const schema = mongoose.Schema({
	jti: { type: String, required: true, unique: true },
	createdAt: { type: Date, default: Date.now }
}, {
	timestamps: true
});

module.exports = mongoose.model("jwt_auth_record", schema);