import express from "express";
import {
    signup, verifySignup, resendSignupCode,
    login, adminLogin, logout, getMe, deleteMe,
    requestEmailUpdate, verifyCurrentEmailUpdate, verifyNewEmailUpdate,
    requestPasswordUpdate, verifyPasswordUpdate,
    updateMeProfile,
    forgotPassword, verifyForgotPasswordCode, resetForgotPassword, lookupForgotPasswordAccount,
    verify2FA, toggle2FA, toggleEmailNotifications,
    requestPhoneVerify, confirmPhoneVerify, switch2FAChannel, requestPhoneChange,
    requestOnboardingEmailVerify, confirmOnboardingEmailVerify,
    } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    signupValidator, loginValidator, adminLoginValidator,
    updateMeProfileValidator, verify2FAValidator,
    forgotPasswordValidator, verifyForgotPasswordValidator, resetForgotPasswordValidator,
    lookupForgotPasswordValidator,
    } from "../validators/auth.validator.js";

const router = express.Router();

router.post("/signup", signupValidator, validate, signup);
router.post("/signup/verify", validate, verifySignup);
router.post("/signup/resend", resendSignupCode);
router.post("/login", loginValidator, validate, login);
router.post("/admin-login", adminLoginValidator, validate, adminLogin);
router.post("/logout", logout);
router.delete("/delete-me", protectRoute, deleteMe);
router.get("/me", protectRoute, getMe);
router.patch("/update-profile", protectRoute, updateMeProfileValidator, validate, updateMeProfile);
router.post("/update-email/request", protectRoute, validate, requestEmailUpdate);
router.post("/update-email/verify-current", protectRoute, validate, verifyCurrentEmailUpdate);
router.post("/update-email/verify-new", protectRoute, validate, verifyNewEmailUpdate);
router.post("/update-password/request", protectRoute, validate, requestPasswordUpdate);
router.post("/update-password/verify", protectRoute, validate, verifyPasswordUpdate);

router.post("/verify-2fa", verify2FAValidator, validate, verify2FA);
router.patch("/toggle-2fa", protectRoute, toggle2FA);
router.patch("/toggle-email-notifications", protectRoute, toggleEmailNotifications);

router.post("/forgot-password/lookup", lookupForgotPasswordValidator, validate, lookupForgotPasswordAccount);
router.post("/forgot-password", forgotPasswordValidator, validate, forgotPassword);
router.post("/forgot-password/verify", verifyForgotPasswordValidator, validate, verifyForgotPasswordCode);
router.post("/forgot-password/reset", resetForgotPasswordValidator, validate, resetForgotPassword);

router.post("/phone/request-verify", protectRoute, requestPhoneVerify);
router.post("/phone/request-change", protectRoute, requestPhoneChange);
router.post("/onboarding/request-email-verify", protectRoute, requestOnboardingEmailVerify);
router.post("/onboarding/confirm-email-verify", protectRoute, confirmOnboardingEmailVerify);
router.post("/phone/confirm-verify", protectRoute, confirmPhoneVerify);
router.post("/2fa/switch-channel", switch2FAChannel);

export default router;