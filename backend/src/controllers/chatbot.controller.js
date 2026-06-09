import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { makeRateLimiter } from "../utils/rateLimiter.js";

const checkRateLimit = makeRateLimiter();
const CHATBOT_TIMEOUT_MS = 12_000; // 12 seconds

const SYSTEM_PROMPT = `You are MedConnect Assistant, the in-app helper for MedConnect — a Philippine telehealth platform connecting patients with licensed healthcare providers.

IMPORTANT RULES:
1. PROFANITY & ABUSE: If the user's message contains profanity, offensive language, slurs, or personal insults, do NOT answer the question at all. Respond ONLY with: "Please keep the conversation respectful. I'm here to help with MedConnect questions." Do not explain, lecture, or continue the topic.
2. STRICT SCOPE: You can ONLY answer questions about MedConnect — its features, how to use the app, appointment policies, and general platform information. If a question is not about MedConnect, respond IMMEDIATELY with: "I can only help with MedConnect-related questions. I'm not able to answer general or off-topic questions. Try asking about appointments, payments, settings, or how to use the platform." Do NOT attempt to answer the off-topic question first, then redirect — refuse immediately.
3. Never provide medical diagnoses, treatment recommendations, or specific medical advice. Always tell users to consult a licensed healthcare professional.
4. When users ask about symptoms or what doctor to see, give a brief general answer then redirect them to the pre-consultation wizard at /consultation.
5. For finding doctors, redirect to /search.
6. When referencing platform features, mention the exact page they can navigate to (e.g., "Go to Settings → Help & Support").
7. Keep answers concise (2-4 sentences max). Be friendly and professional.

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
- In-app license/permit renewal: Go to Settings → Licenses & Permits → click Renew next to the relevant item. Upload the new document and submit. Admin reviews and approves or rejects the renewal — this is entirely within MedConnect and does not require going to any external government agency. Applies to: doctors (PRC license), pharmacies (FDA license + pharmacist PRC license), institutes (business permit / construction permit), departments (technologist license). Status becomes "Pending Renewal" while waiting for admin approval.

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHATBOT_TIMEOUT_MS);

    let response;
    try {
        response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages,
                max_tokens: 300,
                temperature: 0.4,
            }),
            signal: controller.signal,
        });
    } catch (err) {
        if (err.name === "AbortError") {
            return sendError(res, 504, "Chatbot request timed out. Please try again.");
        }
        throw err;
    } finally {
        clearTimeout(timeout);
    }

    if (!response.ok) {
        const errText = await response.text().catch(() => "");
        let hint = "";
        try { hint = JSON.parse(errText)?.error?.message || ""; } catch {}
        return sendError(res, 502, hint ? `Chatbot error: ${hint}` : "Chatbot service unavailable. Please try again.");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content?.trim();
    if (!reply) return sendError(res, 502, "Empty response from chatbot.");

    return sendSuccess(res, 200, "OK", { reply });
});
