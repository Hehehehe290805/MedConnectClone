import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema(
    {
        recipient: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        type: {
            type: String,
            required: true,
            enum: [
                // Account lifecycle
                "role_approved",
                "role_rejected",
                "new_account_pending",    // admin alert: a new role is awaiting review
                "account_deletion_requested", // confirmation to user who soft-deleted

                // Specialty / service suggestions & claims
                "suggestion_approved",
                "suggestion_rejected",
                "claim_approved",
                "claim_rejected",

                // Permit & license renewals
                "renewal_approved",
                "renewal_rejected",
                "renewal_submitted",      // admin alert: new renewal request pending
                "license_expiring_soon",
                "license_expired",

                // Appointments
                "appointment_booked",
                "appointment_accepted",
                "appointment_rejected",
                "appointment_cancelled",
                "appointment_started",
                "appointment_completed",
                "payment_received",

                // Pharmacy orders
                "pharmacy_order_ready",
                "pharmacy_order_in_progress",
                "pharmacy_order_completed",
                "pharmacy_order_paid",
                "pharmacy_prescription_review",
                "pharmacy_prescription_approved",
                "pharmacy_prescription_rejected",

                // Disputes / reports
                "dispute_filed",
                "dispute_resolved",
                "dispute_admin_alert",    // admin alert: a dispute was filed and needs review
            ],
        },
        title:  { type: String, required: true },
        body:   { type: String, required: true },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: () => ({}),
        },
        isRead: { type: Boolean, default: false },
    },
    { timestamps: true }
);

NotificationSchema.index({ recipient: 1, isRead: 1 });
NotificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", NotificationSchema);
export default Notification;
