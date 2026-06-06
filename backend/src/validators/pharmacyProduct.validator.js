import { body, param, query } from "express-validator";

const imageField = (field) => [
    body(`${field}.url`).optional({ checkFalsy: true }).isString().withMessage(`${field}.url must be a string`),
    body(`${field}.key`).optional({ checkFalsy: true }).isString().withMessage(`${field}.key must be a string`),
];

export const productQueryValidator = [
    query("q").optional({ checkFalsy: true }).isString().trim().isLength({ max: 80 }).withMessage("Search query is too long"),
    query("sort").optional().isIn(["newest", "price_asc", "price_desc"]).withMessage("Invalid sort option"),
];

export const createPharmacyProductValidator = [
    body("name").notEmpty().withMessage("Medicine name is required").trim().isLength({ max: 120 }).withMessage("Medicine name is too long"),
    body("quantityValue").isFloat({ min: 0 }).withMessage("Quantity must be zero or greater"),
    body("quantityUnit").isIn(["grams", "pills"]).withMessage("Quantity unit must be grams or pills"),
    body("stock").isInt({ min: 0 }).withMessage("Stock must be zero or greater"),
    body("price").isFloat({ min: 0 }).withMessage("Price must be zero or greater"),
    body("overTheCounter").isBoolean().withMessage("Over the counter must be yes or no"),
    ...imageField("image"),
];

export const updatePharmacyProductValidator = [
    param("productId").isMongoId().withMessage("Invalid product ID"),
    body("name").optional().notEmpty().withMessage("Medicine name is required").trim().isLength({ max: 120 }).withMessage("Medicine name is too long"),
    body("quantityValue").optional().isFloat({ min: 0 }).withMessage("Quantity must be zero or greater"),
    body("quantityUnit").optional().isIn(["grams", "pills"]).withMessage("Quantity unit must be grams or pills"),
    body("stock").optional().isInt({ min: 0 }).withMessage("Stock must be zero or greater"),
    body("price").optional().isFloat({ min: 0 }).withMessage("Price must be zero or greater"),
    body("overTheCounter").optional().isBoolean().withMessage("Over the counter must be yes or no"),
    ...imageField("image"),
];

export const pharmacyProductIdValidator = [
    param("productId").isMongoId().withMessage("Invalid product ID"),
];
