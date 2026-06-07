import express from "express";
import { protectRoute } from "../middleware/auth.middleware.js";
import {
    buildQueue,
    addWalkin,
    getTodayQueue,
    getPatientPosition,
    advanceQueue,
    handleNoShow,
} from "../controllers/queue.controller.js";

const router = express.Router();

router.use(protectRoute);

router.post("/build",    buildQueue);
router.post("/walkin",   addWalkin);
router.get("/today",     getTodayQueue);
router.get("/position",  getPatientPosition);
router.post("/advance",  advanceQueue);
router.post("/no-show",  handleNoShow);

export default router;
