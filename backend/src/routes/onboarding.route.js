import express from "express";
import {
    onboard, onboardAsDoctor, onboardAsInstitute,
    onboardAsPharmacist, onboardAsAdmin, changeRole,
} from "../controllers/onboarding.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    onboardValidator, onboardDoctorValidator, onboardInstituteValidator,
    onboardPharmacistValidator, onboardAdminValidator, changeRoleValidator,
} from "../validators/onboarding.validator.js";

const router = express.Router();

router.post("/onboarding", protectRoute, onboardValidator, validate, onboard);
router.post("/onboarding/doctor", protectRoute, onboardDoctorValidator, validate, onboardAsDoctor);
router.post("/onboarding/institute", protectRoute, onboardInstituteValidator, validate, onboardAsInstitute);
router.post("/onboarding/pharmacist", protectRoute, onboardPharmacistValidator, validate, onboardAsPharmacist);
router.post("/onboarding/admin", protectRoute, onboardAdminValidator, validate, onboardAsAdmin);
router.patch("/onboarding/change-role", protectRoute, changeRoleValidator, validate, changeRole);

export default router;