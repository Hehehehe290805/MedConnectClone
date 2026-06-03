import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getNotifications, markNotificationRead, markAllNotificationsRead,
} from "../lib/api";
import { BellIcon, CheckCheckIcon, ClockIcon } from "lucide-react";
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

const NotificationsPage = () => {
    const queryClient = useQueryClient();

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
                                    onClick={() => !n.isRead && markRead(n._id)}
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
        </div>
    );
};

export default NotificationsPage;
