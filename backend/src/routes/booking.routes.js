import express from "express";
import {
    bookAppointment, payDeposit, cancelAppointment, payRemaining, completeAppointment,
    getUserAppointments, submitReview, fileComplaint, markAttendance, checkNoShows,
} from "../controllers/booking.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    bookAppointmentValidator, payDepositValidator, cancelAppointmentValidator,
    submitReviewValidator, payRemainingValidator, fileComplaintValidator, completeAppointmentValidator,
} from "../validators/booking.validator.js";

const router = express.Router();

router.post("/book", protectRoute, bookAppointmentValidator, validate, bookAppointment);
router.post("/pay-deposit", protectRoute, payDepositValidator, validate, payDeposit);
router.post("/cancel", protectRoute, cancelAppointmentValidator, validate, cancelAppointment);
router.get("/user-appointments", protectRoute, getUserAppointments);

router.post("/attend/:id", protectRoute, markAttendance);
router.get("/check-attendance", protectRoute, checkNoShows);
router.post("/complete-appointment", protectRoute, completeAppointmentValidator, validate, completeAppointment);

router.post("/pay-remaining", protectRoute, payRemainingValidator, validate, payRemaining);
router.post("/submit-review", protectRoute, submitReviewValidator, validate, submitReview);
router.post("/report/:id", protectRoute, fileComplaintValidator, validate, fileComplaint);

export default router;