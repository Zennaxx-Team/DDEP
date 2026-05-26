const mongoose = require("mongoose");

const diffHistorySchema = new mongoose.Schema({
    item_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Item",
        required: false,
        set: v => (v === "" ? null : v),
        index: true
    },
    ItemName: String,
    unique_id: { type: String, index: true },
    log_unique_id: { type: String, index: true },
    log_request_id: { type: String, index: true },
    type: String,
    path: { type: String, index: true },
    action: { type: String, index: true },
    description: String,
    datas: String,
    exception_type: { type: String, index: true },
    detail_exception: String,
    httpStatus: String,
    companyCode: String,
    createdBy: String,
    updatedBy: String
}, {
    timestamps: true
});

// Additional indexes
diffHistorySchema.index({ createdAt: -1 });

module.exports = mongoose.model("diff_history", diffHistorySchema);