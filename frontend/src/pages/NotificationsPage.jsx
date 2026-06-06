import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getNotifications, markNotificationRead, markAllNotificationsRead,
} from "../lib/api";
import { BellIcon, CheckCheckIcon, ClockIcon, PackageIcon, ShieldXIcon, XIcon } from "lucide-react";
import NoNotificationsFound from "../components/NoNotificationsFound";

const TYPE_ICONS = {
    role_approved:         "✅",
    role_rejected:         "❌",
    suggestion_approved:   "✅",
    suggestion_rejected:   "❌",
    claim_approved:        "✅",
    claim_rejected:        "❌",
    renewal_approved:      "✅",
    renewal_rejected:      "❌",
    license_expiring_soon: "⚠️",
    license_expired:       "🚫",
    appointment_booked:    "📅",
    appointment_accepted:  "✅",
    appointment_rejected:  "❌",
    appointment_cancelled: "❌",
    appointment_started:   "🏥",
    appointment_completed: "✅",
    payment_received:      "💳",
    dispute_filed:         "⚠️",
    dispute_resolved:      "✅",
};

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const RejectedPrescriptionModal = ({ notification, onClose }) => {
    if (!notification) return null;

    const metadata = notification.metadata || {};
    const items = metadata.items || [];

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-2xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Prescription Rejected</h2>
                        <p className="text-sm opacity-60 font-mono">{metadata.referenceNumber || "Pharmacy order"}</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <div className="alert bg-error/10 border border-error/20 mb-4">
                    <ShieldXIcon className="size-5 text-error" />
                    <div>
                        <p className="font-semibold">Reason</p>
                        <p className="text-sm opacity-80">{metadata.reason || notification.body}</p>
                        {metadata.notes && <p className="text-sm opacity-70 mt-1">Notes: {metadata.notes}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="font-semibold">Order items</p>
                    {items.length === 0 ? (
                        <div className="rounded-lg bg-base-200 p-3 text-sm opacity-70">No item details were attached.</div>
                    ) : items.map((item, index) => (
                        <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-base-200 p-3">
                            <div className="flex items-center gap-3">
                                <div className="size-10 rounded bg-base-300 flex items-center justify-center">
                                    <PackageIcon className="size-5 opacity-60" />
                                </div>
                                <div>
                                    <p className="font-semibold">{item.name}</p>
                                    <p className="text-sm opacity-70">
                                        x{item.quantity} - {item.overTheCounter ? "No prescription required" : "Prescription required"}
                                    </p>
                                </div>
                            </div>
                            <span className="font-semibold">{currency((item.unitPrice || 0) * (item.quantity || 0))}</span>
                        </div>
                    ))}
                </div>

                <div className="modal-action">
                    <button className="btn btn-primary" onClick={onClose}>Close</button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const NotificationsPage = () => {
    const queryClient = useQueryClient();
    const [selectedRejectedNotification, setSelectedRejectedNotification] = useState(null);

    const { data: notifData, isLoading } = useQuery({
        queryKey: ["notifications"],
        queryFn: getNotifications,
        refetchInterval: 30_000,
    });
    const notifications = notifData?.data?.notifications ?? [];
    const unreadNotifications = notifications.filter(n => !n.isRead);

    const { mutate: markRead } = useMutation({
        mutationFn: markNotificationRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
        },
    });

    const { mutate: markAllRead, isPending: isMarkingAll } = useMutation({
        mutationFn: markAllNotificationsRead,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["notifications"] });
            queryClient.invalidateQueries({ queryKey: ["notificationUnreadCount"] });
        },
    });

    const handleNotificationClick = (notification) => {
        if (!notification.isRead) markRead(notification._id);
        if (notification.type === "pharmacy_prescription_rejected") {
            setSelectedRejectedNotification(notification);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="container mx-auto max-w-4xl space-y-8">
                <div className="flex items-center justify-between flex-wrap gap-3">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Notifications</h1>
                    {unreadNotifications.length > 0 && (
                        <button
                            className="btn btn-ghost btn-sm gap-2"
                            onClick={() => markAllRead()}
                            disabled={isMarkingAll}
                        >
                            <CheckCheckIcon className="h-4 w-4" />
                            Mark all read
                        </button>
                    )}
                </div>

                {isLoading ? (
                    <div className="flex justify-center py-12">
                        <span className="loading loading-spinner loading-lg" />
                    </div>
                ) : notifications.length === 0 ? (
                    <NoNotificationsFound />
                ) : (
                    <section className="space-y-4">
                        <h2 className="text-xl font-semibold flex items-center gap-2">
                            <BellIcon className="h-5 w-5 text-primary" />
                            Notifications
                            {unreadNotifications.length > 0 && (
                                <span className="badge badge-primary ml-1">{unreadNotifications.length}</span>
                            )}
                        </h2>
                        <div className="space-y-3">
                            {notifications.map((n) => (
                                <div
                                    key={n._id}
                                    className={`card shadow-sm cursor-pointer transition-shadow hover:shadow-md ${
                                        n.isRead ? "bg-base-200" : "bg-base-100 border border-primary/20"
                                    }`}
                                    onClick={() => handleNotificationClick(n)}
                                >
                                    <div className="card-body p-4">
                                        <div className="flex items-start gap-3">
                                            <span className="text-xl shrink-0 mt-0.5">
                                                {TYPE_ICONS[n.type] ?? "🔔"}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className={`font-semibold text-sm ${!n.isRead ? "text-primary" : ""}`}>
                                                        {n.title}
                                                    </h3>
                                                    {!n.isRead && (
                                                        <span className="badge badge-primary badge-xs">New</span>
                                                    )}
                                                </div>
                                                <p className="text-sm mt-1 opacity-80">{n.body}</p>
                                                <p className="text-xs flex items-center opacity-50 mt-2">
                                                    <ClockIcon className="h-3 w-3 mr-1 shrink-0" />
                                                    {new Date(n.createdAt).toLocaleDateString("en-US", {
                                                        month: "short", day: "numeric", year: "numeric",
                                                        hour: "2-digit", minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>
            <RejectedPrescriptionModal
                notification={selectedRejectedNotification}
                onClose={() => setSelectedRejectedNotification(null)}
            />
        </div>
    );
};

export default NotificationsPage;
