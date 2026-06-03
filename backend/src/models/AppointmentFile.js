import mongoose from "mongoose";

// Stores files attached to an appointment: pre-consultation notes (auto-generated),
// doctor notes/prescriptions, lab reports from departments, and patient uploads.
// All files are stored in a private S3 folder keyed by appointmentId.
const AppointmentFileSchema = new mongoose.Schema(
    {
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
            required: true,
            index: true,
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        // Role at upload time — used for UI grouping (e.g. "Lab Results from Department")
        uploaderRole: {
            type: String,
            enum: ["patient", "doctor", "department"],
            required: true,
        },
        fileType: {
            type: String,
            // preconsultation: auto-attached when appointment is booked from the wizard
            // note: free-form text / markdown notes
            // image: photos (stored as WebP)
            // lab_report: department-uploaded diagnostic results
            // document: PDFs or other documents
            enum: ["preconsultation", "note", "image", "lab_report", "document"],
            required: true,
        },
        // Human-readable name shown in the UI (may differ from the S3 key)
        originalName: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        s3Key: {
            type: String,
            required: true,
        },
        mimeType: {
            type: String,
            required: true,
        },
        sizeBytes: {
            type: Number,
            required: true,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 500,
        },
    },
    { timestamps: true }
);

const AppointmentFile = mongoose.model("AppointmentFile", AppointmentFileSchema);
export default AppointmentFile;
