import mongoose from "mongoose";
import DoctorSpecialty from "../models/DoctorSpecialty.js";
import InstituteDepartmentService from "../models/InstituteDepartmentService.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import Service from "../models/Service.js";
import DepartmentType from "../models/DepartmentType.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import Report from "../models/Report.js";
import Appointment from "../models/Appointment.js";
import PermitRenewal from "../models/PermitRenewal.js";
import Notification from "../models/Notification.js";
import Schedule from "../models/Schedule.js";
import Pricing from "../models/Pricing.js";
import EmailRegistry from "../models/EmailRegistry.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { encrypt } from "../utils/crypto.js";
import { notify, notifyAllAdmins } from "../services/notification.service.js";
import { deleteFromS3 } from "../services/s3.js";

// ── USER REVIEW ────────────────────────────────────────────────────────────

export const getPendingUsers = asyncHandler(async (req, res) => {
  // Admin accounts live in their own collection, not the User discriminator table,
  // so we must query both to surface all pending signups on the dashboard.
  const [pendingUsers, pendingAdmins] = await Promise.all([
    User.find({ status: "pending" }).select("-password").populate("specialty", "name").populate("subSpecialty", "name").lean(),
    Admin.find({ status: "pending" }).select("-password -adminCode").lean(),
  ]);
  const allPending = [
    ...pendingUsers,
    ...pendingAdmins.map(a => ({ ...a, role: "admin" })),
  ];

  const formattedUsers = allPending.map((user) => {
    const base = { _id: user._id, role: user.role, email: user.email, createdAt: user.createdAt };

    switch (user.role) {
      case "doctor":
        return {
          ...base,
          firstName: user.firstName, lastName: user.lastName,
          birthDate: user.birthDate,
          sex: user.sex,
          address: user.address,
          licenseExpiration: user.licenseExpiration,
          licenseImage: user.licenseImage,   // { key } — admin fetches signed URL
          legalIDImage: user.legalIDImage,   // { key }
          languages: user.languages,
          bio: user.bio,
          specialty: user.specialty || [],
          subSpecialty: user.subSpecialty || [],
        };
      case "pharmacy":
        return {
          ...base,
          pharmacyName: user.pharmacyName,
          pharmacistFirstName: user.pharmacistFirstName, pharmacistLastName: user.pharmacistLastName,
          birthDate: user.birthDate,
          sex: user.sex,
          address: user.address,
          pharmacistLicenseExpiration: user.pharmacistLicenseExpiration,
          pharmacistLicenseImage: user.pharmacistLicenseImage,
          pharmacistLegalIDImage: user.pharmacistLegalIDImage,
          businessPermit: user.businessPermit,
          businessPermitExpiration: user.businessPermitExpiration,
          fdaLicense: user.fdaLicense,
          fdaLicenseExpiration: user.fdaLicenseExpiration,
        };
      case "institute":
        return {
          ...base,
          instituteName: user.instituteName,
          instituteType: user.instituteType,
          contactFirstName: user.contactFirstName, contactLastName: user.contactLastName,
          licensingAgency: user.licensingAgency,
          address: user.address,
          businessPermit: user.businessPermit,
          businessPermitExpiration: user.businessPermitExpiration,
          constructionPermit: user.constructionPermit,
          constructionPermitExpiration: user.constructionPermitExpiration,
        };
      case "admin":
        return {
          ...base,
          firstName: user.firstName, lastName: user.lastName,
          birthDate: user.birthDate,
        };
      default:
        return { ...base, firstName: user.firstName, lastName: user.lastName };
    }
  });

  return sendSuccess(res, 200, "Pending users fetched", { users: formattedUsers });
});

export const getAdmins = asyncHandler(async (req, res) => {
  const admins = await User.find({ status: "onBoarded", role: "admin" }).select("firstName lastName birthDate");
  const formatted = admins.map((user) => ({
    _id: user._id,
    firstName: user.firstName,
    lastName: user.lastName,
    birthDate: user.birthDate ? user.birthDate.toISOString().split("T")[0] : null,
  }));
  return sendSuccess(res, 200, "Admins fetched", { users: formatted });
});

