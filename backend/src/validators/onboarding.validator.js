import { body } from "express-validator";

const addressFields = [
    body("address.city").notEmpty().withMessage("City is required"),
    body("address.province").notEmpty().withMessage("Province is required"),
    body("address.barangay").notEmpty().withMessage("Barangay is required"),
    body("address.street").notEmpty().withMessage("Street is required"),
    body("address.postalCode").notEmpty().withMessage("Postal code is required"),
    body("address.coordinates.coordinates")
        .isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [longitude, latitude]"),
];

const imageFields = (prefix) => [
    body(`${prefix}.url`).notEmpty().withMessage(`${prefix} URL is required`),
    body(`${prefix}.key`).notEmpty().withMessage(`${prefix} key is required`),
];

const personalFields = [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("birthDate")
        .notEmpty().withMessage("Birth date is required")
        .isISO8601().withMessage("Invalid date format"),
    body("sex")
        .notEmpty().withMessage("Sex is required")
        .isIn(["male", "female"]).withMessage("Sex must be male or female"),
    body("bio").optional().isString().withMessage("Bio must be a string"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("phoneType")
        .notEmpty().withMessage("Phone type is required")
        .isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
];

const languageFields = [
    body("languages").isArray({ min: 1 }).withMessage("At least one language is required"),
];

export const onboardPatientValidator = [
    ...personalFields,
    ...languageFields,
    ...addressFields,
    ...imageFields("profilePic"),
];

export const onboardDoctorValidator = [
    ...personalFields,
    ...languageFields,
    ...addressFields,
    ...imageFields("profilePic"),
    ...imageFields("licenseImage"),
    ...imageFields("legalIDImage"),
    body("specialty").isArray({ min: 1 }).withMessage("At least one specialty is required"),
    body("licenseNumber").notEmpty().withMessage("License number is required"),
    body("licenseExpiration")
        .notEmpty().withMessage("License expiration is required")
        .isISO8601().withMessage("Invalid date format"),
];

export const onboardPharmacyValidator = [
    body("pharmacyName").notEmpty().withMessage("Pharmacy name is required"),
    body("pharmacistFirstName").notEmpty().withMessage("Pharmacist first name is required"),
    body("pharmacistLastName").notEmpty().withMessage("Pharmacist last name is required"),
    body("birthDate")
        .notEmpty().withMessage("Birth date is required")
        .isISO8601().withMessage("Invalid date format"),
    body("sex")
        .notEmpty().withMessage("Sex is required")
        .isIn(["male", "female"]).withMessage("Sex must be male or female"),
    body("bio").optional().isString().withMessage("Bio must be a string"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("phoneType")
        .notEmpty().withMessage("Phone type is required")
        .isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    ...addressFields,
    ...imageFields("profilePic"),
    ...imageFields("businessPermit"),
    ...imageFields("fdaLicense"),
    ...imageFields("pharmacistLicenseImage"),
    ...imageFields("pharmacistLegalIDImage"),
    body("businessPermitExpiration")
        .notEmpty().withMessage("Business permit expiration is required")
        .isISO8601().withMessage("Invalid date format"),
    body("fdaLicenseExpiration")
        .notEmpty().withMessage("FDA license expiration is required")
        .isISO8601().withMessage("Invalid date format"),
    body("pharmacistLicenseNumber").notEmpty().withMessage("Pharmacist license number is required"),
    body("pharmacistLicenseExpiration")
        .notEmpty().withMessage("Pharmacist license expiration is required")
        .isISO8601().withMessage("Invalid date format"),
];

export const onboardAdminValidator = [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("phoneNumber").notEmpty().withMessage("Phone number is required"),
    body("phoneType")
        .notEmpty().withMessage("Phone type is required")
        .isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    ...imageFields("profilePic"),
];