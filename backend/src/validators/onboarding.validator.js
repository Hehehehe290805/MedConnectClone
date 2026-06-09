import { body } from "express-validator";

const addressFields = [
    body("address.buildingNumber").notEmpty().withMessage("Building number is required"),
    body("address.city").notEmpty().withMessage("City is required"),
    body("address.province").notEmpty().withMessage("Province is required"),
    body("address.barangay").notEmpty().withMessage("Barangay is required"),
    body("address.street").notEmpty().withMessage("Street is required"),
    body("address.postalCode").notEmpty().withMessage("Postal code is required"),
    body("address.coordinates.coordinates")
        .isArray({ min: 2, max: 2 }).withMessage("Coordinates must be [longitude, latitude]")
        .custom((coords) => {
            if (coords[0] === 0 && coords[1] === 0) {
                throw new Error("Address could not be verified. Please use a valid address or pin your location on the map.");
            }
            return true;
        }),
];

const publicImageFields = (prefix) => [
    body(`${prefix}.url`).notEmpty().withMessage(`${prefix} URL is required`),
    body(`${prefix}.key`).notEmpty().withMessage(`${prefix} key is required`),
];

const privateImageFields = (prefix) => [
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
    // phoneNumber is optional here — phone-signup users already have it from signup;
    // email-signup users provide it in the form (frontend enforces 10 digits)
    body("phoneNumber").optional().isString(),
    body("phoneType")
        .optional()
        .isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
];

const languageFields = [
    body("languages").isArray({ min: 1 }).withMessage("At least one language is required"),
];

export const onboardPatientValidator = [
    ...personalFields,
    ...languageFields,
    ...addressFields,
    ...publicImageFields("profilePic"),
];

export const onboardDoctorValidator = [
    ...personalFields,
    ...languageFields,
    ...addressFields,
    ...publicImageFields("profilePic"),
    ...privateImageFields("licenseImage"),
    ...privateImageFields("legalIDImage"),
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
    body("phoneNumber").optional().isString(),
    body("phoneType").optional().isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    ...addressFields,
    ...publicImageFields("profilePic"),
    ...privateImageFields("businessPermit"),
    ...privateImageFields("fdaLicense"),
    ...privateImageFields("pharmacistLicenseImage"),
    ...privateImageFields("pharmacistLegalIDImage"),
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
    body("phoneNumber").optional().isString(),
    body("phoneType").optional().isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    ...publicImageFields("profilePic"),
];

export const onboardDepartmentValidator = [
    body("deptEmail").notEmpty().withMessage("Department email is required").isEmail().withMessage("Must be a valid email"),
    body("deptPassword").notEmpty().withMessage("Password is required"),
    body("confirmPassword").notEmpty().withMessage("Confirm password is required"),
    body("departmentTypeId").custom((value, { req }) => {
        if (!value && !req.body.customDepartmentName) {
            throw new Error("Department type is required");
        }
        return true;
    }),
    body("technologistFirstName").notEmpty().withMessage("First name is required"),
    body("technologistLastName").notEmpty().withMessage("Last name is required"),
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
    ...publicImageFields("profilePic"),
    ...privateImageFields("technologistLicenseImage"),
    ...privateImageFields("technologistLegalIDImage"),
    body("technologistLicenseNumber").notEmpty().withMessage("License number is required"),
    body("technologistLicenseExpiration")
        .notEmpty().withMessage("License expiration is required")
        .isISO8601().withMessage("Invalid date format"),
];

export const onboardInstituteValidator = [
    body("instituteName").notEmpty().withMessage("Institute name is required"),
    body("instituteType")
        .notEmpty().withMessage("Institute type is required")
        .isIn(["clinic", "hospital"]).withMessage("Institute type must be clinic or hospital"),
    body("bio").optional().isString().withMessage("Bio must be a string"),
    body("contactFirstName").notEmpty().withMessage("Contact first name is required"),
    body("contactLastName").notEmpty().withMessage("Contact last name is required"),
    body("phoneNumber").optional().isString(),
    body("phoneType").optional().isIn(["mobile", "telephone"]).withMessage("Phone type must be mobile or telephone"),
    ...addressFields,
    ...publicImageFields("profilePic"),
    ...privateImageFields("businessPermit"),
    body("businessPermitExpiration")
        .notEmpty().withMessage("Business permit expiration is required")
        .isISO8601().withMessage("Invalid date format"),
    body("licensingAgency").notEmpty().withMessage("Licensing agency is required"),
    // constructionPermit only required for hospitals — validated conditionally in controller
];