export const approveRole = asyncHandler(async (req, res) => {
  const { userId } = req.body;

  // Check both User and Admin collections
  let account = await User.findById(userId).select("-password");
  let Model = User;
  let isAdmin = false;

  if (!account) {
    account = await Admin.findById(userId).select("-password -adminCode");
    Model = Admin;
    isAdmin = true;
  }

  if (!account) return sendError(res, 404, "User not found");
  if (account.status !== "pending") return sendError(res, 400, `User is not pending approval (current status: ${account.status})`);

  const updatedAccount = await Model.findByIdAndUpdate(
    userId,
    { status: "onBoarded", approvedBy: req.user._id },
    { new: true }
  ).select(isAdmin ? "-password -adminCode" : "-password");

  // For doctors: promote their onboarding specialty[] / subSpecialty[] into verified DoctorSpecialty records
  // so they immediately appear on the doctor's SpecialtyPage without requiring re-claiming.
  if (!isAdmin && account.role === "doctor") {
    const specialtyIds    = (account.specialty    ?? []).map(id => id.toString());
    const subspecialtyIds = (account.subSpecialty ?? []).map(id => id.toString());

    for (const specId of specialtyIds) {
      const exists = await DoctorSpecialty.findOne({ doctorId: userId, specialtyId: specId });
      if (!exists) {
        await DoctorSpecialty.create({
          doctorId: userId, specialtyId: specId,
          claimType: "specialty", status: "verified", approvedBy: req.user._id,
        });
      } else if (exists.status !== "verified") {
        exists.status = "verified"; exists.approvedBy = req.user._id; await exists.save();
      }
    }
    for (const subId of subspecialtyIds) {
      const exists = await DoctorSpecialty.findOne({ doctorId: userId, subspecialtyId: subId });
      if (!exists) {
        await DoctorSpecialty.create({
          doctorId: userId, subspecialtyId: subId,
          claimType: "subspecialty", status: "verified", approvedBy: req.user._id,
        });
      } else if (exists.status !== "verified") {
        exists.status = "verified"; exists.approvedBy = req.user._id; await exists.save();
      }
    }
  }

  const displayName = `${updatedAccount.firstName || ""} ${updatedAccount.lastName || ""}`.trim();

  notify(userId, "role_approved", "Account Approved",
    "Your account has been approved. You can now access all MedConnect features.");

  return sendSuccess(res, 200, `${displayName} has been approved`, { user: updatedAccount });
});

// Specialty and Service Management
export const getPendingSuggestions = asyncHandler(async (req, res) => {
  const [pendingSpecialties, pendingSubspecialties, pendingServices] = await Promise.all([
    Specialty.find({ status: "pending" }).select("_id name suggestedBy").populate("suggestedBy", "firstName lastName email"),
    Subspecialty.find({ status: "pending" }).select("_id name rootSpecialty suggestedBy").populate("suggestedBy", "firstName lastName email"),
    Service.find({ status: "pending" }).select("_id name suggestedBy").populate("suggestedBy", "firstName lastName email"),
  ]);

  const allPending = [
    ...pendingSpecialties.map((item) => ({ _id: item._id, name: item.name, type: "specialty", suggestedBy: item.suggestedBy })),
    ...pendingSubspecialties.map((item) => ({ _id: item._id, name: item.name, rootSpecialty: item.rootSpecialty, type: "subspecialty", suggestedBy: item.suggestedBy })),
    ...pendingServices.map((item) => ({ _id: item._id, name: item.name, type: "service", suggestedBy: item.suggestedBy })),
  ];

  return sendSuccess(res, 200, "Pending suggestions fetched", { pendingSuggestions: allPending });
});

export const approveSuggestion = asyncHandler(async (req, res) => {
  const { id } = req.body;

  let item = await Specialty.findById(id);
  let type = "specialty";
  if (!item) { item = await Subspecialty.findById(id); type = "subspecialty"; }
  if (!item) { item = await Service.findById(id); type = "service"; }
  if (!item) return sendError(res, 404, "Item not found in any category");
  if (item.status === "verified") return sendError(res, 400, `${type} is already verified`);

  item.status = "verified";
  item.approvedBy = req.user._id;
  await item.save();

  if (item.suggestedBy) {
    notify(item.suggestedBy, "suggestion_approved", "Suggestion Approved",
      `Your suggested ${type}: "${item.name}" was approved and is now available on MedConnect.`);
  }

  return sendSuccess(res, 200, `${type.charAt(0).toUpperCase() + type.slice(1)} approved successfully`, { item, type });
});

export const getLicenseNumber = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const user = await User.findById(userId).select("licenseNumber").lean();
  if (!user) return sendError(res, 404, "User not found");
  return sendSuccess(res, 200, "License number fetched", { licenseNumber: user.licenseNumber });
});

export const getPendingClaims = asyncHandler(async (req, res) => {
  const [specialtyClaims, subspecialtyClaims, serviceClaims] = await Promise.all([
    DoctorSpecialty.find({ status: "pending", claimType: "specialty" })
      .populate("doctorId", "firstName lastName email")
      .populate("specialtyId", "name"),
    DoctorSpecialty.find({ status: "pending", claimType: "subspecialty" })
      .populate("doctorId", "firstName lastName email")
      .populate("subspecialtyId", "name"),
    InstituteDepartmentService.find({ status: "pending", claimType: "service" })
      .populate("instituteId", "facilityName email")
      .populate("serviceId", "name"),
  ]);

  return sendSuccess(res, 200, "Pending claims fetched", {
    claims: { specialties: specialtyClaims, subspecialties: subspecialtyClaims, services: serviceClaims },
  });
});

