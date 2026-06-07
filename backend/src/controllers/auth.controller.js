import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import crypto from "crypto";
import User from "../models/User.js";
import Appointment from "../models/Appointment.js";
import Admin from "../models/Admin.js";
import EmailRegistry from "../models/EmailRegistry.js";
import PhoneRegistry from "../models/PhoneRegistry.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { createAndSendCode, verifyCode } from "../services/verification.js";
import { sendVerificationCode } from "../services/email.js";
import VerificationCode from "../models/VerificationCode.js";
import { notify } from "../services/notification.service.js";
import { deleteFromS3 } from "../services/s3.js";
import { normalizePhone } from "../utils/validation.js";

const cookieOptions = {
  maxAge: 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
};

const generateToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET_KEY, { expiresIn: "1d" });

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

const MAX_LOGIN_ATTEMPTS = 5;

async function sendBruteForceResetCode(account, Model) {
  const plain = crypto.randomInt(100000, 999999).toString();
  const hashed = await bcrypt.hash(plain, 10);
  await Model.findByIdAndUpdate(account._id, {
    loginAttempts: MAX_LOGIN_ATTEMPTS,
    loginLockedAt: new Date(),
    resetPasswordCode: hashed,
    resetPasswordCodeExpiry: new Date(Date.now() + 15 * 60 * 1000),
  });
  try { await sendVerificationCode(account.email, plain); } catch { /* non-fatal */ }
}

// Regular user login — Admin accounts are in a separate collection and must
// use POST /api/auth/admin-login which requires their admin code.
export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Try email lookup first; fall back to verified phone number
  let user = await User.findOne({ email });
  if (!user) {
    const normalized = normalizePhone(email);
    if (normalized) user = await User.findOne({ phoneNumber: normalized, phoneVerified: true });
  }
  if (!user) return sendError(res, 401, "Invalid credentials.");

  if (user.status === "suspended") {
    return sendError(res, 403, "Your account has been suspended. Please contact support.");
  }
  if (user.status === "rejected") {
    return sendError(res, 403, "Your account application was rejected.");
  }

  if (user.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    return sendError(res, 429, "Account locked due to too many failed attempts. Check your email for a password reset code.");
  }

  if (user.pendingDeletion) {
    await User.findByIdAndUpdate(user._id, { pendingDeletion: false, deletionRequestedAt: null });
  }

  const isPasswordValid = await user.matchPassword(password);
  if (!isPasswordValid) {
    const newAttempts = (user.loginAttempts || 0) + 1;
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await sendBruteForceResetCode(user, User);
      return sendError(res, 429, "Too many failed attempts. A password reset code has been sent to your email.");
    }
    await User.findByIdAndUpdate(user._id, { loginAttempts: newAttempts });
    const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
    return sendError(res, 401, `Invalid email or password. ${remaining} attempt(s) remaining before lockout.`);
  }

  // Successful — clear brute-force counters
  await User.findByIdAndUpdate(user._id, { loginAttempts: 0, loginLockedAt: null });

  if (user.twoFactorEnabled) {
    await createAndSendCode(email, "two_factor", {}, null, user._id);
    return sendSuccess(res, 200, "Verification code sent to your email.", { requires2FA: true });
  }

  const token = generateToken(user._id);
  res.cookie("jwt", token, cookieOptions);
  return sendSuccess(res, 200, "Login successful", { role: user.role, userId: user._id });
});

export const verify2FA = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  let account = await User.findOne({ email }).select("-password");
  let isAdmin = false;
  if (!account) {
    account = await Admin.findOne({ email }).select("-password");
    isAdmin = true;
  }
  if (!account) return sendError(res, 401, "Invalid request.");

  let record;
  try {
    record = await verifyCode(email, "two_factor", code, account._id);
  } catch (err) {
    return sendError(res, 400, err.message);
  }

  // Admin 2FA is only reachable after admin-login already verified the adminCode.
  // The payload flag confirms that path — reject any attempt that bypassed it.
  if (isAdmin && !record.payload?.adminVerified) {
    return sendError(res, 403, "Admin code was not verified. Please use the Admin Login form.");
  }

  const token = generateToken(account._id);
  res.cookie("jwt", token, cookieOptions);
  return sendSuccess(res, 200, "Login successful.", {
    role: account.role,
    userId: account._id,
  });
});

