const mongoose = require("mongoose");

const emailFailureSchema = new mongoose.Schema({
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "company", index: true },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: "project", index: true },
    environmentId: { type: mongoose.Schema.Types.ObjectId, ref: "environment", index: true },
    itemId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        required: false,
        set: v => (v === "" ? null : v),
        index: true
    },
    companyName: String,
    projectName: String,
    environmentName: String,
    emailTo: String,
    subject: String,
    content: String,
    dateTime: Date,
    resendTime: Number,
    resendMessage: String,
    failureReason: String,
    unique_id: { type: String, index: true },
    mail_type: {
        type: String,
        enum: ["log_type", "alert_type"],
        default: "log_type",
        index: true
    },
    latestStatus: {
        type: String,
        enum: ["Success", "Fail"],
        default: "Fail"
    },
    companyCode: { type: String, index: true },
}, {
    timestamps: true
});

// Additional indexes
emailFailureSchema.index({ createdAt: -1 });

module.exports = mongoose.model("email_failure", emailFailureSchema);
