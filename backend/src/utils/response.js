/**
 * Send a successful response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Success message
 * @param {any} data - Response data (optional)
 */
export const sendSuccess = (res, statusCode = 200, message = "Success", data = null) => {
    const response = { success: true, message };
    if (data !== null) response.data = data;
    return res.status(statusCode).json(response);
};

/**
 * Send an error response
 * @param {object} res - Express response object
 * @param {number} statusCode - HTTP status code
 * @param {string} message - Error message
 * @param {any} errors - Additional error details (optional)
 */
export const sendError = (res, statusCode = 500, message = "Internal Server Error", errors = null) => {
    const response = { success: false, message };
    if (errors !== null) response.errors = errors;
    return res.status(statusCode).json(response);
};