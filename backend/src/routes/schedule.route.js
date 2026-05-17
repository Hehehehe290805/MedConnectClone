import express from "express";
import {
    setAvailability, getAvailability,
    getDoctorCalendar, getDoctorPublicCalendar, getInstitutePublicCalendar,
    acceptAppointment, rejectAppointment, markComplete,
    confirmDeposit, confirmFullPayment,
} from "../controllers/schedule.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    setAvailabilityValidator, acceptAppointmentValidator, rejectAppointmentValidator,
    confirmDepositValidator, markCompleteValidator, confirmFullPaymentValidator,
} from "../validators/schedule.validator.js";

const router = express.Router();

router.post("/availability", protectRoute, setAvailabilityValidator, validate, setAvailability);
router.get("/get-availability", protectRoute, getAvailability);

router.get("/doctor-calendar", protectRoute, getDoctorCalendar);
router.get("/public-doctor-calendar", protectRoute, getDoctorPublicCalendar);
router.get("/public-institute-calendar", protectRoute, getInstitutePublicCalendar);

router.post("/confirm", protectRoute, acceptAppointmentValidator, validate, acceptAppointment);
router.post("/reject", protectRoute, rejectAppointmentValidator, validate, rejectAppointment);
router.post("/mark-complete", protectRoute, markCompleteValidator, validate, markComplete);

router.post("/confirm-deposit", protectRoute, confirmDepositValidator, validate, confirmDeposit);
router.post("/confirm-full-payment", protectRoute, confirmFullPaymentValidator, validate, confirmFullPayment);

export default router;