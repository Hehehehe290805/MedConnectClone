import { Component, lazy, Suspense, useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import { Link } from "react-router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
    AlertTriangleIcon, CalendarIcon, UserIcon, SearchIcon, HistoryIcon,
    ClockIcon, CheckCircleIcon, ArchiveIcon,
} from "lucide-react";

const ViewPendingAppointmentPatientPopup = lazy(() =>
    import("./ViewPendingAppointmentPatientPopup.jsx")
);

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

class AppointmentsErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }
    static getDerivedStateFromError(error) {
        return { error };
    }
    render() {
        if (this.state.error) {
            return (
                <div className="p-8 max-w-xl mx-auto">
                    <div className="alert alert-error">
                        <div>
                            <p className="font-bold">Page crashed — please report this error:</p>
                            <p className="text-sm mt-1 font-mono break-all">{String(this.state.error)}</p>
                        </div>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const STATUS_LABEL = {
    pending_payment:    "Pending Payment",
    deposit_paid:       "Deposit Paid",
    accepted:           "Confirmed",
    ongoing:            "Ongoing",
    completed:          "Completed",
    awaiting_balance:   "Awaiting Balance",
    fully_paid:         "Fully Paid",
    cancelled:          "Cancelled",
    rejected:           "Rejected",
    disputed:           "Disputed",
    resolved:           "Resolved",
    missed_by_patient:  "Missed - Rebook Available",
    missed_by_provider: "Provider Missed - Rebook Available",
    missed_by_both:     "Missed - Free Rebook Available",
};

const STATUS_BADGE = {
    pending_payment:  "badge-warning",
    deposit_paid:     "badge-info",
    accepted:         "badge-success",
    ongoing:          "badge-primary",
    awaiting_balance: "badge-warning",
    disputed:         "badge-error",
    completed:        "badge-ghost",
    fully_paid:       "badge-ghost",
    cancelled:        "badge-ghost",
    rejected:         "badge-error",
    resolved:         "badge-ghost",
    missed_by_patient: "badge-error",
    missed_by_provider: "badge-error",
    missed_by_both: "badge-error",
};

const UPCOMING_STATUSES = ["pending_payment", "deposit_paid", "accepted", "awaiting_balance", "disputed"];
const CLOSED_STATUSES   = ["completed", "fully_paid", "cancelled", "rejected", "resolved"];

const providerName = (appt) => {
    const d = appt.doctorId;
    const i = appt.instituteId;
    if (d && typeof d === "object") {
        return d.firstName ? `Dr. ${d.firstName} ${d.lastName}` : "Doctor";
    }
    if (i && typeof i === "object") {
        if (i.instituteName) return i.instituteName;
        if (i.departmentType?.name) return i.departmentType.name;
        if (i.technologistFirstName) return `${i.technologistFirstName} ${i.technologistLastName || ""}`.trim();
    }
    return "Provider";
};

const providerSubtitle = (appt) => {
    const i = appt.instituteId;
    if (i?.rootInstitute?.instituteName) return i.rootInstitute.instituteName;
    if (appt.serviceId?.name) return appt.serviceId.name;
    if (i?.departmentType?.name) return i.departmentType.name;
    if (appt.doctorId?.email) return appt.doctorId.email;
    return null;
};

const providerPic = (appt) =>
    appt.doctorId?.profilePic?.url || appt.instituteId?.profilePic?.url || null;

const ACTIVE_STATUSES = [
    "pending_payment", "deposit_paid", "accepted", "ongoing", "awaiting_balance",
    "disputed", "missed_by_patient", "missed_by_provider", "missed_by_both",
];

const CONFIRMED_STATUSES = ["accepted", "ongoing"];
const MISSED_REBOOK_STATUSES = ["missed_by_patient", "missed_by_provider", "missed_by_both"];

const isRebookActionAvailable = (appt) => {
    if (!MISSED_REBOOK_STATUSES.includes(appt?.status)) return false;
    if (appt.rebookUsed || appt.rebooked) return false;
    if (!appt.rebookDeadline) return true;
    return dayjs().tz(PH_TZ).isBefore(dayjs(appt.rebookDeadline));
};

const getAppointmentStatusLabel = (appt) => {
    if (appt?.rebooked && MISSED_REBOOK_STATUSES.includes(appt.status)) return "Rebooked";
    if (MISSED_REBOOK_STATUSES.includes(appt?.status) && !isRebookActionAvailable(appt)) return "Missed - Rebook Closed";
    return STATUS_LABEL[appt?.status] || appt?.status;
};

const AppointmentSummaryBar = ({ label, appointment, getName, emptyText }) => (
    <div className="rounded-xl border-2 border-base-300 bg-base-100 px-4 py-3 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_6px_18px_rgba(15,23,42,0.16)]">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        {appointment ? (
            <div className="mt-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                <p className="font-semibold">{getName(appointment)}</p>
                <p className="text-sm opacity-70">{dayjs(appointment.start).tz(PH_TZ).format("ddd, MMM D, YYYY [at] h:mm A")}</p>
            </div>
        ) : (
            <p className="mt-1 text-sm opacity-50">{emptyText}</p>
        )}
    </div>
);

const providerLinkId = (appt) =>
    appt.doctorId?._id || appt.instituteId?._id || null;

const AppointmentCard = ({ appt, onClick }) => {
    const name = providerName(appt);
    const subtitle = providerSubtitle(appt);
    const pic = providerPic(appt);
    const pid = providerLinkId(appt);
    const start = dayjs(appt.start).tz(PH_TZ);
    const isOngoing = appt.status === "ongoing";

    return (
        <div
            className={`card border cursor-pointer hover:border-primary/40 transition-colors ${isOngoing ? "bg-primary/5 border-primary/30" : "bg-base-100 border-base-300"}`}
            onClick={() => onClick(appt)}
        >
            <div className="card-body p-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="shrink-0">
                            {pic ? (
                                <img src={pic} alt={name} className="w-10 h-10 rounded-full object-cover" />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-base-300 flex items-center justify-center">
                                    <UserIcon className="size-4 text-base-content/40" />
                                </div>
                            )}
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-semibold text-sm truncate">{name}</p>
                                {pid && (
                                    <Link
                                        to={`/profile/${pid}`}
                                        className="text-xs text-primary hover:underline shrink-0"
                                        onClick={e => e.stopPropagation()}
                                    >
                                        View Profile
                                    </Link>
                                )}
                            </div>
                            {subtitle && <p className="text-xs opacity-60 truncate">{subtitle}</p>}
                            <p className="text-xs opacity-50 mt-0.5">
                                {start.format("ddd, MMM D, YYYY")}
                                {appt.status !== "pending_payment" && ` · ${start.format("h:mm A")}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`badge badge-sm ${STATUS_BADGE[appt.status] || "badge-ghost"}`}>
                            {getAppointmentStatusLabel(appt)}
                        </span>
                        {appt.amount != null && (
                            <span className="text-xs opacity-60">PHP {appt.amount.toLocaleString("en-PH")}</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SectionHeader = ({ icon: Icon, label, count }) => (
    <div className="flex items-center gap-2 mt-2">
        <Icon className="size-4 opacity-50" />
        <span className="text-xs font-semibold uppercase tracking-wide opacity-50">{label}</span>
        {count > 0 && <span className="badge badge-xs badge-ghost">{count}</span>}
    </div>
);

const AppointmentsBody = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState("active");

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get("/booking/my-appointments");
            const appts = res.data.data?.appointments;
            setAppointments(Array.isArray(appts) ? appts : []);
        } catch {
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAppointments(); }, []);

    const active = appointments
        .filter(a => ACTIVE_STATUSES.includes(a.status))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    
    const past = appointments
        .filter(a => CLOSED_STATUSES.includes(a.status))
        .sort((a, b) => new Date(b.start) - new Date(a.start));

    const shown = tab === "active" ? active : past;

    const futureAppointments = appointments
        .filter(a => ACTIVE_STATUSES.includes(a.status) && dayjs(a.start).tz(PH_TZ).isAfter(dayjs().tz(PH_TZ).subtract(1, "minute")))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const confirmedAppointment    = futureAppointments.find(a => CONFIRMED_STATUSES.includes(a.status));
    const upcomingAppointment     = futureAppointments[0];
    const missedRebookAppointment = active.find(isRebookActionAvailable);

    const missedRebookCopy = (appt) => {
        if (!appt) return null;
        const deadline = appt.rebookDeadline
            ? dayjs(appt.rebookDeadline).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")
            : "within 3 days";
        if (appt.status === "missed_by_patient") {
            const fee = Math.round((appt.amount || 0) * 0.1 * 100) / 100;
            return `Pay a rebooking fee of ₱${fee.toLocaleString("en-PH", { minimumFractionDigits: 2 })} and rebook once by ${deadline}.`;
        }
        if (appt.status === "missed_by_provider") {
            const cashback = appt.cashbackAmount ?? Math.round((appt.amount || 0) * 0.1 * 100) / 100;
            return `You have ₱${cashback.toLocaleString("en-PH", { minimumFractionDigits: 2 })} mock cashback and can rebook once for free by ${deadline}.`;
        }
        return `Both parties missed this appointment. Rebook once for free by ${deadline}.`;
    };

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold">My Appointments</h1>
                    <p className="text-sm opacity-50">{appointments.length} total</p>
                </div>
                <Link to="/search" className="btn btn-primary btn-sm gap-2">
                    <SearchIcon className="size-4" /> Find a Doctor
                </Link>
            </div>

            <div className="space-y-3">
                {missedRebookAppointment && (
                    <button
                        type="button"
                        onClick={() => setSelected(missedRebookAppointment)}
                        className="w-full rounded-xl border-2 border-error/40 bg-error/10 px-4 py-3 text-left shadow-[0_0_0_1px_rgba(239,68,68,0.14),0_8px_22px_rgba(127,29,29,0.20)] hover:bg-error/15 hover:border-error/60 transition-all"
                    >
                        <div className="flex items-start gap-3">
                            <AlertTriangleIcon className="size-5 text-error shrink-0 mt-0.5" />
                            <div className="min-w-0">
                                <p className="font-bold text-error">Rebook missed appointment?</p>
                                <p className="text-sm opacity-80 mt-0.5">{missedRebookCopy(missedRebookAppointment)}</p>
                                <p className="text-xs font-semibold text-error mt-2">Click to review details and choose a new schedule.</p>
                            </div>
                        </div>
                    </button>
                )}
                {confirmedAppointment && (
                    <AppointmentSummaryBar
                        label="Today's Appointment"
                        appointment={confirmedAppointment}
                        getName={providerName}
                        emptyText="No confirmed appointment yet."
                    />
                )}
                {upcomingAppointment && upcomingAppointment !== confirmedAppointment && (
                    <AppointmentSummaryBar
                        label="Upcoming Appointment"
                        appointment={upcomingAppointment}
                        getName={providerName}
                        emptyText="No upcoming appointment scheduled."
                    />
                )}
            </div>

            <div role="tablist" className="tabs tabs-bordered">
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "active" ? "tab-active" : ""}`}
                    onClick={() => setTab("active")}
                >
                    <CalendarIcon className="size-4" /> Active
                    {active.length > 0 && <span className="badge badge-info badge-xs">{active.length}</span>}
                </button>
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "past" ? "tab-active" : ""}`}
                    onClick={() => setTab("past")}
                >
                    <ArchiveIcon className="size-4" /> History
                    {past.length > 0 && <span className="badge badge-ghost badge-xs">{past.length}</span>}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : shown.length === 0 ? (
                <div className="text-center py-16 opacity-50 space-y-3">
                    {tab === "active" ? (
                        <>
                            <CalendarIcon className="size-12 mx-auto" />
                            <p>No active appointments.</p>
                            <Link to="/search" className="btn btn-primary btn-sm gap-2">
                                <SearchIcon className="size-4" /> Find a Doctor
                            </Link>
                        </>
                    ) : (
                        <>
                            <HistoryIcon className="size-12 mx-auto mb-3" />
                            <p>No past appointments.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {shown.map(appt => (
                        <AppointmentCard key={appt._id} appt={appt} onClick={setSelected} />
                    ))}
                </div>
            )}

            {selected && (
                <Suspense fallback={null}>
                    <ViewPendingAppointmentPatientPopup
                        appointment={selected}
                        onClose={() => setSelected(null)}
                        onUpdated={fetchAppointments}
                    />
                </Suspense>
            )}
        </div>
    );
};

const PatientAppointmentsPage = () => (
    <AppointmentsErrorBoundary>
        <AppointmentsBody />
    </AppointmentsErrorBoundary>
);

export default PatientAppointmentsPage;
