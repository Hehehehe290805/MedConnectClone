import { body } from "express-validator";

export const suggestValidator = [
    body("name")
        .notEmpty().withMessage("Name is required"),
    body("type")
        .notEmpty().withMessage("Type is required")
        .isIn(["specialty", "subspecialty", "service"])
        .withMessage("Type must be specialty, subspecialty, or service"),
    body("rootSpecialtyId")
        .if(body("type").equals("subspecialty"))
        .notEmpty().withMessage("Root specialty ID is required for subspecialty")
        .isMongoId().withMessage("Invalid root specialty ID"),
];

export const claimValidator = [
    body("targetId")
        .notEmpty().withMessage("Target ID is required")
        .isMongoId().withMessage("Invalid target ID"),
    body("type")
        .notEmpty().withMessage("Type is required")
        .isIn(["specialty", "subspecialty", "service"])
        .withMessage("Type must be specialty, subspecialty, or service"),
    body("durationMinutes")
        .if(body("type").equals("service"))
        .notEmpty().withMessage("Duration minutes is required for service claims")
        .isInt({ min: 1 }).withMessage("Duration must be a positive integer"),
];