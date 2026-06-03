import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

// Returns the platform's mock GCash details so the frontend doesn't need
// them hardcoded. Reads from env so they can be changed without a deploy.
export const getMockPaymentInfo = asyncHandler(async (req, res) => {
    return sendSuccess(res, 200, "Mock payment info", {
        gcashNumber: process.env.MOCK_GCASH_NUMBER || "0917-000-0000",
        accountName: process.env.MOCK_GCASH_NAME || "MedConnect Platform",
    });
});