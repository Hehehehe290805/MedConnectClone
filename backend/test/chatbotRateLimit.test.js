import { strict as assert } from "assert";
import { makeRateLimiter, RATE_LIMIT, WINDOW_MS } from "../src/utils/rateLimiter.js";

describe("Chatbot rate limiter", () => {
    it("allows first message", () => {
        const limiter = makeRateLimiter();
        assert.ok(limiter("user1"));
    });

    it("allows up to 20 messages", () => {
        const limiter = makeRateLimiter();
        for (let i = 0; i < 20; i++) {
            assert.ok(limiter("user1"), `Message ${i + 1} should be allowed`);
        }
    });

    it("blocks the 21st message", () => {
        const limiter = makeRateLimiter();
        for (let i = 0; i < 20; i++) limiter("user1");
        assert.ok(!limiter("user1"), "21st message should be blocked");
    });

    it("different users have independent counters", () => {
        const limiter = makeRateLimiter();
        for (let i = 0; i < 20; i++) limiter("user1");
        assert.ok(limiter("user2"), "user2 should not be affected by user1 limit");
    });

    it("resets counter after window expires", () => {
        const limiter = makeRateLimiter();
        for (let i = 0; i < RATE_LIMIT; i++) limiter("user1");
        assert.ok(!limiter("user1"), "Should be blocked");

        const entry = limiter._rateLimits.get("user1");
        entry.windowStart = Date.now() - WINDOW_MS - 1;

        assert.ok(limiter("user1"), "Should be allowed after window reset");
    });
});
