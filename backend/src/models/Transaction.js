import mongoose from "mongoose";

const TransactionSchema = new mongoose.Schema(
    {
        appointmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Appointment",
            required: true,
        },
        payerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        payeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        amount:          { type: Number, required: true },  // what the patient paid
        platformFee:     { type: Number, required: true },  // 10% of appointment total
        netAmount:       { type: Number, required: true },  // amount - platformFee (goes to provider)
        type:            { type: String, enum: ["deposit", "balance"], required: true },
        referenceNumber: { type: String, required: true },
    },
    { timestamps: true }
);

TransactionSchema.index({ payerId: 1, createdAt: -1 });
TransactionSchema.index({ payeeId: 1, createdAt: -1 });

const Transaction = mongoose.model("Transaction", TransactionSchema);
export default Transaction;
