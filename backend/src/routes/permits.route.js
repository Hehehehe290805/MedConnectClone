import express from "express";
import {
    requestDoctorLicense, requestPharmacistLicense,
    requestBusinessPermit, requestFdaLicense,
    verifyPermitRenewal,
    } from "../controllers/permits.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    updateDoctorLicenseValidator, updatePharmacistLicenseValidator,
    updateBusinessPermitValidator, updateFdaLicenseValidator,
    } from "../validators/permits.validator.js";

const router = express.Router();

router.post("/doctor/license/request", protectRoute, updateDoctorLicenseValidator, validate, requestDoctorLicense);
router.post("/pharmacy/pharmacist-license/request", protectRoute, updatePharmacistLicenseValidator, validate, requestPharmacistLicense);
router.post("/pharmacy/business-permit/request", protectRoute, updateBusinessPermitValidator, validate, requestBusinessPermit);
router.post("/pharmacy/fda-license/request", protectRoute, updateFdaLicenseValidator, validate, requestFdaLicense);
router.post("/verify", protectRoute, validate, verifyPermitRenewal);

export default router;