import express from "express";
import {
    getSpecialties,
    getSubspecialtiesBySpecialty,
    getSpecialtyBySubspecialty,
    getDoctorSpecialties,
    suggestSpecialty,
    claimSpecialty,
} from "../controllers/specialty.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { body } from "express-validator";

const router = express.Router();

const suggestValidator = [
    body("name").notEmpty().withMessage("Name is required"),
    body("type").notEmpty().isIn(["specialty", "subspecialty"]).withMessage("Type must be specialty or subspecialty"),
];

const claimValidator = [
    body("targetId").notEmpty().withMessage("Target ID is required"),
    body("type").notEmpty().isIn(["specialty", "subspecialty"]).withMessage("Type must be specialty or subspecialty"),
];

router.get("/", protectRoute, getSpecialties);
router.get("/doctor-specialties", protectRoute, getDoctorSpecialties);
router.get("/subspecialty-root/:subspecialtyId", protectRoute, getSpecialtyBySubspecialty);
router.get("/:specialtyId/subspecialties", protectRoute, getSubspecialtiesBySpecialty);
router.post("/suggest", protectRoute, suggestValidator, validate, suggestSpecialty);
router.post("/claim", protectRoute, claimValidator, validate, claimSpecialty);

export default router;