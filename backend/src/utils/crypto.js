import crypto from "crypto";

const IV_LENGTH = 16;


function getKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length !== 32) throw new Error("ENCRYPTION_KEY must be set and exactly 32 characters");
    return Buffer.from(key);
}

export function encrypt(text) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", getKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString("hex") + ":" + encrypted.toString("hex");
}

export function decrypt(text) {
    const [ivHex, encryptedText] = text.split(":");
    const iv = Buffer.from(ivHex, "hex");
    const encrypted = Buffer.from(encryptedText, "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", getKey(), iv);
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}