import { body } from "express-validator";

const imageFields = (prefix) => [
    body(`${prefix}.url`).notEmpty().withMessage(`${prefix} URL is required`),
    body(`${prefix}.key`).notEmpty().withMessage(`${prefix} key is required`),
];

// Doctor: license group — licenseNumber, licenseExpiration, licenseImage
export const updateDoctorLicenseValidator = [
    body("licenseNumber").notEmpty().withMessage("License number is required"),
    body("licenseExpiration")
        .notEmpty().withMessage("License expiration is required")
        .isISO8601().withMessage("Invalid date format"),
    ...imageFields("licenseImage"),
];

// Pharmacy: pharmacist license group
export const updatePharmacistLicenseValidator = [
    body("pharmacistLicenseNumber").notEmpty().withMessage("Pharmacist license number is required"),
    body("pharmacistLicenseExpiration")
        .notEmpty().withMessage("Pharmacist license expiration is required")
        .isISO8601().withMessage("Invalid date format"),
    ...imageFields("pharmacistLicenseImage"),
];

// Pharmacy: business permit group
export const updateBusinessPermitValidator = [
    ...imageFields("businessPermit"),
    body("businessPermitExpiration")
        .notEmpty().withMessage("Business permit expiration is required")
        .isISO8601().withMessage("Invalid date format"),
];

// Pharmacy: FDA license group
export const updateFdaLicenseValidator = [
    ...imageFields("fdaLicense"),
    body("fdaLicenseExpiration")
        .notEmpty().withMessage("FDA license expiration is required")
        .isISO8601().withMessage("Invalid date format"),
];