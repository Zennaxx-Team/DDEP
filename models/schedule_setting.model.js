const mongoose = require("mongoose");

const schema = mongoose.Schema({
	item_id: { type: mongoose.Schema.Types.ObjectId, ref: "item" },
	Schedule_configure_inbound: String,
	schedule_type_inbound: String,
	Schedule_configure_outbound: String,
	schedule_type_outbound: String,
	occurs_inbound: String,
	occurs_outbound: String,
	day_frequency_inbound_count: String,
	day_frequency_outbound_count: String,
	weekly_frequency_inbound_count: String,
	weekly_frequency_outbound_count: String,
	monthly_frequency_day_inbound: String,
	monthly_frequency_day_inbound_count: String,
	monthly_frequency_the_inbound: String,
	monthly_frequency_the_inbound_count: String,
	monthly_frequency_day_outbound: String,
	monthly_frequency_day_outbound_count: String,
	monthly_frequency_the_outbound: String,
	monthly_frequency_the_outbound_count: String,
	daily_frequency_type_inbound: String,
	daily_frequency_type_outbound: String,
	daily_frequency_once_time_inbound: String,
	daily_frequency_every_time_unit_inbound: String,
	daily_frequency_every_time_count_inbound: String,
	daily_frequency_every_time_count_start_inbound: String,
	daily_frequency_every_time_count_end_inbound: String,
	daily_frequency_every_time_count_start_outbound: String,
	daily_frequency_every_time_count_end_outbound: String,
	daily_frequency_once_time_outbound: String,
	daily_frequency_every_time_unit_outbound: String,
	daily_frequency_every_time_count_outbound: String,
	occurs_weekly_fields_inbound: { type : Array , default: [] },
	monthly_field_setting_inbound: { type: Array, default: [] },
	recurs_count_inbound: String,
	recurs_time_inbound: String ,
	recurs_count_outbound: String,
	recurs_time_outbound: String ,
	occurs_weekly_fields_outbound: { type: Array , default: [] },
	monthly_field_setting_outbound: { type: Array, default: [] },
	next_date_inbound: String,
	next_date_outbound: String,
	next_date_time_inbound: String,
	next_date_time_outbound: String,
	duration_inbound_start_date: String,
	duration_inbound_is_end_date: String,
	duration_inbound_end_date: String,
	duration_outbound_start_date: String,
	duration_outbound_is_end_date: String,
	duration_outbound_end_date: String,
	one_time_occurrence_inbound_date: String,
	one_time_occurrence_inbound_time: String,
	one_time_occurrence_outbound_date: String,
	one_time_occurrence_outbound_time: String,
	enableLog: { type: String, default: "off" },
	createdBy: String,
	updateBy: String,
	CompanyCode: String
}, {
	timestamps: true
});

schema.index({ item_id: 1 });
schema.index({ CompanyCode: 1 });
schema.index({ next_date_inbound: 1 });
schema.index({ next_date_outbound: 1 });

module.exports = mongoose.model("ScheduleSetting", schema);