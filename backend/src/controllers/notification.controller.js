import Notification from "../models/Notification.js";
import asyncHandler from "../utils/asyncHandler.js";
import { sendSuccess, sendError } from "../utils/response.js";

export const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ recipient: req.user._id })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();

    return sendSuccess(res, 200, "Notifications fetched", { notifications });
});

export const getUnreadCount = asyncHandler(async (req, res) => {
    const count = await Notification.countDocuments({
        recipient: req.user._id,
        isRead: false,
    });
    return sendSuccess(res, 200, "Unread count fetched", { count });
});

export const markOneRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, recipient: req.user._id },
        { isRead: true },
        { new: true }
    );
    if (!notification) return sendError(res, 404, "Notification not found");
    return sendSuccess(res, 200, "Notification marked as read", { notification });
});

export const markAllRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { recipient: req.user._id, isRead: false },
        { isRead: true }
    );
    return sendSuccess(res, 200, "All notifications marked as read");
});
