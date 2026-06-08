import express from "express";
import {
    getDepartmentTypes,
    getServicesByDepartmentType,
    suggestService,
    claimService,
    getMyDepartmentServices,
    deleteServiceClaim,
    getDepartmentPublicServices,
} from "../controllers/service.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import { body } from "express-validator";

const router = express.Router();

const suggestValidator = [
    body("name").notEmpty().withMessage("Name is required"),
    body("type").notEmpty().isIn(["departmentType", "service"]).withMessage("Type must be departmentType or service"),
];

const claimValidator = [
    body("targetId").notEmpty().withMessage("Target ID is required"),
    body("durationMinutes").notEmpty().isNumeric().withMessage("durationMinutes must be a number"),
];

router.get("/", protectRoute, getDepartmentTypes);
router.get("/my-services", protectRoute, getMyDepartmentServices);
router.get("/department/:departmentId", protectRoute, getDepartmentPublicServices);
router.get("/:departmentTypeId/services", protectRoute, getServicesByDepartmentType);
router.post("/suggest", protectRoute, suggestValidator, validate, suggestService);
router.post("/claim", protectRoute, claimValidator, validate, claimService);
router.delete("/claim/:claimId", protectRoute, deleteServiceClaim);

export default router;