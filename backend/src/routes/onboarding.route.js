import express from "express";
import {
    onboardAsPatient, onboardAsDoctor,
    onboardAsPharmacy, onboardAsInstitute, onboardAsAdmin, onboardAsDepartment, deleteDepartmentAccount
} from "../controllers/onboarding.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    onboardPatientValidator, onboardDoctorValidator,
    onboardPharmacyValidator, onboardInstituteValidator, onboardAdminValidator,
    onboardDepartmentValidator,
} from "../validators/onboarding.validator.js";
import { convertToAdmin } from "../controllers/adminConvert.controller.js";

const router = express.Router();

router.post("/patient", protectRoute, onboardPatientValidator, validate, onboardAsPatient);
router.post("/doctor", protectRoute, onboardDoctorValidator, validate, onboardAsDoctor);
router.post("/pharmacy", protectRoute, onboardPharmacyValidator, validate, onboardAsPharmacy);
router.post("/institute", protectRoute, onboardInstituteValidator, validate, onboardAsInstitute);
router.post("/department", protectRoute, onboardDepartmentValidator, validate, onboardAsDepartment);
router.post("/admin", protectRoute, onboardAdminValidator, validate, onboardAsAdmin);
router.post("/admin/convert", protectRoute, convertToAdmin);
router.delete("/department/:deptId", protectRoute, deleteDepartmentAccount);

export default router;