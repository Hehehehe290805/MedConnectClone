import mongoose from "mongoose";

const pharmacyManualTransactionSchema = new mongoose.Schema(
    {
        pharmacyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        transactionDate: {
            type: Date,
            required: true,
            index: true,
        },
        customerName: {
            type: String,
            trim: true,
            default: "Walk-in customer",
        },
        itemSummary: {
            type: String,
            required: true,
            trim: true,
            maxlength: 500,
        },
        amount: {
            type: Number,
            required: true,
            min: 0,
        },
        paymentMethod: {
            type: String,
            enum: ["cash", "gcash", "card", "bank_transfer", "other"],
            default: "cash",
        },
        note: {
            type: String,
            trim: true,
            maxlength: 500,
        },
        referenceNumber: {
            type: String,
            required: true,
            unique: true,
        },
    },
    { timestamps: true }
);

pharmacyManualTransactionSchema.index({ pharmacyId: 1, transactionDate: -1 });

const PharmacyManualTransaction = mongoose.model("PharmacyManualTransaction", pharmacyManualTransactionSchema);
export default PharmacyManualTransaction;
