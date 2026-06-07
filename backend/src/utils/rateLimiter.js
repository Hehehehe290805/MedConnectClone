export const RATE_LIMIT = 20;
export const WINDOW_MS = 60 * 60 * 1000; // 1 hour

export function makeRateLimiter() {
    const rateLimits = new Map();

    const cleaner = setInterval(() => {
        const now = Date.now();
        for (const [key, entry] of rateLimits.entries()) {
            if (now - entry.windowStart > WINDOW_MS) {
                rateLimits.delete(key);
            }
        }
    }, WINDOW_MS);

    if (typeof cleaner.unref === "function") {
        cleaner.unref();
    }

    const limiter = function checkRateLimit(userId) {
        const now = Date.now();
        const key = userId.toString();
        const entry = rateLimits.get(key);

        if (!entry || now - entry.windowStart > WINDOW_MS) {
            rateLimits.delete(key);
            rateLimits.set(key, { count: 1, windowStart: now });
            return true;
        }

        if (entry.count >= RATE_LIMIT) return false;
        entry.count++;
        return true;
    };

    limiter._rateLimits = rateLimits;
    return limiter;
}
