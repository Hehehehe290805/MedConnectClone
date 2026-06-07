import express from "express";
import { searchDoctors, searchInstitutes, searchDepartments } from "../controllers/search.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.use(protectRoute);

router.get("/doctors",    searchDoctors);
router.get("/institutes", searchInstitutes);
router.get("/departments", searchDepartments);

export default router;
