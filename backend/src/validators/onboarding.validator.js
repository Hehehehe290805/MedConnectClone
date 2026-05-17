import { body } from "express-validator";

const commonFields = [
    body("firstName").notEmpty().withMessage("First name is required"),
    body("lastName").notEmpty().withMessage("Last name is required"),
    body("birthDate").notEmpty().withMessage("Birth date is required").isISO8601().withMessage("Invalid date format"),
    body("bio").notEmpty().withMessage("Bio is required"),
    body("languages").isArray({ min: 1 }).withMessage("At least one language is required"),
    body("location").notEmpty().withMessage("Location is required"),
];

export const onboardValidator = [
    ...commonFields,
    body("sex").notEmpty().withMessage("Sex is required").isIn(["male", "female"]).withMessage("Sex must be male or female"),
];

export const onboardDoctorValidator = [
    ...commonFields,
    body("sex").notEmpty().withMessage("Sex is required").isIn(["male", "female"]).withMessage("Sex must be male or female"),
    body("profession").notEmpty().withMessage("Profession is required"),
    body("licenseNumber").notEmpty().withMessage("License number is required"),
];

export const onboardInstituteValidator = [
    body("facilityName").notEmpty().withMessage("Facility name is required"),
    body("bio").notEmpty().withMessage("Bio is required"),
    body("languages").isArray({ min: 1 }).withMessage("At least one language is required"),
    body("location").notEmpty().withMessage("Location is required"),
];

export const onboardPharmacistValidator = [
    ...commonFields,
    body("licenseNumber").notEmpty().withMessage("License number is required"),
];

export const onboardAdminValidator = [
    ...commonFields,
    body("adminCode").notEmpty().withMessage("Admin code is required"),
];

export const changeRoleValidator = [
    body("role")
        .notEmpty().withMessage("Role is required")
        .isIn(["doctor", "pharmacist", "institute", "admin"])
        .withMessage("Invalid role"),
];