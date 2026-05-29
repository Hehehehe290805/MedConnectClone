import express from "express";
import {
    onboardAsPatient, onboardAsDoctor, 
    onboardAsPharmacy, onboardAsAdmin
} from "../controllers/onboarding.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    onboardPatientValidator, onboardDoctorValidator,
    onboardPharmacyValidator, onboardAdminValidator
} from "../validators/onboarding.validator.js";

const router = express.Router();

router.post("/patient", protectRoute, onboardPatientValidator, validate, onboardAsPatient);
router.post("/doctor", protectRoute, onboardDoctorValidator, validate, onboardAsDoctor);
router.post("/pharmacy", protectRoute, onboardPharmacyValidator, validate, onboardAsPharmacy);
router.post("/admin", protectRoute, onboardAdminValidator, validate, onboardAsAdmin);

export default router;