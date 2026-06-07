import { strict as assert } from "assert";

// Inline rate-limiter logic from chatbot.controller.js
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000;

function makeRateLimiter() {
    const map = new Map();
    return function checkRateLimit(userId) {
        const now = Date.now();
        const key = userId.toString();
        const entry = map.get(key);
        if (!entry || now - entry.windowStart > WINDOW_MS) {
            map.set(key, { count: 1, windowStart: now });
            return true;
        }
        if (entry.count >= RATE_LIMIT) return false;
        entry.count++;
        return true;
    };
}

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
        const map = new Map();
        function limitWithTime(userId, now) {
            const key = userId.toString();
            const entry = map.get(key);
            if (!entry || now - entry.windowStart > WINDOW_MS) {
                map.set(key, { count: 1, windowStart: now });
                return true;
            }
            if (entry.count >= RATE_LIMIT) return false;
            entry.count++;
            return true;
        }

        const t0 = Date.now();
        for (let i = 0; i < 20; i++) limitWithTime("user1", t0);
        assert.ok(!limitWithTime("user1", t0), "Should be blocked");

        // Simulate 1 hour later
        const t1 = t0 + WINDOW_MS + 1;
        assert.ok(limitWithTime("user1", t1), "Should be allowed after window reset");
    });
});
