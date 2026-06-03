import Notification from "../models/Notification.js";
import User from "../models/User.js";
import Admin from "../models/Admin.js";
import { sendNotificationEmail } from "./email.js";

// Resolve the email for a given recipient ID, checking both User and Admin
// collections. Admins live in a separate collection from the User discriminators.
async function resolveEmail(recipientId) {
    const user = await User.findById(recipientId).select("email").lean();
    if (user?.email) return user.email;
    const admin = await Admin.findById(recipientId).select("email").lean();
    return admin?.email || null;
}

/**
 * Creates an in-app notification and sends a Brevo email to the recipient.
 * Checks both User and Admin collections for the email address.
 * Both operations are non-fatal — failures are logged but never propagate.
 */
export async function notify(recipientId, type, title, body) {
    // 1. In-app record — uses ObjectId ref, valid for both User and Admin docs
    try {
        await Notification.create({ recipient: recipientId, type, title, body });
    } catch (err) {
        console.error("[Notify] Failed to create in-app notification:", err.message);
    }

    // 2. Email — check User first, then Admin (separate collection)
    try {
        const email = await resolveEmail(recipientId);
        if (email) {
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
