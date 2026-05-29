import bcrypt from "bcryptjs";
import crypto from "crypto";
import VerificationCode from "../models/VerificationCode.js";
import { sendVerificationCode } from "./email.js";

const CODE_EXPIRY_MINUTES = 10;

// generates a 6-digit numeric code, stores hashed, sends plain to email
export async function createAndSendCode(email, type, payload = {}, previousVerificationId = null, userId = null) {
    const plain = crypto.randomInt(100000, 999999).toString();
    const hashed = await bcrypt.hash(plain, 10);

    const expiresAt = new Date(Date.now() + CODE_EXPIRY_MINUTES * 60 * 1000);

    // invalidate any existing unused codes for same email + type
    await VerificationCode.deleteMany({ email, type, userId });

    await VerificationCode.create({
        userId,
        email,
        code: hashed,
        type,
        payload,
        previousVerificationId,
        expiresAt,
    });

    await sendVerificationCode(email, plain);
}

// verifies submitted code against stored hash
// returns the VerificationCode doc on success, throws on failure
export async function verifyCode(email, type, submittedCode, userId = null) {
    const record = await VerificationCode.findOne({ email, type, userId });

    if (!record) {
        const err = new Error("Verification code not found or already used.");
        err.statusCode = 400;
        throw err;
    }

    if (record.expiresAt < new Date()) {
        await VerificationCode.deleteOne({ _id: record._id });
        const err = new Error("Verification code has expired.");
        err.statusCode = 400;
        throw err;
    }

    const isMatch = await bcrypt.compare(submittedCode, record.code);
    if (!isMatch) {
        const err = new Error("Invalid verification code.");
        err.statusCode = 400;
        throw err;
    }

    // consume the code — delete after successful verification
    await VerificationCode.deleteOne({ _id: record._id });

    return record;
}