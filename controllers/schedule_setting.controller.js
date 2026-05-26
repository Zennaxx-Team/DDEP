const jwtDecode = require("jwt-decode");
const mongoose = require("mongoose");
const config = require("../config");
const scheduleSettingModel = require("../models/schedule_setting.model");

const extractUserInfoFromToken = (cookies) => {
	if (cookies && cookies.Token && process.env.EnableGima === "true") {
		const decoded = jwtDecode(cookies.Token);

		return {
			companyCode: decoded.company_code,
			userName: decoded.username,
		};
	}

	return {
		companyCode: config.companyCode,
		userName: config.userName,
	};
};

const validateScheduleSettingInput = (body) => {
	if (!body.item_id) {
		return "Item ID not found";
	}

	return null;
};

const create = async (req, res, next) => {
	try {
		const { companyCode, userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateScheduleSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const scheduleSetting = new scheduleSettingModel({
			item_id: req.body.item_id, 
			Schedule_configure_inbound: req.body.Schedule_configure_inbound || "", 
			schedule_type_inbound: req.body.schedule_type_inbound || "",
			one_time_occurrence_inbound_date: req.body.one_time_occurrence_inbound_date || "",
			one_time_occurrence_inbound_time: req.body.one_time_occurrence_inbound_time || "",
			occurs_inbound: req.body.occurs_inbound || "",
			day_frequency_inbound_count: req.body.day_frequency_inbound_count || "",
			day_frequency_outbound_count: req.body.day_frequency_outbound_count || "",
			weekly_frequency_inbound_count: req.body.weekly_frequency_inbound_count || "",
			weekly_frequency_outbound_count: req.body.weekly_frequency_outbound_count || "",
			monthly_frequency_day_inbound: req.body.monthly_frequency_day_inbound || "",
			monthly_frequency_day_inbound_count: req.body.monthly_frequency_day_inbound_count || "",
			monthly_frequency_the_inbound_count: req.body.monthly_frequency_the_inbound_count || "",
			monthly_frequency_the_outbound_count: req.body.monthly_frequency_the_outbound_count || "",
			monthly_frequency_day_outbound: req.body.monthly_frequency_day_outbound || "",
			monthly_frequency_day_outbound_count: req.body.monthly_frequency_day_outbound_count || "",
			daily_frequency_type_inbound: req.body.daily_frequency_type_inbound || "",
			daily_frequency_type_outbound: req.body.daily_frequency_type_outbound || "",
			daily_frequency_once_time_inbound: req.body.daily_frequency_once_time_inbound || "",
			daily_frequency_once_time_outbound: req.body.daily_frequency_once_time_outbound || "",
			daily_frequency_every_time_unit_inbound: req.body.daily_frequency_every_time_unit_inbound || "",
			daily_frequency_every_time_unit_outbound: req.body.daily_frequency_every_time_unit_outbound || "",
			daily_frequency_every_time_count_inbound: req.body.daily_frequency_every_time_count_inbound || "",
			daily_frequency_every_time_count_outbound: req.body.daily_frequency_every_time_count_outbound || "",
			daily_frequency_every_time_count_start_inbound: req.body.daily_frequency_every_time_count_start_inbound || "",
			daily_frequency_every_time_count_start_outbound: req.body.daily_frequency_every_time_count_start_outbound || "",
			daily_frequency_every_time_count_end_inbound: req.body.daily_frequency_every_time_count_end_inbound || "",
			daily_frequency_every_time_count_end_outbound: req.body.daily_frequency_every_time_count_end_outbound || "",
			occurs_weekly_fields_inbound: req.body.occurs_weekly_fields_inbound || "",
			monthly_field_setting_inbound: req.body.monthly_field_setting_inbound || "",
			Schedule_configure_outbound: req.body.Schedule_configure_outbound || "",
			schedule_type_outbound: req.body.schedule_type_outbound || "",
			one_time_occurrence_outbound_date: req.body.one_time_occurrence_outbound_date || "",
			one_time_occurrence_outbound_time: req.body.one_time_occurrence_outbound_time || "",
			occurs_outbound: req.body.occurs_outbound || "",
			recurs_count_outbound: req.body.recurs_count_outbound || "",
			recurs_time_outbound: req.body.recurs_time_outbound || "",
			occurs_weekly_fields_outbound: req.body.occurs_weekly_fields_outbound || "",
			monthly_field_setting_outbound: req.body.monthly_field_setting_outbound || "",
			duration_inbound_start_date: req.body.duration_inbound_start_date || "",
			duration_inbound_is_end_date: req.body.duration_inbound_is_end_date || "",
			duration_inbound_end_date: req.body.duration_inbound_end_date || "",
			duration_outbound_start_date: req.body.duration_outbound_start_date || "",
			duration_outbound_is_end_date: req.body.duration_outbound_is_end_date || "",
			duration_outbound_end_date: req.body.duration_outbound_end_date || "",
			next_date_inbound: req.body.next_date_inbound || "",
			next_date_outbound: req.body.next_date_outbound || "",
			enableLog: req.body.enableLog || "off",
			createdBy: userName,
			updateBy: userName,
			CompanyCode: companyCode
		});

		const createdScheduleSetting = await scheduleSetting.save();

		return res.status(200).send({ status: 1, message: "Schedule setting created successfully!", id: createdScheduleSetting._id });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findAll = async (req, res, next) => {
	try {
		const scheduleSetting = await scheduleSettingModel.find();

		return res.status(200).send({ status: 1, message: "Schedule setting retrieved successfully!", data: scheduleSetting });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const findOne = async (req, res, next) => {
	try {
		const scheduleSetting = await scheduleSettingModel.aggregate([
			{ $match: { item_id: new mongoose.Types.ObjectId(req.params.id) } },
			{ $limit: 1 }
		]);

		if (!scheduleSetting || scheduleSetting.length === 0) {
			return res.status(200).send({ status: 0, message: "Schedule setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Schedule setting retrieved successfully!", data: scheduleSetting[0] });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

const update = async (req, res, next) => {
	try {
		const { userName } = extractUserInfoFromToken(req.cookies);

		const validationError = validateScheduleSettingInput(req.body);
		if (validationError) {
			return res.status(400).send({ status: 0, message: validationError });
		}

		const updatedScheduleSetting = await scheduleSettingModel.findByIdAndUpdate(
			req.params.id,
			{
				Schedule_configure_inbound: req.body.Schedule_configure_inbound || "", 
				schedule_type_inbound: req.body.schedule_type_inbound || "",
				one_time_occurrence_inbound_date: req.body.one_time_occurrence_inbound_date || "",
				one_time_occurrence_inbound_time: req.body.one_time_occurrence_inbound_time || "",
				occurs_inbound: req.body.occurs_inbound || "",
				day_frequency_inbound_count: req.body.day_frequency_inbound_count || "",
				day_frequency_outbound_count: req.body.day_frequency_outbound_count || "",
				weekly_frequency_inbound_count: req.body.weekly_frequency_inbound_count || "",
				weekly_frequency_outbound_count: req.body.weekly_frequency_outbound_count || "",
				monthly_frequency_day_inbound: req.body.monthly_frequency_day_inbound || "",
				monthly_frequency_day_inbound_count: req.body.monthly_frequency_day_inbound_count || "",
				monthly_frequency_the_inbound_count: req.body.monthly_frequency_the_inbound_count || "",
				monthly_frequency_the_outbound_count: req.body.monthly_frequency_the_outbound_count || "",
				monthly_frequency_day_outbound: req.body.monthly_frequency_day_outbound || "",
				monthly_frequency_day_outbound_count: req.body.monthly_frequency_day_outbound_count || "",
				daily_frequency_type_inbound: req.body.daily_frequency_type_inbound || "",
				daily_frequency_type_outbound: req.body.daily_frequency_type_outbound || "",
				daily_frequency_once_time_inbound: req.body.daily_frequency_once_time_inbound || "",
				daily_frequency_once_time_outbound: req.body.daily_frequency_once_time_outbound || "",
				daily_frequency_every_time_unit_inbound: req.body.daily_frequency_every_time_unit_inbound || "",
				daily_frequency_every_time_unit_outbound: req.body.daily_frequency_every_time_unit_outbound || "",
				daily_frequency_every_time_count_inbound: req.body.daily_frequency_every_time_count_inbound || "",
				daily_frequency_every_time_count_outbound: req.body.daily_frequency_every_time_count_outbound || "",
				daily_frequency_every_time_count_start_inbound: req.body.daily_frequency_every_time_count_start_inbound || "",
				daily_frequency_every_time_count_start_outbound: req.body.daily_frequency_every_time_count_start_outbound || "",
				daily_frequency_every_time_count_end_inbound: req.body.daily_frequency_every_time_count_end_inbound || "",
				daily_frequency_every_time_count_end_outbound: req.body.daily_frequency_every_time_count_end_outbound || "",
				occurs_weekly_fields_inbound: req.body.occurs_weekly_fields_inbound || "",
				monthly_field_setting_inbound: req.body.monthly_field_setting_inbound || "",
				Schedule_configure_outbound: req.body.Schedule_configure_outbound || "",
				schedule_type_outbound: req.body.schedule_type_outbound || "",
				one_time_occurrence_outbound_date: req.body.one_time_occurrence_outbound_date || "",
				one_time_occurrence_outbound_time: req.body.one_time_occurrence_outbound_time || "",
				occurs_outbound: req.body.occurs_outbound || "",
				recurs_count_outbound: req.body.recurs_count_outbound || "",
				recurs_time_outbound: req.body.recurs_time_outbound || "",
				occurs_weekly_fields_outbound: req.body.occurs_weekly_fields_outbound || "",
				monthly_field_setting_outbound: req.body.monthly_field_setting_outbound || "",
				duration_inbound_start_date: req.body.duration_inbound_start_date || "",
				duration_inbound_is_end_date: req.body.duration_inbound_is_end_date || "",
				duration_inbound_end_date: req.body.duration_inbound_end_date || "",
				duration_outbound_start_date: req.body.duration_outbound_start_date || "",
				duration_outbound_is_end_date: req.body.duration_outbound_is_end_date || "",
				duration_outbound_end_date: req.body.duration_outbound_end_date || "",
				next_date_inbound: req.body.next_date_inbound || "",
				next_date_outbound: req.body.next_date_outbound || "",
				enableLog: req.body.enableLog || "off",
				updateBy: userName
			},
			{ new: true }
		);

		if (!updatedScheduleSetting) {
			return res.status(404).send({ status: 0, message: "Schedule setting not found!" });
		}

		return res.status(200).send({ status: 1, message: "Schedule setting updated successfully!" });
	} catch (err) {
		err.statusCode = 500;
		next(err);
	}
};

module.exports = { create, findAll, findOne, update };