export const approveClaim = asyncHandler(async (req, res) => {
  const { claimId } = req.body;

  let claim = await DoctorSpecialty.findById(claimId);
  if (!claim) claim = await InstituteDepartmentService.findById(claimId);
  if (!claim) return sendError(res, 404, "Claim not found");
  if (claim.status === "verified") return sendError(res, 400, "Claim is already approved");

  const type = claim.claimType;
  claim.status = "verified";
  claim.approvedBy = req.user._id;
  await claim.save();

  // notify the claimant
  try {
    const populateField = type === "specialty" ? "specialtyId"
      : type === "subspecialty" ? "subspecialtyId"
      : "serviceId";
    await claim.populate(populateField);
    const itemName = claim[populateField]?.name || type;
    const recipientId = claim.doctorId || claim.departmentId;
    if (recipientId) {
      notify(recipientId, "claim_approved", "Claim Approved",
        `Your ${type} claim for "${itemName}" was approved.`);
    }
  } catch { /* non-fatal */ }

  return sendSuccess(res, 200, `${type.charAt(0).toUpperCase() + type.slice(1)} claim approved successfully`, { claim, type });
});

// Reports
export const viewAllComplaints = asyncHandler(async (req, res) => {
  const complaints = await Report.find()
    .sort({ createdAt: 1 })
    .populate({ path: "appointmentId", select: "doctorId patientId start end status" })
    .populate({ path: "filedBy", select: "firstName lastName email" })
    .populate({ path: "filedAgainst", select: "firstName lastName email" });

  return sendSuccess(res, 200, "Complaints fetched", { complaints });
});

export const viewComplaintByComplaintId = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const complaint = await Report.findById(id)
    .populate("appointmentId", "doctorId patientId start end status")
    .populate("filedBy", "firstName lastName email")
    .populate("filedAgainst", "firstName lastName email");

  if (!complaint) return sendError(res, 404, "Complaint not found");
  return sendSuccess(res, 200, "Complaint fetched", { complaint });
});

export const resolveComplaint = asyncHandler(async (req, res) => {
  const { complaintId, outcome, adminNote, issueRefund } = req.body;
  const adminId = req.user._id;

  const complaint = await Report.findById(complaintId);
  if (!complaint) return sendError(res, 404, "Complaint not found");

  complaint.status = "resolved";
  complaint.outcome = outcome;
  complaint.adminNote = adminNote;
  complaint.resolvedBy = adminId;
  await complaint.save();

  const appointment = await Appointment.findById(complaint.appointmentId);
  if (appointment && appointment.status === "disputed") {
    appointment.status = "resolved";
    await appointment.save();

    const baseMsg = `Your dispute has been resolved.${adminNote ? ` Admin note: ${adminNote}` : ""}`;
    const providerId = appointment.doctorId || appointment.instituteId;

    // Issue refund to patient when admin decides in patient's favour
    if (issueRefund && outcome === "patient_right" && appointment.patientId) {
      const refundAmount = (appointment.depositPaid ? (appointment.depositAmount || 0) : 0)
        + (appointment.balancePaid ? (appointment.balanceAmount || 0) : 0);
      if (refundAmount > 0) {
        notify(appointment.patientId, "dispute_resolved", "Dispute Resolved — Refund Issued",
          `${baseMsg} A full refund of ₱${refundAmount.toLocaleString("en-PH")} has been approved.`);
      } else {
        notify(appointment.patientId, "dispute_resolved", "Dispute Resolved", baseMsg);
      }
    } else {
      notify(appointment.patientId, "dispute_resolved", "Dispute Resolved", baseMsg);
    }

    if (providerId) notify(providerId, "dispute_resolved", "Dispute Resolved", baseMsg);
  }

  return sendSuccess(res, 200, "Complaint resolved", { complaint });
});

// ── REJECTION ──────────────────────────────────────────────────────────────

export const rejectRole = asyncHandler(async (req, res) => {
  const { userId, rejectionReason } = req.body;

  // Check both User and Admin collections
  let account = await User.findById(userId);
  let Model = User;
  if (!account) {
    account = await Admin.findById(userId);
    Model = Admin;
  }

  if (!account) return sendError(res, 404, "User not found");
  if (account.status !== "pending") return sendError(res, 400, "User is not pending approval");

  await Model.findByIdAndUpdate(userId, { status: "rejected" });

  // clean up their pending suggestions/claims
  await DoctorSpecialty.deleteMany({ doctorId: userId, status: "pending" });
  await InstituteDepartmentService.deleteMany({ instituteId: userId, status: "pending" });

  // Delete S3 files — best-effort, non-fatal
  for (const key of collectUserS3Keys(account)) {
    try { await deleteFromS3(key); } catch { /* non-fatal */ }
  }

  const reasonText = rejectionReason
    ? ` Reason(s): ${rejectionReason}`
    : " Please contact support for more information.";
  notify(userId, "role_rejected", "Account Not Approved",
    `Your account application was not approved.${reasonText}`);

  return sendSuccess(res, 200, "User account rejected");
});

