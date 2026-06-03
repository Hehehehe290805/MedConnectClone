import express from "express";
import {
    setAvailability, getAvailability,
    getDoctorCalendar, getDoctorPublicCalendar, getInstitutePublicCalendar,
} from "../controllers/schedule.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { setAvailabilityValidator } from "../validators/schedule.validator.js";

const router = express.Router();

router.post("/availability", protectRoute, setAvailabilityValidator, validate, setAvailability);
router.get("/get-availability", protectRoute, getAvailability);
router.get("/doctor-calendar", protectRoute, getDoctorCalendar);
router.get("/public-doctor-calendar", protectRoute, getDoctorPublicCalendar);
router.get("/public-institute-calendar", protectRoute, getInstitutePublicCalendar);

export default router;
