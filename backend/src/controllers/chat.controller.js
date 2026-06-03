import { generateStreamToken, getChannelAttachments } from "../lib/stream.js";
import Appointment from "../models/Appointment.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

// Returns all file/image attachments from the Stream Chat channel for an appointment.
// Only accessible by the appointment's own participants (or admin).
export const getAppointmentChatAttachments = asyncHandler(async (req, res) => {
  const { appointmentId } = req.query;
  if (!appointmentId) return sendError(res, 400, "appointmentId is required");

  const appointment = await Appointment.findById(appointmentId).lean();
  if (!appointment) return sendError(res, 404, "Appointment not found");

  const userId = req.user._id.toString();
  const isParticipant =
    appointment.patientId?.toString() === userId ||
    appointment.doctorId?.toString()  === userId ||
    req.user.role === "admin";
  if (!isParticipant) return sendError(res, 403, "Not authorized");

  const doctorId  = appointment.doctorId?.toString();
  const patientId = appointment.patientId?.toString();
  if (!doctorId || !patientId) return sendSuccess(res, 200, "No chat channel", { attachments: [] });

  const attachments = await getChannelAttachments(doctorId, patientId);
  return sendSuccess(res, 200, "Attachments fetched", { attachments });
});

export const getStreamToken = asyncHandler(async (req, res) => {
  const token = generateStreamToken(req.user._id);
  return sendSuccess(res, 200, "Stream token generated", { token });
});

// Proxies translation requests to the MyMemory free API (no key, 10k chars/day).
// Language pair logic:
//   target "en"  → use auto-detect as source (handles Tagalog/Cebuano → English)
//   target "tl"/"ceb" → assume English source (doctor messages are written in English)
// On any external API failure the original text is returned so the UI never breaks.
export const translateMessage = asyncHandler(async (req, res) => {
  const { text, targetLang } = req.body;
  if (!text || !targetLang) return sendError(res, 400, "text and targetLang are required");

  try {
    // MyMemory does not support "auto" as a source language.
    // Translate TO English assumes Tagalog source (most common local language).
    // Translate TO tl/ceb assumes English source (doctor messages).
    const langpair = targetLang === "en" ? "tl|en" : `en|${targetLang}`;
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`;
    const response = await fetch(url);
    const data = await response.json();
    const translatedText = data?.responseData?.translatedText || text;
    return sendSuccess(res, 200, "Translated", { translatedText });
  } catch {
    return sendSuccess(res, 200, "Translated", { translatedText: text });
  }
});