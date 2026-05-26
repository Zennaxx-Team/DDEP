const mongoose = require("mongoose");

const schema = new mongoose.Schema({
    unique_id: { type: String, index: true },
    log_unique_id: { type: String, index: true },
    log_request_id: { type: String, index: true },
    trigger_by: { type: String, required: true },
    securityLevel: { type: String },
    ruleName: { type: String, required: true },
    notifyMethod: { type: String },
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "alert_policies" },
    policyName: String,
    conditionId: { type: mongoose.Schema.Types.ObjectId, ref: "alert_conditions" },
    conditionName: String,
    action: { type: String, index: true },
    description: String,
    datas: String,
    exception_type: { type: String, index: true },
    detail_exception: String,
    httpStatus: String,
    queueId: String,
    companyCode: String,
    createdBy: String,
    updatedBy: String
}, {
    timestamps: true
});

schema.index({ companyCode: 1 });
schema.index({ policyId: 1, conditionId: 1 });

module.exports = mongoose.model("alert_histories_debug", schema);
