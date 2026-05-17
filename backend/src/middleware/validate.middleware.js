import { validationResult } from "express-validator";

/**
 * Runs after express-validator checks and returns a consistent error response
 * if any validation rules failed. Pass this after your validator array in routes.
 */
export const validate = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: "Validation failed",
            errors: errors.array().map((e) => ({
                field: e.path,
                message: e.msg,
            })),
        });
    }
    next();
};