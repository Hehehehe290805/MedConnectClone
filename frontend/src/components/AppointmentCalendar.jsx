import { useState, useMemo } from "react";
import { useNavigate } from "react-router";
import { ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ListIcon, XIcon, MessageCircleIcon } from "lucide-react";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import useAuthUser from "../hooks/useAuthUser";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

// Only show dots for non-terminal statuses (no cancelled/rejected/resolved)
const ACTIVE_DOT_STATUSES = new Set([
    "pending_payment", "deposit_paid", "accepted", "ongoing",
    "awaiting_balance", "disputed", "completed", "fully_paid",
]);

const STATUS_DOT = {
    pending_payment:  "bg-warning",
    deposit_paid:     "bg-info",
    accepted:         "bg-success",
    ongoing:          "bg-accent",
    completed:        "bg-success",
    awaiting_balance: "bg-warning",
    fully_paid:       "bg-success",
    disputed:         "bg-warning",
};

const WEEK_DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Statuses where chat makes sense
const CHAT_STATUSES = new Set(["accepted", "ongoing", "awaiting_balance", "completed", "fully_paid", "disputed"]);

function getCounterpart(appt, userRole) {
    if (userRole === "patient") {
        if (appt.doctorId?.firstName) return `Dr. ${appt.doctorId.firstName} ${appt.doctorId.lastName}`;
        if (appt.instituteId?.instituteName) return appt.instituteId.instituteName;
        return "Provider";
    }
    if (appt.patientId?.firstName) return `${appt.patientId.firstName} ${appt.patientId.lastName}`;
    return "Patient";
}

function getChatCounterpartId(appt, userRole) {
    if (userRole === "patient") {
        return appt.doctorId?._id || appt.doctorId || null;
    }
    return appt.patientId?._id || appt.patientId || null;
}

const STATUS_LABEL = {
    pending_payment:  "Pending Payment",
    deposit_paid:     "Deposit Paid",
    accepted:         "Confirmed",
    ongoing:          "Ongoing",
    completed:        "Completed",
    awaiting_balance: "Awaiting Balance",
    fully_paid:       "Fully Paid",
    cancelled:        "Cancelled",
    rejected:         "Rejected",
    disputed:         "Disputed",
    resolved:         "Resolved",
};

const ListRow = ({ appt, userRole, onViewDetails, onChat }) => {
    const start = dayjs(appt.start).tz(PH_TZ);
    const durationMin = Math.round((new Date(appt.end) - new Date(appt.start)) / 60000);
    const canChat = userRole === "patient" || userRole === "doctor";
    const showChat = canChat && CHAT_STATUSES.has(appt.status) && getChatCounterpartId(appt, userRole);
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onViewDetails(appt)}
                className="flex-1 text-left flex items-center justify-between gap-3 p-3 rounded-xl border border-base-300 bg-base-100 hover:bg-base-200 transition-colors"
            >
                <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{getCounterpart(appt, userRole)}</p>
                    <p className="text-xs opacity-60">
                        {start.format("ddd, MMM D, YYYY")} · {start.format("h:mm A")} ({durationMin} min) · ₱{appt.amount?.toLocaleString("en-PH")}
                    </p>
                </div>
                <span className="text-xs shrink-0 opacity-70">{STATUS_LABEL[appt.status] || appt.status}</span>
            </button>
            {showChat && (
                <button
                    className="btn btn-ghost btn-sm btn-circle shrink-0"
                    title="Open chat"
                    onClick={() => onChat(appt)}
                >
                    <MessageCircleIcon className="size-4" />
                </button>
            )}
        </div>
    );
};