export const toggle2FA = asyncHandler(async (req, res) => {
  const user = req.user;
  const Model = user.role === "admin" ? Admin : User;
  const updated = await Model.findByIdAndUpdate(
    user._id,
    { twoFactorEnabled: !user.twoFactorEnabled },
    { new: true }
  ).select("twoFactorEnabled");
  return sendSuccess(res, 200,
    updated.twoFactorEnabled ? "Two-factor authentication enabled." : "Two-factor authentication disabled.",
    { twoFactorEnabled: updated.twoFactorEnabled }
  );
});

export const toggleEmailNotifications = asyncHandler(async (req, res) => {
  const user = req.user;
  const Model = user.role === "admin" ? Admin : User;
  const updated = await Model.findByIdAndUpdate(
    user._id,
    { emailNotificationsEnabled: !(user.emailNotificationsEnabled ?? true) },
    { new: true }
  ).select("emailNotificationsEnabled");
  return sendSuccess(res, 200,
    updated.emailNotificationsEnabled ? "Email notifications enabled." : "Email notifications disabled.",
    { emailNotificationsEnabled: updated.emailNotificationsEnabled }
  );
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
    phoneVerified: user.phoneVerified ?? false,
    profilePic: user.profilePic ?? null,
    createdAt: user.createdAt,
    twoFactorEnabled: user.twoFactorEnabled ?? false,
    emailNotificationsEnabled: user.emailNotificationsEnabled ?? true,
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
        maxPatientsPerDay: user.maxPatientsPerDay ?? null,
        blockedPatients: user.blockedPatients ?? [],
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
    } else if (role === "institute") {
      // populate departments so names are available in OnboardingDepartment
      const withDepts = await User.findById(user._id).populate("departments", "name status").lean();
      roleFields = {
        instituteName: withDepts?.instituteName ?? user.instituteName,
        instituteType: withDepts?.instituteType ?? user.instituteType,
        bio: withDepts?.bio ?? user.bio,
        address: withDepts?.address ?? null,
        contactFirstName: withDepts?.contactFirstName ?? user.contactFirstName,
        contactLastName: withDepts?.contactLastName ?? user.contactLastName,
        licensingAgency: withDepts?.licensingAgency ?? user.licensingAgency,
        businessPermit: withDepts?.businessPermit ?? user.businessPermit,
        businessPermitExpiration: withDepts?.businessPermitExpiration ?? user.businessPermitExpiration,
        constructionPermit: withDepts?.constructionPermit ?? user.constructionPermit,
        constructionPermitExpiration: withDepts?.constructionPermitExpiration ?? user.constructionPermitExpiration,
        departmentAccounts: withDepts?.departmentAccounts ?? user.departmentAccounts,
        departments: withDepts?.departments || [],
      };
    } else if (role === "department") {
      const withInstitute = await User.findById(user._id).populate("rootInstitute", "instituteName").lean();
      roleFields = {
        technologistFirstName: user.technologistFirstName,
        technologistLastName: user.technologistLastName,
        sex: user.sex,
        birthDate: user.birthDate,
        bio: user.bio,
        address: user.address,
        departmentId: user.departmentId,
        departmentType: user.departmentType,
        rootInstitute: withInstitute?.rootInstitute || user.rootInstitute,
        technologistLicenseExpiration: user.technologistLicenseExpiration,
        technologistLicenseImage: user.technologistLicenseImage,
        technologistLegalIDImage: user.technologistLegalIDImage,
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

  if (admin.loginAttempts >= MAX_LOGIN_ATTEMPTS) {
    return sendError(res, 429, "Account locked due to too many failed attempts. Check your email for a password reset code.");
  }

  const isPasswordValid = await admin.matchPassword(password);
  if (!isPasswordValid) {
    const newAttempts = (admin.loginAttempts || 0) + 1;
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      await sendBruteForceResetCode(admin, Admin);
      return sendError(res, 429, "Too many failed attempts. A password reset code has been sent to your email.");
    }
    await Admin.findByIdAndUpdate(admin._id, { loginAttempts: newAttempts });
    const remaining = MAX_LOGIN_ATTEMPTS - newAttempts;
    return sendError(res, 401, `Invalid credentials. ${remaining} attempt(s) remaining before lockout.`);
  }

  // Successful password — clear counter before admin code check
  await Admin.findByIdAndUpdate(admin._id, { loginAttempts: 0, loginLockedAt: null });

  if (!(await admin.matchAdminCode(adminCode))) return sendError(res, 401, "Invalid admin code.");

  if (admin.twoFactorEnabled) {
    await createAndSendCode(admin.email, "two_factor", { adminVerified: true }, null, admin._id);
    return sendSuccess(res, 200, "Verification code sent to your email.", { requires2FA: true });
  }

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

  // Confirm to the user that deletion is scheduled (non-fatal — user is about to log out)
  notify(user._id, "account_deletion_requested", "Account Deletion Scheduled",
    "Your account has been scheduled for deletion. You have 30 days to log back in and cancel this request."
  );

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Account deletion requested. You have 30 days to log back in to cancel.");
});

