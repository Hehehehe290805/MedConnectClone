import { body } from "express-validator";

export const setAvailabilityValidator = [
    body("startHour")
        .notEmpty().withMessage("Start hour is required")
        .matches(/^\d{2}:\d{2}$/).withMessage("Start hour must be in HH:MM format"),
    body("endHour")
        .notEmpty().withMessage("End hour is required")
        .matches(/^\d{2}:\d{2}$/).withMessage("End hour must be in HH:MM format"),
    body("daysOfWeek")
        .isArray({ min: 1 }).withMessage("At least one day of week is required")
        .custom((days) => days.every((d) => d >= 0 && d <= 6))
        .withMessage("Days must be between 0 (Sunday) and 6 (Saturday)"),
    body("isActive")
        .optional()
        .isBoolean().withMessage("isActive must be a boolean"),
];

