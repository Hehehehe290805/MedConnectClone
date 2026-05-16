import express from "express";
import {
    searchDoctors, getDoctorDetails
} from "../controllers/search.controller.js";

const router = express.Router();

router.get("/doctors", searchDoctors);
router.get("/doctors/:doctorId", getDoctorDetails);

export default router;