export const rejectSuggestion = asyncHandler(async (req, res) => {
  const { id, reason } = req.body;

  let deleted = false;
  let suggestedById = null;
  let itemName = null;
  let itemType = null;

  let doc = await Specialty.findById(id);
  if (doc) {
    suggestedById = doc.suggestedBy; itemName = doc.name; itemType = "specialty";
    await DoctorSpecialty.deleteMany({ $or: [{ specialtyId: id }, { subspecialtyId: id }] });
    await doc.deleteOne();
    deleted = true;
  }
  if (!deleted) {
    doc = await Subspecialty.findById(id);
    if (doc) {
      suggestedById = doc.suggestedBy; itemName = doc.name; itemType = "subspecialty";
      await DoctorSpecialty.deleteMany({ subspecialtyId: id });
      await doc.deleteOne();
      deleted = true;
    }
  }
  if (!deleted) {
    doc = await Service.findById(id);
    if (doc) {
      suggestedById = doc.suggestedBy; itemName = doc.name; itemType = "service";
      await InstituteDepartmentService.deleteMany({ serviceId: id });
      await doc.deleteOne();
      deleted = true;
    }
  }
  if (!deleted) {
    doc = await DepartmentType.findById(id);
    if (doc) { await doc.deleteOne(); deleted = true; }
  }

  if (!deleted) return sendError(res, 404, "Suggestion not found");

  if (suggestedById && itemName) {
    const reasonText = reason?.trim() ? ` Reason: ${reason.trim()}` : "";
    notify(suggestedById, "suggestion_rejected", "Suggestion Not Approved",
      `Your suggested ${itemType}: "${itemName}" was not approved.${reasonText}`);
  }

  return sendSuccess(res, 200, "Suggestion rejected and removed");
});

export const rejectClaim = asyncHandler(async (req, res) => {
  const { claimId } = req.body;
  let claim = await DoctorSpecialty.findById(claimId);
  if (!claim) claim = await InstituteDepartmentService.findById(claimId);
  if (!claim) return sendError(res, 404, "Claim not found");

  claim.status = "rejected";
  await claim.save();

  try {
    const populateField = claim.claimType === "specialty" ? "specialtyId"
      : claim.claimType === "subspecialty" ? "subspecialtyId"
      : "serviceId";
    await claim.populate(populateField);
    const itemName = claim[populateField]?.name || claim.claimType;
    const recipientId = claim.doctorId || claim.departmentId;
    if (recipientId) {
      notify(recipientId, "claim_rejected", "Claim Not Approved",
        `Your ${claim.claimType} claim for "${itemName}" was not approved.`);
    }
  } catch { /* non-fatal */ }

  return sendSuccess(res, 200, "Claim rejected");
});

export const editSuggestion = asyncHandler(async (req, res) => {
  const { id, name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");

  let item = await Specialty.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!item) item = await Subspecialty.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!item) item = await Service.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!item) item = await DepartmentType.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!item) return sendError(res, 404, "Suggestion not found");

  return sendSuccess(res, 200, "Suggestion name updated", { item });
});

// ── APPROVE ACCOUNT + ITEMS IN ONE TRANSACTION ─────────────────────────────

