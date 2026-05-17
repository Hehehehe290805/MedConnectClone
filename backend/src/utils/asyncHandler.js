/**
 * Wraps an async controller function and automatically catches errors,
 * passing them to Express's centralized error handler via next()
 * @param {Function} fn - Async controller function
 * @returns {Function} Express middleware function
 */
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

export default asyncHandler;