const AppointmentCalendar = ({ appointments = [], onViewDetails, isLoading }) => {
    const { authUser } = useAuthUser();
    const navigate = useNavigate();
    const userRole = authUser?.role;

    const [viewMode, setViewMode] = useState("calendar");
    const [currentMonth, setCurrentMonth] = useState(() => dayjs().tz(PH_TZ).startOf("month"));
    const [selectedDay, setSelectedDay] = useState(null);

    const today = dayjs().tz(PH_TZ).format("YYYY-MM-DD");

    // Only map active appointments to dates for dot display
    const apptsByDate = useMemo(() => {
        const map = {};
        appointments.forEach(a => {
            if (!ACTIVE_DOT_STATUSES.has(a.status)) return;
            const key = dayjs(a.start).tz(PH_TZ).format("YYYY-MM-DD");
            if (!map[key]) map[key] = [];
            map[key].push(a);
        });
        return map;
    }, [appointments]);

    // For day popup: show all appointments on that day (including cancelled etc.)
    const allApptsByDate = useMemo(() => {
        const map = {};
        appointments.forEach(a => {
            const key = dayjs(a.start).tz(PH_TZ).format("YYYY-MM-DD");
            if (!map[key]) map[key] = [];
            map[key].push(a);
        });
        return map;
    }, [appointments]);

    const calendarDays = useMemo(() => {
        const gridStart = currentMonth.startOf("week");
        return Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));
    }, [currentMonth]);

    const selectedDayAppts = selectedDay ? (allApptsByDate[selectedDay] || []) : [];

    const active = [...appointments]
        .filter(a => !["cancelled", "rejected", "resolved"].includes(a.status))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const closed = [...appointments]
        .filter(a => ["cancelled", "rejected", "resolved"].includes(a.status))
        .sort((a, b) => new Date(b.start) - new Date(a.start));

    const handleChat = (appt) => {
        const id = getChatCounterpartId(appt, userRole);
        if (id) navigate(`/chat/${id}`);
    };

    if (isLoading) {
        return <div className="flex justify-center py-12"><span className="loading loading-spinner loading-lg" /></div>;
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-bold">Appointments</h2>
                <div className="join">
                    <button
                        className={`join-item btn btn-sm gap-1 ${viewMode === "calendar" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => { setViewMode("calendar"); setSelectedDay(null); }}
                    >
                        <CalendarIcon className="size-3.5" /> Calendar
                    </button>
                    <button
                        className={`join-item btn btn-sm gap-1 ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setViewMode("list")}
                    >
                        <ListIcon className="size-3.5" /> List
                    </button>
                </div>
            </div>

            {viewMode === "calendar" ? (
                <div className="card bg-base-100 border border-base-300 shadow-sm overflow-hidden">
                    {/* Month navigation */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-base-300">
                        <button
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() => setCurrentMonth(m => m.subtract(1, "month"))}
                        >
                            <ChevronLeftIcon className="size-4" />
                        </button>
                        <span className="font-semibold text-sm">{currentMonth.format("MMMM YYYY")}</span>
                        <button
                            className="btn btn-ghost btn-sm btn-circle"
                            onClick={() => setCurrentMonth(m => m.add(1, "month"))}
                        >
                            <ChevronRightIcon className="size-4" />
                        </button>
                    </div>

                    {/* Weekday headers */}
                    <div className="grid grid-cols-7 border-b border-base-300 bg-base-200/50">
                        {WEEK_DAYS.map(d => (
                            <div key={d} className="text-center text-xs font-medium py-2 opacity-60">{d}</div>
                        ))}
                    </div>

                    {/* Day grid */}
                    <div className="grid grid-cols-7">
                        {calendarDays.map((day, i) => {
                            const key = day.format("YYYY-MM-DD");
                            const inMonth = day.month() === currentMonth.month();
                            const isToday = key === today;
                            const isSelected = key === selectedDay;
                            const dayAppts = apptsByDate[key] || [];
                            const hasAppts = dayAppts.length > 0;

                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        const allDay = allApptsByDate[key] || [];
                                        if (allDay.length > 0) setSelectedDay(key);
                                    }}
                                    className={[
                                        "min-h-[56px] p-1 border-b border-r border-base-200 flex flex-col items-center gap-0.5",
                                        (allApptsByDate[key] || []).length > 0 ? "hover:bg-base-200 transition-colors cursor-pointer" : "cursor-default",
                                        !inMonth ? "opacity-25" : "",
                                        isSelected ? "bg-primary/10" : "",
                                    ].filter(Boolean).join(" ")}
                                >
                                    <span className={[
                                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mt-0.5",
                                        isToday ? "bg-primary text-primary-content" : "",
                                    ].filter(Boolean).join(" ")}>
                                        {day.date()}
                                    </span>
                                    <div className="flex flex-wrap justify-center gap-0.5 px-0.5">
                                        {dayAppts.slice(0, 4).map((a, j) => (
                                            <span
                                                key={j}
                                                className={`size-1.5 rounded-full ${STATUS_DOT[a.status] || "bg-base-content/30"}`}
                                            />
                                        ))}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>
            ) : (
                /* List view */
                <div className="space-y-6">
                    {appointments.length === 0 ? (
                        <div className="text-center py-12 opacity-40">
                            <CalendarIcon className="size-10 mx-auto mb-3" />
                            <p className="font-medium">No appointments yet</p>
                        </div>
                    ) : (
                        <>
                            {active.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Active & Upcoming</p>
                                    {active.map(a => (
                                        <ListRow key={a._id} appt={a} userRole={userRole} onViewDetails={onViewDetails} onChat={handleChat} />
                                    ))}
                                </div>
                            )}
                            {closed.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold uppercase tracking-wider opacity-50">Closed</p>
                                    {closed.map(a => (
                                        <ListRow key={a._id} appt={a} userRole={userRole} onViewDetails={onViewDetails} onChat={handleChat} />
                                    ))}
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Day popup */}
            {selectedDay && selectedDayAppts.length > 0 && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => setSelectedDay(null)}
                >
                    <div
                        className="bg-base-100 rounded-xl w-full max-w-sm max-h-[80vh] flex flex-col shadow-xl"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between p-4 border-b border-base-300">
                            <p className="font-semibold">{dayjs(selectedDay).tz(PH_TZ).format("dddd, MMMM D")}</p>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setSelectedDay(null)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="overflow-y-auto p-4 space-y-2">
                            {selectedDayAppts.map(a => {
                                const canChat = (userRole === "patient" || userRole === "doctor") && CHAT_STATUSES.has(a.status) && getChatCounterpartId(a, userRole);
                                return (
                                    <div key={a._id} className="bg-base-200 rounded-xl p-3 space-y-2">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="font-medium text-sm truncate">{getCounterpart(a, userRole)}</p>
                                                <p className="text-xs opacity-60">
                                                    {dayjs(a.start).tz(PH_TZ).format("h:mm A")} – {dayjs(a.end).tz(PH_TZ).format("h:mm A")}
                                                </p>
                                                {a.amount != null && (
                                                    <p className="text-xs opacity-60">₱{a.amount.toLocaleString("en-PH")}</p>
                                                )}
                                            </div>
                                            <span className="text-xs opacity-70 shrink-0">{STATUS_LABEL[a.status] || a.status}</span>
                                        </div>
                                        <div className="flex gap-2">
                                            {canChat && (
                                                <button
                                                    className="btn btn-ghost btn-xs flex-1 gap-1"
                                                    onClick={() => { setSelectedDay(null); handleChat(a); }}
                                                >
                                                    <MessageCircleIcon className="size-3" />Chat
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-primary btn-xs flex-1"
                                                onClick={() => { setSelectedDay(null); onViewDetails(a); }}
                                            >
                                                View
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AppointmentCalendar;