// Approves a pending user and atomically resolves their attached suggestions.
// Done in a transaction so a partial failure (e.g. suggestion write) rolls back
// the whole operation rather than approving the user with orphaned data.
export const approveRoleWithItems = asyncHandler(async (req, res) => {
  const { userId, approvedSuggestions = [], rejectedSuggestions = [] } = req.body;
  const session = await mongoose.startSession();
  session.startTransaction();

  // Capture suggestion metadata before deletion so notifications can fire
  // after the transaction commits (firing inside the txn risks double-sends on retry).
  const approvedDocs = [];
  const rejectedDocs = [];

  try {
    const user = await User.findById(userId).session(session);
    if (!user) { await session.abortTransaction(); return sendError(res, 404, "User not found"); }
    if (user.status !== "pending") { await session.abortTransaction(); return sendError(res, 400, "User is not pending"); }
    user.status = "onBoarded";
    user.approvedBy = req.user._id;
    await user.save({ session });

    for (const id of approvedSuggestions) {
      let doc = await Specialty.findById(id).session(session)
        || await Subspecialty.findById(id).session(session)
        || await Service.findById(id).session(session)
        || await DepartmentType.findById(id).session(session);
      if (doc) {
        doc.status = "verified"; doc.approvedBy = req.user._id; await doc.save({ session });
        if (doc.suggestedBy) approvedDocs.push({ suggestedBy: doc.suggestedBy, name: doc.name });
      }
    }

    for (const id of rejectedSuggestions) {
      // capture before delete
      const rejDoc = await Specialty.findById(id).session(session)
        || await Subspecialty.findById(id).session(session)
        || await Service.findById(id).session(session);
      if (rejDoc?.suggestedBy) rejectedDocs.push({ suggestedBy: rejDoc.suggestedBy, name: rejDoc.name });

      await Specialty.findByIdAndDelete(id, { session });
      await Subspecialty.findByIdAndDelete(id, { session });
      await Service.findByIdAndDelete(id, { session });
      await DepartmentType.findByIdAndDelete(id, { session });
      await DoctorSpecialty.deleteMany({ $or: [{ specialtyId: id }, { subspecialtyId: id }] }, { session });
      await InstituteDepartmentService.deleteMany({ serviceId: id }, { session });
    }

    await session.commitTransaction();

    // fire notifications after transaction succeeds
    notify(userId, "role_approved", "Account Approved",
      "Your account has been approved. You can now access all MedConnect features.");
    for (const d of approvedDocs) {
      notify(d.suggestedBy, "suggestion_approved", "Suggestion Approved",
        `Your suggested item "${d.name}" was approved and is now available on MedConnect.`);
    }
    for (const d of rejectedDocs) {
      notify(d.suggestedBy, "suggestion_rejected", "Suggestion Not Approved",
        `Your suggested item "${d.name}" was not approved.`);
    }

    return sendSuccess(res, 200, "Account approved with item selections", { user });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

// ── BULK OPERATIONS ────────────────────────────────────────────────────────

export const bulkApprove = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const results = [];
  for (const item of items) {
    try {
      if (item.type === "user") {
        const userDoc = await User.findById(item.id).select("role specialty subSpecialty");
        await User.findByIdAndUpdate(item.id, { status: "onBoarded", approvedBy: req.user._id });
        // Promote doctor onboarding specialties into verified DoctorSpecialty records
        if (userDoc?.role === "doctor") {
          for (const specId of (userDoc.specialty ?? [])) {
            const exists = await DoctorSpecialty.findOne({ doctorId: item.id, specialtyId: specId });
            if (!exists) {
              await DoctorSpecialty.create({ doctorId: item.id, specialtyId: specId, claimType: "specialty", status: "verified", approvedBy: req.user._id });
            } else if (exists.status !== "verified") {
              exists.status = "verified"; exists.approvedBy = req.user._id; await exists.save();
            }
          }
          for (const subId of (userDoc.subSpecialty ?? [])) {
            const exists = await DoctorSpecialty.findOne({ doctorId: item.id, subspecialtyId: subId });
            if (!exists) {
              await DoctorSpecialty.create({ doctorId: item.id, subspecialtyId: subId, claimType: "subspecialty", status: "verified", approvedBy: req.user._id });
            } else if (exists.status !== "verified") {
              exists.status = "verified"; exists.approvedBy = req.user._id; await exists.save();
            }
          }
        }
        notify(item.id, "role_approved", "Account Approved",
          "Your account has been approved. You can now access all MedConnect features.");
      } else if (item.type === "suggestion") {
        const doc = await Specialty.findById(item.id) || await Subspecialty.findById(item.id) || await Service.findById(item.id) || await DepartmentType.findById(item.id);
        if (doc) {
          doc.status = "verified"; doc.approvedBy = req.user._id; await doc.save();
          if (doc.suggestedBy) {
            notify(doc.suggestedBy, "suggestion_approved", "Suggestion Approved",
              `Your suggested item "${doc.name}" was approved.`);
          }
        }
      } else if (item.type === "claim") {
        const claim = await DoctorSpecialty.findById(item.id) || await InstituteDepartmentService.findById(item.id);
        if (claim) {
          claim.status = "verified"; claim.approvedBy = req.user._id; await claim.save();
          const recipientId = claim.doctorId || claim.departmentId;
          if (recipientId) {
            notify(recipientId, "claim_approved", "Claim Approved",
              `Your ${claim.claimType} claim was approved.`);
          }
        }
      }
      results.push({ id: item.id, type: item.type, success: true });
    } catch (err) {
      results.push({ id: item.id, type: item.type, success: false, error: err.message });
    }
  }
  return sendSuccess(res, 200, "Bulk approve processed", { results });
});

export const bulkReject = asyncHandler(async (req, res) => {
  const { items } = req.body;
  const results = [];
  for (const item of items) {
    try {
      if (item.type === "user") {
        const userDoc = await User.findById(item.id).lean();
        await User.findByIdAndUpdate(item.id, { status: "rejected" });
        await DoctorSpecialty.deleteMany({ doctorId: item.id, status: "pending" });
        await InstituteDepartmentService.deleteMany({ instituteId: item.id, status: "pending" });
        if (userDoc) {
          for (const key of collectUserS3Keys(userDoc)) {
            try { await deleteFromS3(key); } catch { /* non-fatal */ }
          }
        }
        notify(item.id, "role_rejected", "Account Not Approved",
          "Your account application was not approved. Please contact support for more information.");
      } else if (item.type === "suggestion") {
        // capture before delete
        const doc = await Specialty.findById(item.id) || await Subspecialty.findById(item.id) || await Service.findById(item.id);
        const suggestedById = doc?.suggestedBy;
        const itemName = doc?.name;

        await Specialty.findByIdAndDelete(item.id);
        await Subspecialty.findByIdAndDelete(item.id);
        await Service.findByIdAndDelete(item.id);
        await DepartmentType.findByIdAndDelete(item.id);

        if (suggestedById && itemName) {
          notify(suggestedById, "suggestion_rejected", "Suggestion Not Approved",
            `Your suggested item "${itemName}" was not approved.`);
        }
      } else if (item.type === "claim") {
        const claim = await DoctorSpecialty.findById(item.id) || await InstituteDepartmentService.findById(item.id);
        if (claim) {
          claim.status = "rejected"; await claim.save();
          const recipientId = claim.doctorId || claim.departmentId;
          if (recipientId) {
            notify(recipientId, "claim_rejected", "Claim Not Approved",
              `Your ${claim.claimType} claim was not approved.`);
          }
        }
      }
      results.push({ id: item.id, type: item.type, success: true });
    } catch (err) {
      results.push({ id: item.id, type: item.type, success: false, error: err.message });
    }
  }
  return sendSuccess(res, 200, "Bulk reject processed", { results });
});

// ── PERMIT RENEWALS ────────────────────────────────────────────────────────

const renewalApplyMap = {
  doctor_license: (r) => ({ licenseImage: r.newImage, licenseExpiration: r.newExpiration, ...(r.newLicenseNumber && { licenseNumber: encrypt(r.newLicenseNumber) }) }),
  pharmacist_license: (r) => ({ pharmacistLicenseImage: r.newImage, pharmacistLicenseExpiration: r.newExpiration, ...(r.newLicenseNumber && { pharmacistLicenseNumber: encrypt(r.newLicenseNumber) }) }),
  pharmacy_business_permit: (r) => ({ businessPermit: r.newImage, businessPermitExpiration: r.newExpiration }),
  pharmacy_fda_license: (r) => ({ fdaLicense: r.newImage, fdaLicenseExpiration: r.newExpiration }),
  technologist_license: (r) => ({ technologistLicenseImage: r.newImage, technologistLicenseExpiration: r.newExpiration, ...(r.newLicenseNumber && { technologistLicenseNumber: encrypt(r.newLicenseNumber) }) }),
  institute_business_permit: (r) => ({ businessPermit: r.newImage, businessPermitExpiration: r.newExpiration }),
  institute_construction_permit: (r) => ({ constructionPermit: r.newImage, constructionPermitExpiration: r.newExpiration }),
};

// Maps renewal type to the User field holding the OLD image being replaced
const renewalOldFieldMap = {
  doctor_license: "licenseImage",
  pharmacist_license: "pharmacistLicenseImage",
  pharmacy_business_permit: "businessPermit",
  pharmacy_fda_license: "fdaLicense",
  technologist_license: "technologistLicenseImage",
  institute_business_permit: "businessPermit",
  institute_construction_permit: "constructionPermit",
};

// Collects all S3 object keys stored on a user document (any role)
function collectUserS3Keys(user) {
  return [
    user.profilePic?.key,
    user.licenseImage?.key,
    user.legalIDImage?.key,
    user.businessPermit?.key,
    user.fdaLicense?.key,
    user.pharmacistLicenseImage?.key,
    user.pharmacistLegalIDImage?.key,
    user.constructionPermit?.key,
    user.technologistLicenseImage?.key,
    user.technologistLegalIDImage?.key,
  ].filter(Boolean);
}

export const getPendingRenewals = asyncHandler(async (req, res) => {
  const renewals = await PermitRenewal.find({ status: "pending" })
    .populate("userId", "firstName lastName pharmacyName instituteName technologistFirstName technologistLastName email role")
    .sort({ createdAt: 1 });
  return sendSuccess(res, 200, "Pending renewals fetched", { renewals });
});

export const approveRenewal = asyncHandler(async (req, res) => {
  const { renewalId } = req.body;
  const renewal = await PermitRenewal.findById(renewalId);
  if (!renewal) return sendError(res, 404, "Renewal not found");
  if (renewal.status !== "pending") return sendError(res, 400, "Renewal is not pending");

  const applyFn = renewalApplyMap[renewal.type];
  if (!applyFn) return sendError(res, 400, "Unknown renewal type");

  // Capture old image key before overwriting so we can clean it up after
  const oldFieldName = renewalOldFieldMap[renewal.type];
  let oldImageKey = null;
  if (oldFieldName) {
    const currentUser = await User.findById(renewal.userId).select(oldFieldName).lean();
    oldImageKey = currentUser?.[oldFieldName]?.key || null;
  }

  const updates = applyFn(renewal);
  await User.findByIdAndUpdate(renewal.userId, updates, { runValidators: true });

  // Delete old file now that new one is live — best-effort, non-fatal
  if (oldImageKey) {
    try { await deleteFromS3(oldImageKey); } catch { /* non-fatal */ }
  }

  renewal.status = "approved";
  renewal.approvedBy = req.user._id;
  await renewal.save();

  notify(renewal.userId, "renewal_approved", "Renewal Approved",
    `Your ${renewal.type.replace(/_/g, " ")} renewal was approved and is now active.`);

  return sendSuccess(res, 200, "Renewal approved and applied", { renewal });
});

export const rejectRenewal = asyncHandler(async (req, res) => {
  const { renewalId, rejectionReason } = req.body;
  const renewal = await PermitRenewal.findById(renewalId);
  if (!renewal) return sendError(res, 404, "Renewal not found");
  if (renewal.status !== "pending") return sendError(res, 400, "Renewal is not pending");

  renewal.status = "rejected";
  renewal.rejectionReason = rejectionReason || "";
  await renewal.save();

  // The pending new image won't be used — delete it from S3, best-effort
  if (renewal.newImage?.key) {
    try { await deleteFromS3(renewal.newImage.key); } catch { /* non-fatal */ }
  }

  notify(renewal.userId, "renewal_rejected", "Renewal Not Approved",
    `Your ${renewal.type.replace(/_/g, " ")} renewal was not approved.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`);

  return sendSuccess(res, 200, "Renewal rejected", { renewal });
});

// ── USER MANAGEMENT ────────────────────────────────────────────────────────

// Returns a flat list of all accounts (User discriminators + Admins) with a
// resolved display name for the management table. Kept lean — no passwords,
// no credential images, no large embedded arrays.
export const getAllUsers = asyncHandler(async (req, res) => {
  const [users, admins] = await Promise.all([
    User.find({}).select(
      "_id email role status createdAt pendingDeletion deletionRequestedAt firstName lastName instituteName pharmacyName facilityName technologistFirstName technologistLastName"
    ).lean(),
    Admin.find({}).select(
      "_id email status createdAt pendingDeletion deletionRequestedAt firstName lastName"
    ).lean(),
  ]);

  const formatUser = (u, overrideRole) => {
    const role = overrideRole || u.role;
    // Resolve the human-readable name based on role — each role stores the name differently
    let displayName;
    if (u.firstName && u.lastName) displayName = `${u.firstName} ${u.lastName}`;
    else if (u.instituteName) displayName = u.instituteName;
    else if (u.pharmacyName) displayName = u.pharmacyName;
    else if (u.facilityName) displayName = u.facilityName;
    else if (u.technologistFirstName) displayName = `${u.technologistFirstName} ${u.technologistLastName || ""}`.trim();
    else displayName = u.email;
    return {
      _id: u._id,
      email: u.email,
      role,
      status: u.status,
      createdAt: u.createdAt,
      pendingDeletion: u.pendingDeletion || false,
      deletionRequestedAt: u.deletionRequestedAt || null,
      displayName,
    };
  };

  const all = [
    ...users.map(u => formatUser(u)),
    ...admins.map(a => formatUser(a, "admin")),
  ];

  return sendSuccess(res, 200, "All users fetched", { users: all });
});

// Immediately hard-deletes a user account (bypasses the 30-day soft-delete window).
// Cleans up S3 files first so the bucket stays tidy even if the DB delete succeeds.
// EmailRegistry is also removed to free the email for re-registration.
export const adminForceDeleteUser = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  // Prevent an admin from nuking their own account through this endpoint
  if (userId === req.user._id.toString()) {
    return sendError(res, 400, "You cannot delete your own account");
  }

  let user = await User.findById(userId).select(
    "_id email profilePic licenseImage legalIDImage businessPermit fdaLicense pharmacistLicenseImage pharmacistLegalIDImage constructionPermit technologistLicenseImage technologistLegalIDImage"
  );
  let isAdmin = false;

  if (!user) {
    user = await Admin.findById(userId).select("_id email profilePic");
    isAdmin = true;
  }

  if (!user) return sendError(res, 404, "User not found");

  // DB record is deleted first. If S3 cleanup fails afterwards the account is still
  // gone and the email is freed — orphaned S3 objects are the lesser evil compared
  // to a broken account (DB record alive but S3/email stripped).
  if (isAdmin) {
    await Admin.findByIdAndDelete(userId);
  } else {
    await User.findByIdAndDelete(userId);
  }
  await EmailRegistry.deleteOne({ email: user.email });

  if (!isAdmin) {
    await Promise.all([
      Schedule.deleteOne({ $or: [{ doctorId: userId }, { instituteId: userId }] }),
      Pricing.deleteMany({ providerId: userId }),
      DoctorSpecialty.deleteMany({ doctorId: userId }),
      InstituteDepartmentService.deleteMany({ departmentId: userId }),
    ]);
  }
  await Notification.deleteMany({ recipient: userId });

  // S3 cleanup is best-effort after the DB delete succeeds
  const s3Keys = collectUserS3Keys(user);

  for (const key of s3Keys) {
    try { await deleteFromS3(key); } catch { /* non-fatal — orphaned S3 objects are acceptable */ }
  }

  return sendSuccess(res, 200, "User deleted successfully");
});

