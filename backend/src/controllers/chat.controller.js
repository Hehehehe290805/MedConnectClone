import { generateStreamToken } from "../lib/stream.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess } from "../utils/response.js";

export const getStreamToken = asyncHandler(async (req, res) => {
  const token = generateStreamToken(req.user._id);
  return sendSuccess(res, 200, "Stream token generated", { token });
});