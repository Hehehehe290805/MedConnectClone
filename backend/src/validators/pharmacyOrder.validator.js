import { body, param, query } from "express-validator";

export const pharmacyOrderIdValidator = [
    param("orderId").isMongoId().withMessage("Invalid order ID"),
];

const checkoutItemsValidator = [
    body("items").isArray({ min: 1 }).withMessage("At least one item is required"),
    body("items.*.productId").isMongoId().withMessage("Invalid product ID"),
    body("items.*.quantity").isInt({ min: 1 }).withMessage("Quantity must be at least 1"),
    body("fulfillmentMethod").isIn(["delivery", "pickup"]).withMessage("Fulfillment method must be delivery or pickup"),
    body("deliveryAddress").optional({ checkFalsy: true }).isString().trim().isLength({ max: 300 }).withMessage("Delivery address is too long"),
    body("pickupTime").optional({ checkFalsy: true }).isISO8601().withMessage("Pickup time must be a valid date"),
    body("clientRequestId").optional({ checkFalsy: true }).isString().trim().isLength({ min: 8, max: 120 }).withMessage("Invalid checkout request ID"),
];

export const createPaidPharmacyOrderValidator = [
    ...checkoutItemsValidator,
];

export const submitPrescriptionReviewOrderValidator = [
    ...checkoutItemsValidator,
    body("prescriptionImage.key").notEmpty().withMessage("Prescription image is required"),
    body("prescriptionImage.url").optional({ checkFalsy: true }).isString().withMessage("Prescription image URL must be a string"),
];

export const rejectPrescriptionOrderValidator = [
    ...pharmacyOrderIdValidator,
    body("reason").notEmpty().withMessage("Rejection reason is required").isString().trim().isLength({ max: 300 }).withMessage("Rejection reason is too long"),
    body("notes").optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }).withMessage("Rejection notes are too long"),
];

export const pharmacyIncomeQueryValidator = [
    query("year").optional().isInt({ min: 2020, max: 2100 }).withMessage("Invalid year"),
    query("month").optional().isInt({ min: 1, max: 12 }).withMessage("Invalid month"),
];

export const createManualPharmacyTransactionValidator = [
    body("transactionDate").isISO8601().withMessage("Transaction date is required"),
    body("customerName").optional({ checkFalsy: true }).isString().trim().isLength({ max: 120 }).withMessage("Customer name is too long"),
    body("itemSummary").notEmpty().withMessage("Item summary is required").trim().isLength({ max: 500 }).withMessage("Item summary is too long"),
    body("amount").isFloat({ min: 0 }).withMessage("Amount must be zero or greater"),
    body("paymentMethod").optional().isIn(["cash", "gcash", "card", "bank_transfer", "other"]).withMessage("Invalid payment method"),
    body("note").optional({ checkFalsy: true }).isString().trim().isLength({ max: 500 }).withMessage("Note is too long"),
];
