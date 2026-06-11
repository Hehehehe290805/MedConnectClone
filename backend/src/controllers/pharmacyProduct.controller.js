import PharmacyProduct from "../models/PharmacyProduct.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendError, sendSuccess } from "../utils/response.js";
import { deleteFromS3 } from "../services/s3.js";

const ensurePharmacy = (req, res) => {
    if (req.user?.role !== "pharmacy") {
        sendError(res, 403, "Only pharmacy accounts can manage catalogue products.");
        return false;
    }
    return true;
};

const parseSort = (sort) => {
    if (sort === "price_desc") return { price: -1, name: 1 };
    if (sort === "price_asc") return { price: 1, name: 1 };
    return { createdAt: -1 };
};

const normalizeProductName = (name = "") => name.trim().replace(/\s+/g, " ").toLowerCase();

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const hasDuplicateProductName = async ({ pharmacyId, name, excludeProductId }) => {
    const normalizedName = normalizeProductName(name);
    const filter = {
        pharmacyId,
        isActive: true,
        $or: [
            { nameKey: normalizedName },
            { name: { $regex: `^${escapeRegex(name.trim())}$`, $options: "i" } },
        ],
    };

    if (excludeProductId) {
        filter._id = { $ne: excludeProductId };
    }

    return PharmacyProduct.exists(filter);
};

export const listPublicPharmacyProducts = asyncHandler(async (req, res) => {
    const { q = "", sort = "newest" } = req.query;
    const filter = { isActive: true, stock: { $gt: 0 } };

    if (q.trim()) {
        filter.name = { $regex: q.trim(), $options: "i" };
    }

    const products = await PharmacyProduct.find(filter)
        .populate("pharmacyId", "pharmacyName address")
        .sort(parseSort(sort))
        .limit(100);

    sendSuccess(res, 200, "Pharmacy products retrieved", { products });
});

export const listMyPharmacyProducts = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const products = await PharmacyProduct.find({
        pharmacyId: req.user._id,
        isActive: true,
    }).sort({ createdAt: -1 });

    sendSuccess(res, 200, "Catalogue retrieved", { products });
});

export const createPharmacyProduct = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    if (await hasDuplicateProductName({ pharmacyId: req.user._id, name: req.body.name })) {
        return sendError(res, 409, "A product with this medicine name already exists in your catalogue.");
    }

    const product = await PharmacyProduct.create({
        pharmacyId: req.user._id,
        name: req.body.name,
        image: req.body.image || {},
        quantityValue: req.body.quantityValue,
        quantityUnit: req.body.quantityUnit,
        stock: req.body.stock,
        price: req.body.price,
        overTheCounter: req.body.overTheCounter,
    });

    sendSuccess(res, 201, "Product added to shop", { product });
});

export const updatePharmacyProduct = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const product = await PharmacyProduct.findOne({
        _id: req.params.productId,
        pharmacyId: req.user._id,
        isActive: true,
    });

    if (!product) return sendError(res, 404, "Product not found.");

    const oldImageKey = product.image?.key;
    const nextImageKey = req.body.image?.key;

    if (
        req.body.name !== undefined
        && await hasDuplicateProductName({
            pharmacyId: req.user._id,
            name: req.body.name,
            excludeProductId: product._id,
        })
    ) {
        return sendError(res, 409, "A product with this medicine name already exists in your catalogue.");
    }

    for (const field of ["name", "image", "quantityValue", "quantityUnit", "stock", "price", "overTheCounter"]) {
        if (req.body[field] !== undefined) product[field] = req.body[field];
    }

    await product.save();

    if (oldImageKey && nextImageKey && oldImageKey !== nextImageKey) {
        try { await deleteFromS3(oldImageKey); } catch { /* non-fatal */ }
    }

    sendSuccess(res, 200, "Product updated", { product });
});

export const deletePharmacyProduct = asyncHandler(async (req, res) => {
    if (!ensurePharmacy(req, res)) return;

    const product = await PharmacyProduct.findOne({
        _id: req.params.productId,
        pharmacyId: req.user._id,
        isActive: true,
    });

    if (!product) return sendError(res, 404, "Product not found.");

    product.isActive = false;
    await product.save();

    if (product.image?.key) {
        try { await deleteFromS3(product.image.key); } catch { /* non-fatal */ }
    }

    sendSuccess(res, 200, "Product removed from catalogue");
});