// ── SPECIALTY & SERVICE DIRECT MANAGEMENT ──────────────────────────────────
// Admins bypass the suggestion queue — items are created directly as "verified".
// A second confirmation step is enforced on the frontend before calling these.

export const adminCreateSpecialty = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");

  const exists = await Specialty.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" }, status: "verified" });
  if (exists) return sendError(res, 409, "A verified specialty with this name already exists");

  const specialty = await Specialty.create({ name: name.trim(), status: "verified", approvedBy: req.user._id });
  return sendSuccess(res, 201, "Specialty created", { specialty });
});

export const adminCreateSubspecialty = asyncHandler(async (req, res) => {
  const { name, rootSpecialtyId } = req.body;
  if (!name?.trim() || !rootSpecialtyId) return sendError(res, 400, "name and rootSpecialtyId are required");

  const root = await Specialty.findById(rootSpecialtyId);
  if (!root) return sendError(res, 404, "Parent specialty not found");

  const exists = await Subspecialty.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" }, rootSpecialty: rootSpecialtyId });
  if (exists) return sendError(res, 409, "This subspecialty already exists under the selected specialty");

  const sub = await Subspecialty.create({
    name: name.trim(),
    rootSpecialty: rootSpecialtyId,
    status: "verified",
    approvedBy: req.user._id,
  });
  return sendSuccess(res, 201, "Subspecialty created", { subspecialty: sub });
});

