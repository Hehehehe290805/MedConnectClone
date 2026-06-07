import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

// In-memory rate limiter: userId → { count, windowStart }
const rateLimits = new Map();
const RATE_LIMIT = 20;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId) {
    const now = Date.now();
    const key = userId.toString();
    const entry = rateLimits.get(key);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        rateLimits.set(key, { count: 1, windowStart: now });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

const SYSTEM_PROMPT = `You are MedConnect Assistant, the in-app helper for MedConnect — a Philippine telehealth platform connecting patients with licensed healthcare providers.

IMPORTANT RULES:
1. Never provide medical diagnoses, treatment recommendations, or specific medical advice. Always tell users to consult a licensed healthcare professional.
2. Only answer questions about MedConnect features, how to use the app, appointment policies, and general platform information.
3. When users ask about symptoms or what doctor to see, give a brief general answer then redirect them to the pre-consultation wizard at /consultation.
4. For finding doctors, redirect to /search.
5. When referencing platform features, mention the exact page they can navigate to (e.g., "Go to Settings → Help & Support").
6. Keep answers concise (2-4 sentences max). Be friendly and professional.

PLATFORM FACTS:
- MedConnect is a Philippine telehealth platform
- Patients book appointments with doctors (virtual or in-person)
- 50% deposit required to confirm appointments; platform fee is 10%
- Deposits are non-refundable once appointment is accepted, except if dispute is resolved in patient's favor
- Doctors must have valid PRC licenses
- Appointment statuses: Pending Payment → Deposit Paid → Accepted → Ongoing → Completed/Awaiting Balance → Fully Paid
- Virtual appointments require 50% balance payment after completion
- 2FA and email notification preferences can be changed in Settings
- Pre-consultation wizard (/consultation) helps match symptoms to specialists
- Disputes can be filed and are resolved by admin
- Account deletion has a 30-day grace period (can be cancelled by logging in)
- Queue system: your appointment slot may shift ±15 minutes due to queue dynamics
- Terms of Service available at /terms-of-service; Privacy Policy at /privacy-policy

When asked about T&C, quotes from the terms above are accurate.`;

export const chatbotMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { message, history = [] } = req.body;

    if (!message?.trim()) return sendError(res, 400, "Message is required");

    if (!checkRateLimit(userId)) {
        return sendError(res, 429, "You've reached the 20 message/hour limit. Please try again later.");
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return sendError(res, 503, "Chatbot service is not configured.");

    const messages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...history.slice(-8).map(h => ({ role: h.role, content: h.content })),
        { role: "user", content: message.trim() },
    ];

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: "llama3-8b-8192",
            messages,
            max_tokens: 300,
            temperature: 0.4,
        }),
    });

    if (!response.ok) {
        const err = await response.text();
        console.error("Groq API error:", err);
        return sendError(res, 502, "Chatbot service unavailable. Please try again.");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return sendError(res, 502, "Empty response from chatbot.");

    return sendSuccess(res, 200, "OK", { reply });
});
