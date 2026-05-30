import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Admin from "../models/Admin.js";
import EmailRegistry from "../models/EmailRegistry.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { createAndSendCode, verifyCode } from "../services/verification.js";
import VerificationCode from "../models/VerificationCode.js";

const cookieOptions = {
  maxAge: 7 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
};

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: "7d" });

export const signup = asyncHandler(async (req, res) => {
  const { email, password, adminCode } = req.body;

  const existingEmail = await EmailRegistry.findOne({ email });
  if (existingEmail) return sendError(res, 400, "Email already registered.");

    await createAndSendCode(email, "signup", { email, password, adminCode: adminCode ?? null });

    return sendSuccess(res, 200, "Verification code sent to your email.");
});

// Step 2 — verify code, create User/Admin  EmailRegistry
export const verifySignup = asyncHandler(async (req, res) => {
  const { email, code } = req.body;
  
  const record = await verifyCode(email, "signup", code);
  const { password, adminCode } = record.payload;
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
      let registrant;
      let registrantModel;
  
      if (adminCode) {
          const admin = new Admin({ email, password, adminCode, status: "notOnBoarded" });
          await admin.save({ session });
          registrant = admin;
          registrantModel = "Admin";
        } else {
          const user = new User({ email, password, role: "user" });
          await user.save({ session });
          registrant = user;
          registrantModel = "User";
        }
  
        await EmailRegistry.create([{
          email,
          registrant: registrant._id,
          registrantModel,
        }], { session });

        await session.commitTransaction();

        const token = generateToken(registrant._id);
        res.cookie("jwt", token, cookieOptions);

        return sendSuccess(res, 201, "Account created successfully.", { userId: registrant._id });
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
});

export const resendSignupCode = asyncHandler(async (req, res) => {
  const { email } = req.body;
  
  // check if a code was recently sent — rate limit 1 per minute
  const existing = await VerificationCode.findOne({ email, type: "signup" });
  if (existing) {
    const secondsSinceCreated = (Date.now() - new Date(existing.createdAt).getTime()) / 1000;
    if (secondsSinceCreated < 60) {
        const waitSeconds = Math.ceil(60 - secondsSinceCreated);
        return sendError(res, 429, `Please wait ${waitSeconds} seconds before requesting a new code.`);
      }
  }
  
  // check email exists in registry — can't resend for non-existent signup attempt
  // note: for signup, no user exists yet so we just check a pending VerificationCode exists
  if (!existing) return sendError(res, 400, "No pending verification found for this email.");

  await createAndSendCode(email, "signup", existing.payload);
  
  return sendSuccess(res, 200, "Verification code resent.");
  });

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });
  if (!user) return sendError(res, 404, "User not found.");

  // restore account if it was pending deletion
  if (user.pendingDeletion) {
    await User.findByIdAndUpdate(user._id, {
      pendingDeletion: false,
      deletionRequestedAt: null,
    });
  }

  const isPasswordValid = await user.matchPassword(password);
  if (!isPasswordValid) return sendError(res, 401, "Invalid credentials.");

  const token = generateToken(user._id);
  res.cookie("jwt", token, cookieOptions);

  return sendSuccess(res, 200, "Login successful", {
    role: user.role,
    userId: user._id,
  });
});

export const logout = asyncHandler(async (req, res) => {
  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Logout successful");
});