// EMAIL CHANGE — Step 1
// verify current credentials, send code to current email
export const requestEmailUpdate = asyncHandler(async (req, res) => {
  const { currentEmail, currentPassword, newEmail, adminCode } = req.body;
  const user = req.user;
  const Model = user.role === "admin" ? Admin : User;

  if (user.email !== currentEmail) return sendError(res, 401, "Current email is incorrect.");

  // protectRoute excludes password — re-fetch the document to enable comparison
  const freshUser = await Model.findById(user._id);
  if (!freshUser) return sendError(res, 404, "User not found.");
  if (!freshUser.password) return sendError(res, 401, "Current password is incorrect.");

  const isPasswordValid = await freshUser.matchPassword(currentPassword);
  if (!isPasswordValid) return sendError(res, 401, "Current password is incorrect.");

  if (user.role === "admin") {
    if (!adminCode) return sendError(res, 400, "Admin code is required.");
    const freshAdmin = await Admin.findById(user._id);
    if (!freshAdmin || !(await freshAdmin.matchAdminCode(adminCode))) return sendError(res, 401, "Invalid admin code.");
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
  const Model = user.role === "admin" ? Admin : User;

  if (user.email !== currentEmail) return sendError(res, 401, "Current email is incorrect.");

  // protectRoute excludes password — re-fetch the document to enable comparison
  const freshUser = await Model.findById(user._id);
  if (!freshUser) return sendError(res, 404, "User not found.");
  if (!freshUser.password) return sendError(res, 401, "Current password is incorrect.");

  const isPasswordValid = await freshUser.matchPassword(currentPassword);
  if (!isPasswordValid) return sendError(res, 401, "Current password is incorrect.");

  if (user.role === "admin") {
    if (!adminCode) return sendError(res, 400, "Admin code is required.");
    const freshAdmin = await Admin.findById(user._id);
    if (!freshAdmin || !(await freshAdmin.matchAdminCode(adminCode))) return sendError(res, 401, "Invalid admin code.");
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

  // Use .save() so the pre-save hook hashes the password before storing
  const doc = await Model.findById(user._id);
  if (!doc) return sendError(res, 404, "User not found.");
  doc.password = newPassword;
  doc.lastPasswordChange = new Date();
  await doc.save();

  res.clearCookie("jwt");
  return sendSuccess(res, 200, "Password updated successfully. Please log in again.");
});

// resolves account + model by email across User and Admin collections
async function findAccountByEmail(email) {
  const user = await User.findOne({ email });
  if (user) return { account: user, Model: User };
  const admin = await Admin.findOne({ email });
  if (admin) return { account: admin, Model: Admin };
  return { account: null, Model: null };
}

// FORGOT PASSWORD — Step 1: send code to email (or phone for users with verified phone)
export const forgotPassword = asyncHandler(async (req, res) => {
  const { email, adminCode } = req.body;

  let { account, Model } = await findAccountByEmail(email);
  // Fall back to verified phone lookup for regular users
  if (!account) {
    const normalized = normalizePhone(email);
    if (normalized) {
      const userByPhone = await User.findOne({ phoneNumber: normalized, phoneVerified: true });
      if (userByPhone) { account = userByPhone; Model = User; }
    }
  }
  if (account) {
    // admin accounts require their admin code before a reset code is sent
    if (Model === Admin) {
      if (!adminCode) return sendError(res, 400, "Admin code is required for admin accounts.");
      if (!(await account.matchAdminCode(adminCode))) return sendError(res, 401, "Invalid admin code.");
    }

    const plain = crypto.randomInt(100000, 999999).toString();
    const hashed = await bcrypt.hash(plain, 10);
    const expiry = new Date(Date.now() + 15 * 60 * 1000);
    await Model.findByIdAndUpdate(account._id, {
      resetPasswordCode: hashed,
      resetPasswordCodeExpiry: expiry,
    });
    try {
      await sendVerificationCode(email, plain);
    } catch {
      // non-fatal
    }
  }

  return sendSuccess(res, 200, "If an account with that email exists, a code has been sent.");
});

// FORGOT PASSWORD — Step 2: verify code (check only, does not consume)
export const verifyForgotPasswordCode = asyncHandler(async (req, res) => {
  const { email, code } = req.body;

  const { account, Model } = await findAccountByEmail(email);
  if (!account || !account.resetPasswordCode) return sendError(res, 400, "Invalid or expired code.");
  if (!account.resetPasswordCodeExpiry || account.resetPasswordCodeExpiry < new Date()) {
    await Model.findByIdAndUpdate(account._id, { resetPasswordCode: null, resetPasswordCodeExpiry: null });
    return sendError(res, 400, "Invalid or expired code.");
  }
  const isMatch = await bcrypt.compare(code, account.resetPasswordCode);
  if (!isMatch) return sendError(res, 400, "Invalid or expired code.");

  return sendSuccess(res, 200, "Code verified.");
});

// FORGOT PASSWORD — Step 3: reset password (verifies + consumes code)
export const resetForgotPassword = asyncHandler(async (req, res) => {
  const { email, code, newPassword } = req.body;

  const { account, Model } = await findAccountByEmail(email);
  if (!account || !account.resetPasswordCode) return sendError(res, 400, "Invalid or expired code.");
  if (!account.resetPasswordCodeExpiry || account.resetPasswordCodeExpiry < new Date()) {
    await Model.findByIdAndUpdate(account._id, { resetPasswordCode: null, resetPasswordCodeExpiry: null });
    return sendError(res, 400, "Invalid or expired code.");
  }
  const isMatch = await bcrypt.compare(code, account.resetPasswordCode);
  if (!isMatch) return sendError(res, 400, "Invalid or expired code.");

  // Enforce once-per-month limit — mirrors the settings flow restriction
  if (account.lastPasswordChange) {
    const daysSince = (Date.now() - new Date(account.lastPasswordChange).getTime()) / (1000 * 60 * 60 * 24);
    if (daysSince < 30) {
      const daysLeft = Math.ceil(30 - daysSince);
      return sendError(res, 429, `Password can only be changed once per month. Try again in ${daysLeft} day(s).`);
    }
  }

  account.password = newPassword;
  account.resetPasswordCode = null;
  account.resetPasswordCodeExpiry = null;
  account.lastPasswordChange = new Date();
  account.loginAttempts = 0;
  account.loginLockedAt = null;
  await account.save();

  return sendSuccess(res, 200, "Password updated successfully.");
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
    "specialty", "subSpecialty", "maxPatientsPerDay",
  ],
  pharmacy: [
    "bio", "profilePic", "address", "phoneNumber", "phoneType",
    "pharmacyName", "pharmacistFirstName", "pharmacistLastName",
    "birthDate", "sex",
  ],
  institute: [
    "bio", "profilePic", "address", "phoneNumber", "phoneType",
    "instituteName", "contactFirstName", "contactLastName",
  ],
  department: [
    "bio", "profilePic", "address", "phoneNumber", "phoneType",
    "technologistFirstName", "technologistLastName",
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

  // Delete old profile pic from S3 when it's being replaced
  if (updates.profilePic && user.profilePic?.key) {
    try { await deleteFromS3(user.profilePic.key); } catch { /* non-fatal */ }
  }

  const Model = user.role === "admin" ? Admin : User;
  const updated = await Model.findByIdAndUpdate(
    user._id,
    updates,
    { new: true, runValidators: true }
  ).select("-password");

  return sendSuccess(res, 200, "Profile updated successfully", { user: updated });
});

// PHONE VERIFICATION — Step 1: generate mock OTP and return it (demo mode)
export const requestPhoneVerify = asyncHandler(async (req, res) => {
  const { phoneNumber, phoneType } = req.body;
  const user = req.user;

  if (user.role === "admin") return sendError(res, 403, "Admins cannot add a phone number via this route.");

  const normalized = normalizePhone(phoneNumber);
  if (!normalized) return sendError(res, 400, "Invalid phone number. Enter a valid Philippine mobile number.");

  // Reject if already claimed by a different account
  const existing = await PhoneRegistry.findOne({ phone: normalized });
  if (existing && existing.registrant.toString() !== user._id.toString()) {
    return sendError(res, 400, "Phone number is already in use by another account.");
  }

  const plain = crypto.randomInt(100000, 999999).toString();
  const hashed = await bcrypt.hash(plain, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await VerificationCode.deleteMany({ email: user.email, type: "phone_verify", userId: user._id });
  await VerificationCode.create({
    userId: user._id,
    email: user.email,
    code: hashed,
    type: "phone_verify",
    payload: { phoneNumber: normalized, phoneType: phoneType || "mobile" },
    expiresAt,
  });

  return sendSuccess(res, 200, "Verification code generated.", { mockCode: plain });
});

// PHONE VERIFICATION — Step 2: confirm OTP, set phoneVerified = true
export const confirmPhoneVerify = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const user = req.user;

  const record = await VerificationCode.findOne({ email: user.email, type: "phone_verify", userId: user._id });
  if (!record) return sendError(res, 400, "No pending phone verification found.");
  if (record.expiresAt < new Date()) {
    await VerificationCode.deleteOne({ _id: record._id });
    return sendError(res, 400, "Verification code expired. Please request a new one.");
  }

  const isMatch = await bcrypt.compare(code, record.code);
  if (!isMatch) return sendError(res, 400, "Incorrect code.");

  const { phoneNumber, phoneType } = record.payload;
  await VerificationCode.deleteOne({ _id: record._id });

  // Upsert PhoneRegistry (idempotent — same user re-verifying is fine)
  await PhoneRegistry.findOneAndUpdate(
    { phone: phoneNumber },
    { $setOnInsert: { phone: phoneNumber, registrant: user._id, registrantModel: "User" } },
    { upsert: true, new: true }
  );

  await User.findByIdAndUpdate(user._id, { phoneNumber, phoneType, phoneVerified: true });

  return sendSuccess(res, 200, "Phone number verified successfully.");
});

// 2FA CHANNEL SWITCH — resend OTP to the alternate channel (email ↔ phone)
// Called during the 2FA login step when the user wants to switch channels.
// Returns mockCode when channel is "phone" (demo SMS).
export const switch2FAChannel = asyncHandler(async (req, res) => {
  const { email, preferPhone } = req.body;

  const user = await User.findOne({ email }).select("email phoneNumber phoneType phoneVerified twoFactorEnabled _id");
  if (!user) return sendError(res, 404, "Account not found.");

  if (preferPhone && (!user.phoneNumber || !user.phoneVerified)) {
    return sendError(res, 400, "No verified phone number on file for this account.");
  }

  const plain = crypto.randomInt(100000, 999999).toString();
  const hashed = await bcrypt.hash(plain, 10);
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  await VerificationCode.deleteMany({ email, type: "two_factor", userId: user._id });
  await VerificationCode.create({
    userId: user._id,
    email,
    code: hashed,
    type: "two_factor",
    payload: { channel: preferPhone ? "phone" : "email" },
    expiresAt,
  });

  if (!preferPhone) {
    try { await sendVerificationCode(email, plain); } catch {}
    return sendSuccess(res, 200, "Code sent to email.", { channel: "email" });
  }

  // Mock SMS — return code directly for demo
  return sendSuccess(res, 200, "Code sent to phone.", { channel: "phone", mockCode: plain });
});