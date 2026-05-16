import express from "express";
import {
    setAvailability, getAvailability,
    getDoctorCalendar, getDoctorPublicCalendar, getInstitutePublicCalendar,
    acceptAppointment, rejectAppointment, markComplete,
    confirmDeposit, confirmFullPayment
} from "../controllers/schedule.controller.js";       
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

// Set or update doctor availability
router.post("/availability", protectRoute, setAvailability);
router.get("/get-availability", protectRoute, getAvailability);

// Get full calendar (available + booked)
router.get("/doctor-calendar", protectRoute, getDoctorCalendar);
router.get("/public-doctor-calendar", protectRoute, getDoctorPublicCalendar);
router.get("/public-institute-calendar", protectRoute, getInstitutePublicCalendar);

// Appointment actions
router.post("/confirm", protectRoute, acceptAppointment); //
router.post("/reject", protectRoute, rejectAppointment) // 
router.post("/mark-complete", protectRoute, markComplete); //

// Payment Confirmation
router.post("/confirm-deposit", protectRoute, confirmDeposit); //
router.post("/confirm-full-payment", protectRoute, confirmFullPayment); //

export default router;