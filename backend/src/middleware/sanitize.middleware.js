// Recursively sanitizes req.body:
//   - Strips HTML tags from strings (XSS prevention)
//   - Trims whitespace from strings
//   - Drops object keys starting with '$' (NoSQL operator injection prevention)
//
// MongoDB is not susceptible to SQL injection (it uses BSON, not SQL), but
// operator injection via e.g. { email: { "$gt": "" } } can bypass auth queries.
// Dropping '$'-prefixed keys at the boundary closes that vector.

function sanitizeValue(value) {
    if (typeof value === "string") {
        return value.replace(/<[^>]*>/g, "").trim();
    }
    if (Array.isArray(value)) {
        return value.map(sanitizeValue);
    }
    if (value !== null && typeof value === "object") {
        const cleaned = {};
        for (const key of Object.keys(value)) {
            if (key.startsWith("$")) continue;
            cleaned[key] = sanitizeValue(value[key]);
        }
        return cleaned;
    }
    return value;
}

export const sanitizeBody = (req, _res, next) => {
    if (req.body && typeof req.body === "object") {
        req.body = sanitizeValue(req.body);
    }
    next();
};
