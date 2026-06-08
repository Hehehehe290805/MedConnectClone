import { strict as assert } from "assert";
import { sanitizeValue, sanitizeObject } from "../src/middleware/sanitize.middleware.js";

describe("sanitizeObject() — body sanitization", () => {
    it("strips HTML tags from string values (keeps text content between tags)", () => {
        // The sanitizer removes tag syntax but preserves the text node content.
        // React escapes all text by default, so `alert(1)` renders as plain text, not code.
        const out = sanitizeObject({ bio: "<b>Bold</b> text" });
        assert.equal(out.bio, "Bold text");
    });

    it("strips script tags leaving inner text", () => {
        const out = sanitizeObject({ bio: "<script>alert(1)</script>Hello" });
        assert.equal(out.bio, "alert(1)Hello");
    });

    it("removes keys with $ prefix (NoSQL injection)", () => {
        const out = sanitizeObject({ name: "Juan", "$where": "1==1" });
        assert.ok(!("$where" in out));
        assert.equal(out.name, "Juan");
    });

    it("recursively sanitizes nested objects", () => {
        const out = sanitizeObject({ address: { city: "<b>Manila</b>" } });
        assert.equal(out.address.city, "Manila");
    });

    it("sanitizes array items", () => {
        const out = sanitizeObject({ tags: ["<em>tag1</em>", "normal"] });
        assert.deepEqual(out.tags, ["tag1", "normal"]);
    });

    it("preserves non-string primitives", () => {
        const out = sanitizeObject({ count: 42, active: true, nothing: null });
        assert.equal(out.count, 42);
        assert.equal(out.active, true);
        assert.equal(out.nothing, null);
    });

    it("handles multiple $ keys at once", () => {
        const out = sanitizeObject({ "$ne": null, "$gt": 0, username: "jeff" });
        assert.ok(!("$ne" in out));
        assert.ok(!("$gt" in out));
        assert.equal(out.username, "jeff");
    });
});
