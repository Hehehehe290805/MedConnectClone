import express from "express";
import {
    bookAppointment, payDeposit, acceptAppointment, rejectAppointment,
    cancelAppointment, completeAppointment, payBalance,
    fileDispute, submitReview, joinCall, getMyAppointments, getTransactionHistory,
    getProviderReviews, deleteReview,
} from "../controllers/booking.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    bookAppointmentValidator, payDepositValidator,
    acceptAppointmentValidator, rejectAppointmentValidator,
    cancelAppointmentValidator, completeAppointmentValidator,
    payBalanceValidator, fileDisputeValidator, submitReviewValidator,
    joinCallValidator, deleteReviewValidator,
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
router.post("/dispute",  fileDisputeValidator,        validate, fileDispute);
router.post("/review",   submitReviewValidator,       validate, submitReview);
router.post("/join-call", joinCallValidator, validate, joinCall);
router.get("/my-appointments",        getMyAppointments);
router.get("/transaction-history",    getTransactionHistory);
router.get("/reviews/:providerId",    getProviderReviews);
router.delete("/review/:appointmentId", deleteReviewValidator, validate, deleteReview);

export default router;
