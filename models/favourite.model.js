const mongoose = require("mongoose");

const schema = mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
    name: String,
    description: String,
    sequence: Number,
    isActive: { type: Boolean, default: true },
    companyCode: String,
    createdBy: String,
    updatedBy: String
},{
    timestamps: true
});

schema.index({ item_id: 1 });

module.exports = mongoose.model("favourite", schema);