export const adminCreateDepartmentType = asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");

  const exists = await DepartmentType.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" } });
  if (exists) return sendError(res, 409, "A department type with this name already exists");

  const dt = await DepartmentType.create({ name: name.trim() });
  return sendSuccess(res, 201, "Department type created", { departmentType: dt });
});

export const adminCreateService = asyncHandler(async (req, res) => {
  const { name, rootDepartmentTypeId } = req.body;
  if (!name?.trim() || !rootDepartmentTypeId) return sendError(res, 400, "name and rootDepartmentTypeId are required");

  const root = await DepartmentType.findById(rootDepartmentTypeId);
  if (!root) return sendError(res, 404, "Parent department type not found");

  const exists = await Service.findOne({ name: { $regex: `^${name.trim()}$`, $options: "i" }, rootDepartmentType: rootDepartmentTypeId });
  if (exists) return sendError(res, 409, "This service already exists under the selected department type");

  const svc = await Service.create({
    name: name.trim(),
    rootDepartmentType: rootDepartmentTypeId,
    status: "verified",
    approvedBy: req.user._id,
  });
  return sendSuccess(res, 201, "Service created", { service: svc });
});

// Fetch all verified specialties with their subspecialties for the admin management view
export const getSpecialtyTree = asyncHandler(async (req, res) => {
  const [specialties, subspecialties, departmentTypes, services] = await Promise.all([
    Specialty.find({}).sort({ name: 1 }).lean(),
    Subspecialty.find({}).sort({ name: 1 }).lean(),
    DepartmentType.find({}).sort({ name: 1 }).lean(),
    Service.find({}).sort({ name: 1 }).lean(),
  ]);
  return sendSuccess(res, 200, "Specialty tree fetched", { specialties, subspecialties, departmentTypes, services });
});

