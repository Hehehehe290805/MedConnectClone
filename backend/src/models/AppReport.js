import mongoose from "mongoose";

// Stores user-submitted bug reports and feedback about the MedConnect app itself.
// Separate from Report.js, which handles patient-vs-provider appointment disputes.
const AppReportSchema = new mongoose.Schema(
    {
        reporter: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        category: {
            type: String,
            enum: ["bug", "ux", "feature", "other"],
            required: true,
        },
        subject: {
            type: String,
            required: true,
            trim: true,
            maxlength: 120,
        },
        description: {
            type: String,
            required: true,
            trim: true,
            maxlength: 2000,
        },
        // pending → viewed (admin opened it) → resolved (admin closed it)
        status: {
            type: String,
            enum: ["pending", "viewed", "resolved"],
            default: "pending",
        },
        adminNote: {
            type: String,
            trim: true,
        },
        resolvedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Admin",
        },
    },
    { timestamps: true }
);

AppReportSchema.index({ status: 1, createdAt: -1 });

const AppReport = mongoose.model("AppReport", AppReportSchema);
export default AppReport;
