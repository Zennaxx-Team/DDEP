const mongoose = require("mongoose");

const schema = mongoose.Schema({
	Config_Cleanup_days: { type: Number, require: true },
	Config_Last_date: Date
}, {
	timestamps: true
});

module.exports = mongoose.model("tbl_app_error_config", schema);