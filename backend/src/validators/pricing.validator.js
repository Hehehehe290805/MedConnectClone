import { body } from "express-validator";

export const setPricingValidator = [
    body("price")
        .notEmpty().withMessage("Price is required")
        .isFloat({ min: 0 }).withMessage("Price must be a positive number"),
    body("serviceId")
        .optional()
        .isMongoId().withMessage("Invalid service ID"),
];