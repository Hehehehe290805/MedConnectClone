import express from "express";
import {
    getPendingUsers, getAdmins, approveRole, rejectRole, approveRoleWithItems,
    getPendingSuggestions, approveSuggestion, rejectSuggestion, editSuggestion,
    getLicenseNumber,
    getPendingClaims, approveClaim, rejectClaim,
    bulkApprove, bulkReject,
    viewAllComplaints, viewComplaintByComplaintId, resolveComplaint,
    getPendingRenewals, approveRenewal, rejectRenewal,
    getAllUsers, adminForceDeleteUser,
    adminCreateSpecialty, adminCreateSubspecialty, adminCreateDepartmentType, adminCreateService,
    adminDeleteSpecialty, adminDeleteSubspecialty, adminDeleteDepartmentType, adminDeleteService,
    adminEditSpecialty, adminEditSubspecialty, adminEditDepartmentType, adminEditService,
    getSpecialtyTree,
} from "../controllers/admin.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";
import { adminOnly } from "../middleware/adminsOnly.middleware.js";
import { validate } from "../middleware/validate.middleware.js";
import {
    approveRoleValidator, approveSuggestionValidator, approveClaimValidator,
    resolveComplaintValidator, getLicenseValidator,
} from "../validators/admin.validator.js";

const router = express.Router();

router.use(protectRoute, adminOnly);

// users
router.get("/pending-users", getPendingUsers);
router.get("/admins", getAdmins);
router.patch("/approve-role", approveRoleValidator, validate, approveRole);
router.patch("/reject-role", validate, rejectRole);
router.patch("/approve-role-with-items", validate, approveRoleWithItems);

// suggestions
router.get("/pending-suggestions", getPendingSuggestions);
router.patch("/approve", approveSuggestionValidator, validate, approveSuggestion);
router.patch("/reject-suggestion", validate, rejectSuggestion);
router.patch("/edit-suggestion", validate, editSuggestion);

// claims
router.get("/pending-claims", getPendingClaims);
router.patch("/approve-claim", approveClaimValidator, validate, approveClaim);
router.patch("/reject-claim", validate, rejectClaim);

// bulk
router.patch("/bulk-approve", validate, bulkApprove);
router.patch("/bulk-reject", validate, bulkReject);

// complaints
router.get("/complaints", viewAllComplaints);
router.get("/complaints/:id", viewComplaintByComplaintId);
router.patch("/resolve", resolveComplaintValidator, validate, resolveComplaint);

// license lookup
router.get("/license/:userId", getLicenseValidator, validate, getLicenseNumber);

// permit renewals
router.get("/pending-renewals", getPendingRenewals);
router.patch("/approve-renewal", validate, approveRenewal);
router.patch("/reject-renewal", validate, rejectRenewal);

// user management
router.get("/all-users", getAllUsers);
router.delete("/users/:userId", adminForceDeleteUser);

// specialty & service direct management
router.get("/specialty-tree", getSpecialtyTree);
router.post("/specialties", adminCreateSpecialty);
router.patch("/specialties/:id", adminEditSpecialty);
router.delete("/specialties/:id", adminDeleteSpecialty);
router.post("/subspecialties", adminCreateSubspecialty);
router.patch("/subspecialties/:id", adminEditSubspecialty);
router.delete("/subspecialties/:id", adminDeleteSubspecialty);
router.post("/department-types", adminCreateDepartmentType);
router.patch("/department-types/:id", adminEditDepartmentType);
router.delete("/department-types/:id", adminDeleteDepartmentType);
router.post("/services", adminCreateService);
router.patch("/services/:id", adminEditService);
router.delete("/services/:id", adminDeleteService);

export default router;
