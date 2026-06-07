const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'\-]+$/;

export function normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2);
    if (digits.length === 10 && !digits.startsWith("0")) return "0" + digits;
    if (digits.length === 11 && digits.startsWith("0")) return digits;
    return null;
}

export function isValidPersonName(value) {
    return !value || NAME_REGEX.test(value);
}
