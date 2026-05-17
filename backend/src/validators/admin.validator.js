import { body, param } from "express-validator";

export const approveRoleValidator = [
    body("userId")
        .notEmpty().withMessage("User ID is required")
        .isMongoId().withMessage("Invalid user ID"),
];

export const approveSuggestionValidator = [
    body("id")
        .notEmpty().withMessage("ID is required")
        .isMongoId().withMessage("Invalid ID"),
];

export const approveClaimValidator = [
    body("claimId")
        .notEmpty().withMessage("Claim ID is required")
        .isMongoId().withMessage("Invalid claim ID"),
];

export const resolveComplaintValidator = [
    body("complaintId")
        .notEmpty().withMessage("Complaint ID is required")
        .isMongoId().withMessage("Invalid complaint ID"),
    body("outcome")
        .notEmpty().withMessage("Outcome is required")
        .isIn(["patient_right", "doctor_right", "split"])
        .withMessage("Invalid outcome value"),
    body("adminNote")
        .notEmpty().withMessage("Admin note is required"),
];

export const getLicenseValidator = [
    param("userId")
        .notEmpty().withMessage("User ID is required")
        .isMongoId().withMessage("Invalid user ID"),
];