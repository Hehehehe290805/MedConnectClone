import express from "express";
import {
    bookAppointment, payDeposit, acceptAppointment, rejectAppointment,
    cancelAppointment, completeAppointment, payBalance,
    rebookAppointment, fileDispute, submitReview, joinCall, getMyAppointments, getTransactionHistory,
    getProviderReviews, deleteReview, getDepartmentIncome, createDepartmentManualTransaction
} from "../controllers/booking.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    bookAppointmentValidator, payDepositValidator,
    acceptAppointmentValidator, rejectAppointmentValidator,
    cancelAppointmentValidator, completeAppointmentValidator,
    payBalanceValidator, rebookAppointmentValidator, fileDisputeValidator, submitReviewValidator,
    joinCallValidator, deleteReviewValidator, createDepartmentManualTransactionValidator
} from "../validators/booking.validator.js";

const router = express.Router();

router.use(protectRoute);

router.post("/book",     bookAppointmentValidator,    validate, bookAppointment);
router.post("/pay-deposit", payDepositValidator,      validate, payDeposit);
router.post("/accept",   acceptAppointmentValidator,  validate, acceptAppointment);
router.post("/reject",   rejectAppointmentValidator,  validate, rejectAppointment);
router.post("/cancel",   cancelAppointmentValidator,  validate, cancelAppointment);
router.post("/complete", completeAppointmentValidator, validate, completeAppointment);
router.post("/pay-balance", payBalanceValidator,      validate, payBalance);
router.post("/rebook", rebookAppointmentValidator, validate, rebookAppointment);
router.post("/dispute",  fileDisputeValidator,        validate, fileDispute);
router.post("/review",   submitReviewValidator,       validate, submitReview);
router.post("/join-call", joinCallValidator, validate, joinCall);
router.get("/my-appointments",        getMyAppointments);
router.get("/transaction-history",    getTransactionHistory);
router.get("/reviews/:providerId",    getProviderReviews);
router.delete("/review/:appointmentId", deleteReviewValidator, validate, deleteReview);

export default router;

router.get('/department-income', getDepartmentIncome);
router.post('/department-manual-transaction', createDepartmentManualTransactionValidator, validate, createDepartmentManualTransaction);
