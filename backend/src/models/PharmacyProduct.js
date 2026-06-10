import mongoose from "mongoose";

const imageSchema = new mongoose.Schema({
    url: { type: String },
    key: { type: String },
}, { _id: false });

const pharmacyProductSchema = new mongoose.Schema(
    {
        pharmacyId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        name: { type: String, required: true, trim: true },
        nameKey: { type: String, required: true, trim: true, lowercase: true },
        image: { type: imageSchema, default: () => ({}) },
        quantityValue: { type: Number, required: true, min: 0 },
        quantityUnit: {
            type: String,
            enum: ["grams", "pills"],
            required: true,
        },
        stock: { type: Number, required: true, min: 0 },
        price: { type: Number, required: true, min: 0 },
        overTheCounter: { type: Boolean, required: true, default: true },
        isActive: { type: Boolean, default: true, index: true },
    },
    { timestamps: true }
);

pharmacyProductSchema.index({ name: "text" });
pharmacyProductSchema.index({ pharmacyId: 1, createdAt: -1 });
pharmacyProductSchema.index({ pharmacyId: 1, nameKey: 1, isActive: 1 });

pharmacyProductSchema.pre("validate", function setNameKey(next) {
    if (this.name) {
        this.nameKey = this.name.trim().replace(/\s+/g, " ").toLowerCase();
    }
    next();
});

const PharmacyProduct = mongoose.model("PharmacyProduct", pharmacyProductSchema);
export default PharmacyProduct;
