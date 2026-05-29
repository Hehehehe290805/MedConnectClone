import express from "express";
import { 
    signup, verifySignup,
    login, adminLogin, logout, getMe, deleteMe, 
    requestEmailUpdate, verifyCurrentEmailUpdate, verifyNewEmailUpdate,
    requestPasswordUpdate, verifyPasswordUpdate,
    updateMeProfile,
    } from "../controllers/auth.controller.js"; import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { 
    signupValidator, loginValidator, adminLoginValidator, 
    updateMeProfileValidator
    } from "../validators/auth.validator.js";
const router = express.Router();

router.post("/signup", signupValidator, validate, signup);
router.post("/signup/verify", validate, verifySignup);
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

export default router;