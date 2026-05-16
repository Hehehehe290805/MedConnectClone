import express from "express";
import {
    getSpecialties, getSubspecialtiesBySpecialty, getServices, getDoctorSpecialties, getSpecialtyBySubspecialty,
    suggest, claim, autoClaimAppointmentService
} from "../controllers/specialtyAndService.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.get("/specialties", protectRoute, getSpecialties);
router.get("/subspecialty-root/:subspecialtyId", protectRoute, getSpecialtyBySubspecialty);
router.get("/subspecialties/:specialtyId", protectRoute, getSubspecialtiesBySpecialty);
router.get("/services", protectRoute, getServices);
router.get("/doctor-specialties", protectRoute, getDoctorSpecialties)

router.post("/suggest", protectRoute, suggest);
router.post("/claim", protectRoute, claim);
router.post("/auto-claim-appointment", protectRoute, autoClaimAppointmentService);

export default router;