import { body, param } from "express-validator";

export const bookAppointmentValidator = [
    body("start")
        .notEmpty().withMessage("Start time is required")
        .isISO8601().withMessage("Start time must be a valid ISO8601 date"),
    body("doctorId")
        .optional()
        .isMongoId().withMessage("Invalid doctor ID"),
    body("instituteId")
        .optional()
        .isMongoId().withMessage("Invalid institute ID"),
    body("serviceId")
        .optional()
        .isMongoId().withMessage("Invalid service ID"),
];

export const payDepositValidator = [
    body("appointmentId")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
    body("referenceNumber")
        .notEmpty().withMessage("Reference number is required"),
];

export const cancelAppointmentValidator = [
    body("appointmentId")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
];

export const submitReviewValidator = [
    body("appointmentId")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
    body("rating")
        .notEmpty().withMessage("Rating is required")
        .isInt({ min: 1, max: 5 }).withMessage("Rating must be between 1 and 5"),
    body("review").optional().isString(),
];

export const payRemainingValidator = [
    body("appointmentId")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
    body("referenceNumber")
        .notEmpty().withMessage("Reference number is required"),
];

export const fileComplaintValidator = [
    param("id")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
    body("complaint")
        .notEmpty().withMessage("Complaint message is required"),
];

export const completeAppointmentValidator = [
    body("appointmentId")
        .notEmpty().withMessage("Appointment ID is required")
        .isMongoId().withMessage("Invalid appointment ID"),
];