import express from "express";
import { signup, login, logout, getMe, deleteMe } from "../controllers/auth.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { signupValidator, loginValidator } from "../validators/auth.validator.js";

const router = express.Router();

router.post("/signup", signupValidator, validate, signup);
router.post("/login", loginValidator, validate, login);
router.post("/logout", logout);
router.delete("/delete-me", protectRoute, deleteMe);
router.get("/me", protectRoute, getMe);

export default router;