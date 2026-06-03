import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getDoctors, getInstitutes, getUserById } from "../controllers/user.controller.js";

const router = express.Router();

router.use(protectRoute);

router.get("/doctors",    getDoctors);
router.get("/institutes", getInstitutes);
router.get("/:userId",    getUserById);

export default router;
