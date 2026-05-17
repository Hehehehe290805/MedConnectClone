import { body } from "express-validator";

export const signupValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("password")
        .notEmpty().withMessage("Password is required")
        .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
    body("role")
        .optional()
        .isIn(["user", "doctor", "institute", "pharmacist", "admin"])
        .withMessage("Invalid role"),
];

export const loginValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("password")
        .notEmpty().withMessage("Password is required"),
];