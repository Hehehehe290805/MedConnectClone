import express from "express";
import { getMockPaymentInfo } from "../controllers/gcash.controller.js";

const router = express.Router();

// Public — the frontend needs the platform GCash number before the user logs in
router.get("/info", getMockPaymentInfo);

export default router;
