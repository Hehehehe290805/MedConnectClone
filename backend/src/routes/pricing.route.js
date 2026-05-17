import express from "express";
import { setOrUpdatePricing, getPricing, getDoctorAppointmentPrice } from "../controllers/pricing.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { setPricingValidator } from "../validators/pricing.validator.js";

const router = express.Router();

router.post("/set-pricing", protectRoute, setPricingValidator, validate, setOrUpdatePricing);
router.get("/pricing", protectRoute, getPricing);
router.get("/appointment-price", protectRoute, getDoctorAppointmentPrice);

export default router;