import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
    },
    lastName: {
      type: String,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
    },
    birthDate: {
      type: Date,
    },
    sex: {
      type: String,
      enum: ["male", "female"],
    },
    bio: {
      type: String,
      default: "",
    },
    profilePic: {
      type: String,
      default: "",
    },
    languages: [
      {
        type: String,
        required: true,
      },
    ],
    location: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["notOnBoarded", "onBoarded", "pending"],
      default: "notOnBoarded",
    },
    friends: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    pro: {
      type: Boolean,
      default: false,
    },
    role: {
      type: String,
      enum: ["user", "doctor", "institute", "pharmacist", "admin"],
      default: "user",
    },
    profession: {
      type: String,
    },
    licenseNumber: {
      type: String,
    },
    facilityName: {
      type: String,
    },
    adminCode: {
      type: String,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    // Payment Integration Fields
    gcash: {
      qrData: String,         // decoded string
      accountName: String,    // manually provided by user
      accountNumber: String,  // manually provided by user
    }

  },
  { timestamps: true }
);

// COMBINED pre-save hook to handle all modifications
userSchema.pre("save", async function (next) {
  // Password hashing
  if (this.isModified("password")) {
    try {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    } catch (error) {
      return next(error);
    }
  }

  // License number encryption
  if (this.isModified("licenseNumber") && this.licenseNumber && !this.licenseNumber.includes(":")) {
    this.licenseNumber = encrypt(this.licenseNumber);
  }

  // GCash account number encryption
  if (this.isModified("gcash.accountNumber") && this.gcash?.accountNumber && !this.gcash.accountNumber.includes(":")) {
    this.gcash.accountNumber = encrypt(this.gcash.accountNumber);
  }

  next();
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  const isPasswordCorrect = await bcrypt.compare(enteredPassword, this.password);
  return isPasswordCorrect;
};

const ENCRYPTION_KEY = process.env.LICENSE_SECRET_KEY; // 32 chars for AES-256
const IV_LENGTH = 16;

function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString("hex") + ":" + encrypted.toString("hex");
}

function decrypt(text) {
  const [ivHex, encryptedText] = text.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const encrypted = Buffer.from(encryptedText, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// method to decrypt when needed
userSchema.methods.getLicenseNumber = function () {
  return this.licenseNumber ? decrypt(this.licenseNumber) : null;
};

userSchema.methods.getGcashAccountNumber = function () {
  return this.gcash.accountNumber ? decrypt(this.gcash.accountNumber) : null;
};

const User = mongoose.model("User", userSchema);

export default User;