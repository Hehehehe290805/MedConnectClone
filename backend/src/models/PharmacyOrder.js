import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
    url: { type: String },
    key: { type: String },
}, { _id: false });

const pharmacyOrderItemSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PharmacyProduct",
    },
    name: { type: String, required: true },
    image: { type: imageSchema, default: () => ({}) },
    unitPrice: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    overTheCounter: { type: Boolean, default: true },
}, { _id: false });

const pharmacyOrderSchema = new mongoose.Schema(
    {
        pharmacyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        patientId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        items: {
            type: [pharmacyOrderItemSchema],
            validate: {
                validator: (items) => Array.isArray(items) && items.length > 0,
                message: "Order must contain at least one item",
            },
        },
        fulfillmentMethod: {
            type: String,
            enum: ["delivery", "pickup"],
            required: true,
        },
        status: {
            type: String,
            enum: [
                "prescription_review",
                "prescription_approved",
                "prescription_rejected",
                "paid",
                "ready_for_shipping",
                "ready_for_pickup",
                "out_for_delivery",
                "pickup_in_progress",
                "completed",
                "cancelled",
            ],
            default: "paid",
            index: true,
        },
        paymentStatus: {
            type: String,
            enum: ["pending", "paid", "refunded"],
            default: "paid",
            index: true,
        },
        subtotal: { type: Number, required: true, min: 0 },
        deliveryFee: { type: Number, default: 0, min: 0 },
        totalAmount: { type: Number, required: true, min: 0 },
        pickupTime: { type: Date },
        deliveryAddress: { type: String },
        clientRequestId: {
            type: String,
            trim: true,
            maxlength: 120,
        },
        referenceNumber: { type: String, required: true, unique: true },
        prescriptionImage: { type: imageSchema, default: () => ({}) },
        prescriptionReviewedAt: { type: Date },
        prescriptionReviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        prescriptionRejectionReason: { type: String },
        paidAt: { type: Date },
        readyAt: { type: Date },
        fulfillmentStartedAt: { type: Date },
        autoCompleteAt: { type: Date },
        completedAt: { type: Date },
    },
    { timestamps: true }
);

pharmacyOrderSchema.index({ pharmacyId: 1, status: 1, createdAt: -1 });
pharmacyOrderSchema.index({ patientId: 1, createdAt: -1 });
pharmacyOrderSchema.index({ autoCompleteAt: 1, status: 1 });
pharmacyOrderSchema.index(
    { patientId: 1, clientRequestId: 1 },
    { unique: true, sparse: true }
);

const PharmacyOrder = mongoose.model("PharmacyOrder", pharmacyOrderSchema);
export default PharmacyOrder;
