const mongoose = require("mongoose");

const schema = mongoose.Schema({
    favourite_id: { type: mongoose.Schema.Types.ObjectId, ref: "favourite" },
    company: String,
    company_name: String,
    project: String,
    project_name: String,
    environment: String,
    environment_name: String,
    item: String,
    item_name: String,
    logtriggerstatus: String,
    uniqueId: String,
    path: String,
    descr: String,
    httpStatus: String,
    fromDate: String,
    toDate: String,
    time: String,
    companyCode: String,
    createdBy: String,
    updatedBy: String
}, {
    timestamps: true
});

schema.index({ favourite_id: 1 });

module.exports = mongoose.model("log_query", schema);