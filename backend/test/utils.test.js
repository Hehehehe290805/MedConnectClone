import { strict as assert } from "assert";

// ── normalizePhone ────────────────────────────────────────────────────────────
// Copied inline to avoid pulling in the full onboarding controller (which needs DB)
function normalizePhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    if (digits.startsWith("63") && digits.length === 12) return "0" + digits.slice(2);
    if (digits.length === 10 && !digits.startsWith("0")) return "0" + digits;
    if (digits.length === 11 && digits.startsWith("0")) return digits;
    return digits;
}

describe("normalizePhone()", () => {
    it("returns null for null/empty input", () => {
        assert.equal(normalizePhone(null), null);
        assert.equal(normalizePhone(""), null);
    });

    it("normalizes 10-digit without leading zero", () => {
        assert.equal(normalizePhone("9171234567"), "09171234567");
    });

    it("keeps 11-digit starting with 0 unchanged", () => {
        assert.equal(normalizePhone("09171234567"), "09171234567");
    });

    it("strips country code +63 → 0", () => {
        assert.equal(normalizePhone("+639171234567"), "09171234567");
    });

    it("strips country code 63 (no +) → 0", () => {
        assert.equal(normalizePhone("639171234567"), "09171234567");
    });

    it("strips hyphens and spaces before normalizing", () => {
        assert.equal(normalizePhone("0917-123-4567"), "09171234567");
        assert.equal(normalizePhone("0917 123 4567"), "09171234567");
    });
});

// ── Name validator regex ──────────────────────────────────────────────────────
const NAME_REGEX = /^[a-zA-ZÀ-ÿ\s'\-]+$/;
const isValidPersonName = (v) => !v || NAME_REGEX.test(v);

describe("isValidPersonName()", () => {
    it("accepts plain ASCII names", () => {
        assert.ok(isValidPersonName("Juan"));
        assert.ok(isValidPersonName("Maria Santos"));
    });

    it("accepts names with hyphens and apostrophes", () => {
        assert.ok(isValidPersonName("Mary-Jane"));
        assert.ok(isValidPersonName("O'Brien"));
    });

    it("accepts accented/Filipino names", () => {
        assert.ok(isValidPersonName("Señor"));
        assert.ok(isValidPersonName("Niño"));
        assert.ok(isValidPersonName("José"));
    });

    it("rejects names with digits", () => {
        assert.ok(!isValidPersonName("John2"));
        assert.ok(!isValidPersonName("123"));
    });

    it("rejects names with special characters", () => {
        assert.ok(!isValidPersonName("John@Doe"));
        assert.ok(!isValidPersonName("Test<>Script"));
    });

    it("returns true for empty string (required check is separate)", () => {
        assert.ok(isValidPersonName(""));
        assert.ok(isValidPersonName(null));
        assert.ok(isValidPersonName(undefined));
    });
});
