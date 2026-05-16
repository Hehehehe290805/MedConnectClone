import express from "express";
import { 
    bookAppointment, payDeposit, cancelAppointment, payRemaining, completeAppointment,
    getUserAppointments, submitReview, fileComplaint,
    markAttendance, checkNoShows
} from "../controllers/booking.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Set Appointment
router.post("/book", protectRoute, bookAppointment); //
router.post("/pay-deposit", protectRoute, payDeposit); //
router.post("/cancel", protectRoute, cancelAppointment); // 
router.get("/user-appointments", protectRoute, getUserAppointments);

// During Appointment
router.post("/attend/:id", protectRoute, markAttendance); // 
router.get("/check-attendance", protectRoute, checkNoShows); // 
router.post("/complete-appointment", protectRoute, completeAppointment);

// After Appointment
router.post("/pay-remaining", protectRoute, payRemaining); //
router.post("/submit-review", protectRoute, submitReview); //
router.post("/report/:id", protectRoute, fileComplaint); // 

export default router;  