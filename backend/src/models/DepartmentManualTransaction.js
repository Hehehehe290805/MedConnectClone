import mongoose from "mongoose";

const departmentManualTransactionSchema = new mongoose.Schema(
    {
        departmentId: {
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
            default: "Walk-in patient",
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

departmentManualTransactionSchema.index({ departmentId: 1, transactionDate: -1 });

const DepartmentManualTransaction = mongoose.model("DepartmentManualTransaction", departmentManualTransactionSchema);
export default DepartmentManualTransaction;
