import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { encrypt, decrypt } from "../utils/crypto.js";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;

const imageSchema = new mongoose.Schema({
  url: { type: String },
  key: { type: String },
}, { _id: false });

const addressSchema = new mongoose.Schema({
  buildingNumber: { type: String },
  street: { type: String },
  barangay: { type: String },
  city: { type: String },
  province: { type: String },
  postalCode: { type: String },
  coordinates: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point",
    },
    coordinates: {
      type: [Number],
    },
  },
}, { _id: false });

const baseUserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    validate: {
      validator: function (v) {
        return this.isModified("password") ? passwordRegex.test(v) : true;
      },
      message: "Password must be at least 8 characters and include 1 uppercase, 1 lowercase, 1 number, and 1 symbol (@$!%*?&)",
    },
  },
  role: {
    type: String,
    enum: ["user", "patient", "doctor", "pharmacy", "institute", "department", "admin"],
    default: "user",
  },
  status: {
    type: String,
    enum: ["notOnBoarded", "pending", "onBoarded",
      "needsRenewal", "pendingRenewal", "pendingRenewalExpired", "suspended", "rejected",
    ],
    default: "notOnBoarded",
  },
  phoneNumber: { type: String },
  phoneType: {
    type: String,
    enum: ["mobile", "telephone"],
    default: "mobile",
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Admin",
  },
  pendingDeletion: { type: Boolean, default: false },
  deletionRequestedAt: { type: Date, default: null },
  resetPasswordCode: { type: String, default: null },
  resetPasswordCodeExpiry: { type: Date, default: null },
  twoFactorEnabled: { type: Boolean, default: false },
  emailNotificationsEnabled: { type: Boolean, default: true },
  loginAttempts: { type: Number, default: 0 },
  loginLockedAt: { type: Date, default: null },
  birthDate: {
    type: Date,
    validate: {
      validator: function (v) {
        if (!v) return true;
        const now = new Date();
        const minAge = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
        const maxAge = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
        return v <= minAge && v >= maxAge;
      },
      message: "User must be between 18 and 120 years old",
    },
  },
}, { timestamps: true, discriminatorKey: "__t" });

baseUserSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }
  next();
});

baseUserSchema.methods.matchPassword = async function (enteredPassword) {
  return bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model("User", baseUserSchema);
export default User;


// --- PATIENT ---
const patientSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  sex: { type: String, enum: ["male", "female"], required: true },
  bio: { type: String },
  profilePic: { type: imageSchema },
  languages: [{ type: String }],
  address: { type: addressSchema, default: () => ({}) },
});

export const Patient = User.discriminator("Patient", patientSchema);


// --- DOCTOR ---
const doctorSchema = new mongoose.Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  sex: { type: String, enum: ["male", "female"], required: true },
  bio: { type: String },
  profilePic: { type: imageSchema },
  languages: [{ type: String }],
  address: { type: addressSchema, default: () => ({}) },
  licenseNumber: {
    type: String,
    required: true,
    set: (v) => v && !v.includes(":") ? encrypt(v) : v,
  },
  licenseExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "License expiration date must be in the future",
    },
  },
  licenseImage: { type: imageSchema, default: () => ({}) },
  legalIDImage: { type: imageSchema, default: () => ({}), immutable: true },
  specialty: [{ type: mongoose.Schema.Types.ObjectId, ref: "Specialty" }],
  subSpecialty: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subspecialty" }],
});

doctorSchema.methods.getLicenseNumber = function () {
  return this.licenseNumber ? decrypt(this.licenseNumber) : null;
};

export const Doctor = User.discriminator("Doctor", doctorSchema);


// --- PHARMACY ---
const pharmacySchema = new mongoose.Schema({
  pharmacyName: { type: String, required: true },
  pharmacistFirstName: { type: String, required: true },
  pharmacistLastName: { type: String, required: true },
  sex: { type: String, enum: ["male", "female"], required: true },
  bio: { type: String },
  profilePic: { type: imageSchema },
  address: { type: addressSchema, default: () => ({}) },
  businessPermit: { type: imageSchema, default: () => ({}) },
  fdaLicense: { type: imageSchema, default: () => ({}) },
  pharmacistLicenseNumber: {
    type: String,
    required: true,
    set: (v) => v && !v.includes(":") ? encrypt(v) : v,
  },
  pharmacistLicenseExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "Pharmacist license expiration must be in the future",
    },
  },
  pharmacistLicenseImage: { type: imageSchema, default: () => ({}) },
  businessPermitExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "Business permit expiration must be in the future",
    },
  },
  fdaLicenseExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "FDA license expiration must be in the future",
    },
  },
  pharmacistLegalIDImage: { type: imageSchema, default: () => ({}), immutable: true },
});

pharmacySchema.methods.getPharmacistLicenseNumber = function () {
  return this.pharmacistLicenseNumber ? decrypt(this.pharmacistLicenseNumber) : null;
};

export const Pharmacy = User.discriminator("Pharmacy", pharmacySchema);


// --- INSTITUTE ---
const instituteSchema = new mongoose.Schema({
  instituteName: { type: String, required: true },
  instituteType: {
    type: String,
    enum: ["clinic", "hospital"],
    required: true,
  },
  bio: { type: String },
  profilePic: { type: imageSchema },
  address: { type: addressSchema, default: () => ({}) },
  // contact person
  contactFirstName: { type: String, required: true },
  contactLastName: { type: String, required: true },
  // permits
  businessPermit: { type: imageSchema, default: () => ({}) },
  businessPermitExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "Business permit expiration must be in the future",
    },
  },
  licensingAgency: { type: String, required: true },
  // hospital-only
  constructionPermit: { type: imageSchema, default: () => ({}) },
  constructionPermitExpiration: { type: Date },
  // department references
  departmentAccounts: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  departments: [{ type: mongoose.Schema.Types.ObjectId, ref: "DepartmentType" }],
});

export const Institute = User.discriminator("Institute", instituteSchema);


// --- DEPARTMENT ---
const departmentSchema = new mongoose.Schema({
  rootInstitute: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  departmentType: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DepartmentType",
    required: true,
  },
  // auto-generated department ID e.g. "001MRI"
  departmentId: { type: String, required: true, unique: true },
  technologistFirstName: { type: String, required: true },
  technologistLastName: { type: String, required: true },
  sex: { type: String, enum: ["male", "female"], required: true },
  bio: { type: String },
  profilePic: { type: imageSchema },
  address: { type: addressSchema, default: () => ({}) },
  technologistLicenseNumber: {
    type: String,
    required: true,
    set: (v) => v && !v.includes(":") ? encrypt(v) : v,
  },
  technologistLicenseExpiration: {
    type: Date,
    required: true,
    validate: {
      validator: (v) => v > new Date(),
      message: "Technologist license expiration must be in the future",
    },
  },
  technologistLicenseImage: { type: imageSchema, default: () => ({}) },
  technologistLegalIDImage: { type: imageSchema, default: () => ({}), immutable: true },
});

departmentSchema.methods.getTechnologistLicenseNumber = function () {
  return this.technologistLicenseNumber ? decrypt(this.technologistLicenseNumber) : null;
};

export const Department = User.discriminator("Department", departmentSchema);