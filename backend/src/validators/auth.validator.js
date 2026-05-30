import { body } from "express-validator";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

export const signupValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("password")
        .notEmpty().withMessage("Password is required")
        .matches(passwordRegex).withMessage("Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 symbol (@$!%*?&)"),
    body("adminCode")
        .optional()
        .notEmpty().withMessage("Admin code cannot be empty if provided"),
];

export const loginValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("password")
        .notEmpty().withMessage("Password is required"),
];

export const adminLoginValidator = [
    body("email")
        .notEmpty().withMessage("Email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("password")
        .notEmpty().withMessage("Password is required"),
    body("adminCode")
        .notEmpty().withMessage("Admin code is required"),
];

export const updateMeCredentialsValidator = [
    body("currentEmail")
        .notEmpty().withMessage("Current email is required")
        .isEmail().withMessage("Must be a valid email"),
    body("currentPassword")
        .notEmpty().withMessage("Current password is required"),
    body("newEmail")
        .optional()
        .isEmail().withMessage("New email must be valid"),
    body("newPassword")
        .optional()
        .matches(passwordRegex).withMessage("Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 symbol (@$!%*?&)"),
];

// FLAG: updateMeProfile validator is role-aware — enforced at controller level,
// validator only checks shared shape rules (image objects, date formats, etc.)
export const updateMeProfileValidator = [
    body("adminCode").optional().notEmpty().withMessage("Admin code cannot be empty if provided"),
    body("bio").optional().isString().withMessage("Bio must be a string"),
    body("languages").optional().isArray().withMessage("Languages must be an array"),
    body("phoneNumber").optional().isString().withMessage("Phone number must be a string"),
    body("phoneType").optional().isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    body("birthDate").optional().isISO8601().withMessage("Invalid date format"),
    body("sex").optional().isIn(["male", "female"]).withMessage("Sex must be male or female"),
    body("profilePic.url").optional().isString(),
    body("profilePic.key").optional().isString(),
    body("address.buildingNumber").optional().isString(),
    body("address.street").optional().isString(),
    body("address.barangay").optional().isString(),
    body("address.city").optional().isString(),
    body("address.province").optional().isString(),
    body("address.postalCode").optional().isString(),
    body("address.coordinates.coordinates")
        .optional()
        .isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [longitude, latitude]"),
];