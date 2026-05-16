import mongoose from "mongoose";

const LogSchema = new mongoose.Schema({
    level: {
        type: String,
        enum: ["error"],
        default: "error"
    },
    message: { type: String, required: true },
    stack: { type: String },
    controller: { type: String },
    createdAt: { type: Date, default: Date.now }
});

// Optional: add an index for fast querying recent errors
LogSchema.index({ createdAt: -1 });

const Log = mongoose.model("Log", LogSchema);

export default Log;
