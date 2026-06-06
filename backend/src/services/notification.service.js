import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import { sendNotificationEmail } from "./email.js";

// Resolve email + notification preference for a recipient, checking both collections.
async function resolveEmailAndPrefs(recipientId) {
    const user = await User.findById(recipientId).select("email emailNotificationsEnabled").lean();
    if (user?.email) return { email: user.email, emailEnabled: user.emailNotificationsEnabled !== false };
    const admin = await Admin.findById(recipientId).select("email emailNotificationsEnabled").lean();
    return { email: admin?.email || null, emailEnabled: admin?.emailNotificationsEnabled !== false };
}

/**
 * Creates an in-app notification and sends a Brevo email to the recipient.
 * Checks both User and Admin collections for the email address.
 * Both operations are non-fatal — failures are logged but never propagate.
 */
export async function notify(recipientId, type, title, body, metadata = {}) {
    // 1. In-app record — uses ObjectId ref, valid for both User and Admin docs
    try {
        await Notification.create({ recipient: recipientId, type, title, body, metadata });
    } catch (err) {
        console.error("[Notify] Failed to create in-app notification:", err.message);
    }

    // 2. Email — skipped when recipient has turned off email notifications
    try {
        const { email, emailEnabled } = await resolveEmailAndPrefs(recipientId);
        if (email && emailEnabled) {
            await sendNotificationEmail(email, `MedConnect: ${title}`, body);
        }
    } catch (err) {
        console.error("[Notify] Failed to send notification email:", err.message);
    }
}

/**
 * Broadcasts a notification to every onBoarded admin account.
 * Used for events requiring admin attention: new pending accounts,
 * renewal requests, disputes, etc.
 * Non-fatal — individual failures do not abort the loop.
 */
export async function notifyAllAdmins(type, title, body) {
    try {
        const admins = await Admin.find({ status: "onBoarded" }).select("_id").lean();
        for (const admin of admins) {
            // fire-and-forget per admin — do not await all in parallel to keep
            // error isolation (one bad admin doc won't skip others)
            notify(admin._id, type, title, body).catch((err) =>
                console.error(`[NotifyAdmins] Failed for admin ${admin._id}:`, err.message)
            );
        }
    } catch (err) {
        console.error("[NotifyAdmins] Failed to fetch admin list:", err.message);
    }
}
