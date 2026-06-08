import { strict as assert } from "assert";
import { normalizePhone, isValidPersonName } from "../src/utils/validation.js";

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
