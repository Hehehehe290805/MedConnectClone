import Doctor_Specialty from "../models/Doctor_Specialty.js";
import Institute_Service from "../models/Institute_Service.js";
import Specialty from "../models/Specialty.js";
import Subspecialty from "../models/Subspecialty.js";
import Service from "../models/Service.js";
import User from "../models/User.js";
import Report from "../models/Report.js";
import Appointment from "../models/Appointment.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

// User Management
export const getPendingUsers = asyncHandler(async (req, res) => {
  const pendingUsers = await User.find({ status: "pending" }).select(
    "_id firstName lastName profession birthDate licenseNumber facilityName adminCode role location"
  );

  const formattedUsers = pendingUsers.map((user) => {
    const userObj = { _id: user._id, role: user.role, firstName: user.firstName, lastName: user.lastName };
    switch (user.role) {
      case "doctor":
        if (user.profession) userObj.profession = user.profession;
        if (user.birthDate) userObj.birthDate = user.birthDate.toISOString().split("T")[0];
        if (user.licenseNumber) userObj.licenseNumber = user.licenseNumber;
        break;
      case "institute":
        if (user.facilityName) userObj.facilityName = user.facilityName;
        if (user.location) userObj.location = user.location;
        break;
      case "admin":
        if (user.adminCode) userObj.adminCode = user.adminCode;
        if (user.birthDate) userObj.birthDate = user.birthDate.toISOString().split("T")[0];
        break;
    }
    return userObj;
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

  const user = await User.findById(userId).select("-password");
  if (!user) return sendError(res, 404, "User not found");
  if (user.status !== "pending") return sendError(res, 400, `User is not pending approval (current status: ${user.status})`);

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { status: "onBoarded", approvedBy: req.user._id },
    { new: true }
  ).select("-password");

  return sendSuccess(res, 200, `${updatedUser.firstName} ${updatedUser.lastName} has been approved`, { user: updatedUser });
});

// Specialty and Service Management
export const getPendingSuggestions = asyncHandler(async (req, res) => {
  const [pendingSpecialties, pendingSubspecialties, pendingServices] = await Promise.all([
    Specialty.find({ status: "pending" }).select("_id name suggestedBy"),
    Subspecialty.find({ status: "pending" }).select("_id name rootSpecialty suggestedBy"),
    Service.find({ status: "pending" }).select("_id name suggestedBy"),
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
    Doctor_Specialty.find({ status: "pending", claimType: "specialty" })
      .populate("doctorId", "firstName lastName email")
      .populate("specialtyId", "name"),
    Doctor_Specialty.find({ status: "pending", claimType: "subspecialty" })
      .populate("doctorId", "firstName lastName email")
      .populate("subspecialtyId", "name"),
    Institute_Service.find({ status: "pending", claimType: "service" })
      .populate("instituteId", "facilityName email")
      .populate("serviceId", "name"),
  ]);

  return sendSuccess(res, 200, "Pending claims fetched", {
    claims: { specialties: specialtyClaims, subspecialties: subspecialtyClaims, services: serviceClaims },
  });
});

export const approveClaim = asyncHandler(async (req, res) => {
  const { claimId } = req.body;

  let claim = await Doctor_Specialty.findById(claimId);
  if (!claim) claim = await Institute_Service.findById(claimId);
  if (!claim) return sendError(res, 404, "Claim not found");
  if (claim.status === "verified") return sendError(res, 400, "Claim is already approved");

  const type = claim.claimType;
  claim.status = "verified";
  claim.approvedBy = req.user._id;
  await claim.save();

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
  const { complaintId, outcome, adminNote } = req.body;
  const adminId = req.user._id;

  const complaint = await Report.findById(complaintId);
  if (!complaint) return sendError(res, 404, "Complaint not found");

  complaint.status = "resolved";
  complaint.outcome = outcome;
  complaint.adminNote = adminNote;
  complaint.resolvedBy = adminId;
  await complaint.save();

  const appointment = await Appointment.findById(complaint.appointmentId);
  if (appointment && appointment.status === "freeze") {
    appointment.status = "booked";
    await appointment.save();
  }

  return sendSuccess(res, 200, "Complaint resolved", { complaint });
});