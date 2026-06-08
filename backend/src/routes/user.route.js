import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import { getDoctors, getInstitutes, getUserById, blockPatient, unblockPatient, getBlockedPatients } from "../controllers/user.controller.js";

const router = express.Router();

router.use(protectRoute);

router.post("/block",      blockPatient);
router.post("/unblock",    unblockPatient);
router.get("/blocked",     getBlockedPatients);
router.get("/doctors",     getDoctors);
router.get("/institutes",  getInstitutes);
router.get("/:userId",     getUserById);

export default router;