export const getMe = asyncHandler(async (req, res) => {
  const user = req.user;
  const role = user.role;

  // base fields present on all roles
  const base = {
    _id: user._id,
    email: user.email,
    role,
    status: user.status,
    phoneNumber: user.phoneNumber ?? null,
    phoneType: user.phoneType ?? null,
    profilePic: user.profilePic ?? null,
  };

  // role-specific fields
  let roleFields = {};

  if (role === "patient") {
    roleFields = {
      firstName: user.firstName,
      lastName: user.lastName,
      birthDate: user.birthDate,
      sex: user.sex,
      bio: user.bio,
      languages: user.languages,
      address: user.address,
    };
    } else if (role === "doctor") {
      roleFields = {
        firstName: user.firstName,
        lastName: user.lastName,
        birthDate: user.birthDate,
        sex: user.sex,
        bio: user.bio,
        languages: user.languages,
        address: user.address,
        specialty: user.specialty,
        subSpecialty: user.subSpecialty,
        licenseExpiration: user.licenseExpiration,
        licenseImage: user.licenseImage,
        legalIDImage: user.legalIDImage,
      };
    } else if (role === "pharmacy") {
      roleFields = {
        pharmacyName: user.pharmacyName,
        pharmacistFirstName: user.pharmacistFirstName,
        pharmacistLastName: user.pharmacistLastName,
        birthDate: user.birthDate,
        sex: user.sex,
        bio: user.bio,
        address: user.address,
        businessPermit: user.businessPermit,
        fdaLicense: user.fdaLicense,
        pharmacistLicenseExpiration: user.pharmacistLicenseExpiration,
        pharmacistLicenseImage: user.pharmacistLicenseImage,
        pharmacistLegalIDImage: user.pharmacistLegalIDImage,
      };
    } else if (role === "admin") {
      roleFields = {
        firstName: user.firstName,
        lastName: user.lastName,
      };
    }

  return sendSuccess(res, 200, "User fetched successfully", { ...base, ...roleFields });
 });


export const adminLogin = asyncHandler(async (req, res) => {
  const { email, password, adminCode } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) return sendError(res, 404, "Admin account not found.");
  
  // restore account if it was pending deletion
  if (admin.pendingDeletion) {
    await Admin.findByIdAndUpdate(admin._id, {
      pendingDeletion: false,
      deletionRequestedAt: null,
    });
  }

  const isPasswordValid = await admin.matchPassword(password);
  if (!isPasswordValid) return sendError(res, 401, "Invalid credentials.");

  if (admin.adminCode !== adminCode) return sendError(res, 401, "Invalid admin code.");

  const token = generateToken(admin._id);
  res.cookie("jwt", token, cookieOptions);

  return sendSuccess(res, 200, "Admin login successful", {
    role: admin.role,
    userId: admin._id,
  });
});

export const deleteMe = asyncHandler(async (req, res) => {
  const user = req.user;
  
  if (user.role === "admin") {
    return sendError(res, 403, "Admin accounts cannot be self-deleted");
  }

  const Model = user.role === "admin" ? Admin : User;
  await Model.findByIdAndUpdate(user._id, {
    pendingDeletion: true,
    deletionRequestedAt: new Date(),
  });

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Account deletion requested. You have 30 days to log back in to cancel.");
});

// EMAIL CHANGE — Step 1
// verify current credentials, send code to current email
export const requestEmailUpdate = asyncHandler(async (req, res) => {
  const { currentEmail, currentPassword, newEmail, adminCode } = req.body;
  const user = req.user;

  if (user.email !== currentEmail) return sendError(res, 401, "Current email is incorrect.");

  const isPasswordValid = await user.matchPassword(currentPassword);
  if (!isPasswordValid) return sendError(res, 401, "Current password is incorrect.");

  if (user.role === "admin") {
    if (!adminCode) return sendError(res, 400, "Admin code is required.");
    if (user.adminCode !== adminCode) return sendError(res, 401, "Invalid admin code.");
  }

  const existingEmail = await EmailRegistry.findOne({ email: newEmail });
  if (existingEmail) return sendError(res, 400, "Email already in use.");

  // store newEmail in payload so we can use it in step 2
  await createAndSendCode(currentEmail, "update-email-current", { newEmail }, null, user._id);

  return sendSuccess(res, 200, "Verification code sent to your current email.");
});

// EMAIL CHANGE — Step 2
// verify code from current email, send code to new email
export const verifyCurrentEmailUpdate = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = req.user;

  const record = await verifyCode(user.email, "update-email-current", code, user._id);
  const { newEmail } = record.payload;

  // send code to new email, reference previous verification
  await createAndSendCode(newEmail, "update-email-new", { newEmail }, record._id, user._id);

  return sendSuccess(res, 200, "Verification code sent to your new email.");
});

