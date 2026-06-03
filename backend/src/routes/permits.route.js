import express from "express";
import {
    requestDoctorLicense, requestPharmacistLicense,
    requestBusinessPermit, requestFdaLicense,
    verifyPermitRenewal,
    requestRenewal, getMyRenewals,
    } from "../controllers/permits.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    updateDoctorLicenseValidator, updatePharmacistLicenseValidator,
    updateBusinessPermitValidator, updateFdaLicenseValidator,
    } from "../validators/permits.validator.js";

const router = express.Router();

// legacy OTP-based renewal (kept for backwards compat)
router.post("/doctor/license/request", protectRoute, updateDoctorLicenseValidator, validate, requestDoctorLicense);
router.post("/pharmacy/pharmacist-license/request", protectRoute, updatePharmacistLicenseValidator, validate, requestPharmacistLicense);
router.post("/pharmacy/business-permit/request", protectRoute, updateBusinessPermitValidator, validate, requestBusinessPermit);
router.post("/pharmacy/fda-license/request", protectRoute, updateFdaLicenseValidator, validate, requestFdaLicense);
router.post("/verify", protectRoute, validate, verifyPermitRenewal);

// staged renewal (admin-approval flow)
router.post("/renewal/request", protectRoute, requestRenewal);
router.get("/renewal/my-renewals", protectRoute, getMyRenewals);

export default router;