export const adminDeleteSpecialty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Remove subspecialties and linked claims to keep the DB consistent
  const subs = await Subspecialty.find({ rootSpecialty: id }).select("_id").lean();
  const subIds = subs.map(s => s._id);
  await DoctorSpecialty.deleteMany({ $or: [{ specialtyId: id }, { subspecialtyId: { $in: subIds } }] });
  await Subspecialty.deleteMany({ rootSpecialty: id });
  const deleted = await Specialty.findByIdAndDelete(id);
  if (!deleted) return sendError(res, 404, "Specialty not found");
  return sendSuccess(res, 200, "Specialty deleted");
});

export const adminDeleteSubspecialty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await DoctorSpecialty.deleteMany({ subspecialtyId: id });
  const deleted = await Subspecialty.findByIdAndDelete(id);
  if (!deleted) return sendError(res, 404, "Subspecialty not found");
  return sendSuccess(res, 200, "Subspecialty deleted");
});

export const adminDeleteDepartmentType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const svcs = await Service.find({ rootDepartmentType: id }).select("_id").lean();
  const svcIds = svcs.map(s => s._id);
  await InstituteDepartmentService.deleteMany({ serviceId: { $in: svcIds } });
  await Service.deleteMany({ rootDepartmentType: id });
  const deleted = await DepartmentType.findByIdAndDelete(id);
  if (!deleted) return sendError(res, 404, "Department type not found");
  return sendSuccess(res, 200, "Department type deleted");
});

export const adminDeleteService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  await InstituteDepartmentService.deleteMany({ serviceId: id });
  const deleted = await Service.findByIdAndDelete(id);
  if (!deleted) return sendError(res, 404, "Service not found");
  return sendSuccess(res, 200, "Service deleted");
});

export const adminEditSpecialty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");
  const updated = await Specialty.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!updated) return sendError(res, 404, "Specialty not found");
  return sendSuccess(res, 200, "Specialty updated", { specialty: updated });
});

export const adminEditSubspecialty = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");
  const updated = await Subspecialty.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!updated) return sendError(res, 404, "Subspecialty not found");
  return sendSuccess(res, 200, "Subspecialty updated", { subspecialty: updated });
});

export const adminEditDepartmentType = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");
  const updated = await DepartmentType.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!updated) return sendError(res, 404, "Department type not found");
  return sendSuccess(res, 200, "Department type updated", { departmentType: updated });
});

export const adminEditService = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (!name?.trim()) return sendError(res, 400, "Name is required");
  const updated = await Service.findByIdAndUpdate(id, { name: name.trim() }, { new: true });
  if (!updated) return sendError(res, 404, "Service not found");
  return sendSuccess(res, 200, "Service updated", { service: updated });
});