// EMAIL CHANGE — Step 3
// verify code from new email, save change
export const verifyNewEmailUpdate = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = req.user;
  const Model = user.role === "admin" ? Admin : User;

  // find the pending new email record
  const registry = await EmailRegistry.findOne({ email: user.email });
  if (!registry) return sendError(res, 404, "Email registry entry not found.");

  // find the pending new-email record scoped to this user
  const VerificationCode = (await import("../models/VerificationCode.js")).default;
  const pendingRecord = await VerificationCode.findOne({
    type: "update-email-new",
    userId: user._id,
    previousVerificationId: { $exists: true, $ne: null },
  });
  if (!pendingRecord) return sendError(res, 400, "No pending email update found.");
  const { newEmail } = pendingRecord.payload;
  await verifyCode(newEmail, "update-email-new", code, user._id);

  // FLAG: wrap in transaction once replica set is confirmed
  const emailUpdated = await EmailRegistry.findOneAndUpdate(
    { email: user.email },
    { email: newEmail },
    { new: true }
  );
  if (!emailUpdated) return sendError(res, 500, "Failed to update email registry.");
  await Model.findByIdAndUpdate(user._id, { email: newEmail }, { runValidators: true });

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Email updated successfully. Please log in again.");
});

// PASSWORD CHANGE — Step 1
// verify current credentials, send code to current email
export const requestPasswordUpdate = asyncHandler(async (req, res) => {
  const { currentEmail, currentPassword, newPassword, confirmPassword, adminCode } = req.body;
  const user = req.user;

  if (user.email !== currentEmail) return sendError(res, 401, "Current email is incorrect.");

  const isPasswordValid = await user.matchPassword(currentPassword);
  if (!isPasswordValid) return sendError(res, 401, "Current password is incorrect.");

  if (user.role === "admin") {
    if (!adminCode) return sendError(res, 400, "Admin code is required.");
    if (user.adminCode !== adminCode) return sendError(res, 401, "Invalid admin code.");
  }

  if (newPassword !== confirmPassword) return sendError(res, 400, "Passwords do not match.");

  // store newPassword in payload — it will be hashed by pre-save hook on verify
  await createAndSendCode(user.email, "update-password", { newPassword }, null, user._id);

  return sendSuccess(res, 200, "Verification code sent to your email.");
});

// PASSWORD CHANGE — Step 2
// verify code, save new password
export const verifyPasswordUpdate = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = req.user;
  const Model = user.role === "admin" ? Admin : User;

  const record = await verifyCode(user.email, "update-password", code, user._id);
  const { newPassword } = record.payload;

  await Model.findByIdAndUpdate(user._id, { password: newPassword }, { runValidators: true });

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Password updated successfully. Please log in again.");
});

// role-aware field allowlists — only these fields are accepted per role
const profileFieldsByRole = {
  patient: [
    "firstName", "lastName", "birthDate", "sex", "bio",
    "profilePic", "languages", "address", "phoneNumber", "phoneType",
  ],
  doctor: [
    "firstName", "lastName", "birthDate", "sex", "bio",
    "profilePic", "languages", "address", "phoneNumber", "phoneType",
    "specialty", "subSpecialty",
  ],
  pharmacy: [
    "bio", "profilePic", "address", "phoneNumber", "phoneType",
    "pharmacyName", "pharmacistFirstName", "pharmacistLastName",
    "birthDate", "sex",
  ],
  admin: [
    "firstName", "lastName", "phoneNumber", "phoneType", "profilePic",
  ],
  // base user has no profile fields until onboarded
  user: [],
};

export const updateMeProfile = asyncHandler(async (req, res) => {
  const user = req.user;
  const role = user.role;

  const allowedFields = profileFieldsByRole[role] ?? [];
  if (allowedFields.length === 0) {
    return sendError(res, 400, "Profile cannot be updated before onboarding.");
  }

  // strip any fields not in the allowlist for this role
  const updates = {};
  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    return sendError(res, 400, "No valid fields provided for update.");
  }

  const Model = user.role === "admin" ? Admin : User;
  const updated = await Model.findByIdAndUpdate(
    user._id,
    updates,
    { new: true, runValidators: true }
  ).select("-password");

  return sendSuccess(res, 200, "Profile updated successfully", { user: updated });
});