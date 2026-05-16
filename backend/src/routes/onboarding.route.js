import express from "express";
import {
    onboard, onboardAsDoctor, onboardAsInstitute, onboardAsPharmacist, onboardAsAdmin, changeRole
    } from "../controllers/onboarding.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/onboarding", protectRoute, onboard);
router.post("/onboarding/doctor", protectRoute, onboardAsDoctor);
router.post("/onboarding/institute", protectRoute, onboardAsInstitute);
router.post("/onboarding/pharmacist", protectRoute, onboardAsPharmacist);
router.post("/onboarding/admin", protectRoute, onboardAsAdmin);
router.patch("/onboarding/change-role", protectRoute, changeRole);

export default router;