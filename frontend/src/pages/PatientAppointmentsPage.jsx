import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { Link } from "react-router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { AlertTriangleIcon, CalendarIcon, UserIcon, SearchIcon } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

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
    missed_by_patient: "Missed - Rebook Available",
    missed_by_provider: "Provider Missed - Rebook Available",
    missed_by_both: "Missed - Free Rebook Available",
};

const ACTIVE_STATUSES = ["pending_payment", "deposit_paid", "accepted", "ongoing", "awaiting_balance", "disputed", "missed_by_patient", "missed_by_provider", "missed_by_both"];
const CLOSED_STATUSES = ["completed", "fully_paid", "cancelled", "rejected", "resolved"];
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

const PatientAppointmentsPage = () => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState("active");

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get("/booking/my-appointments");
            const appts = res.data.data?.appointments;
            if (res.data.success && Array.isArray(appts)) {
                // Active first, then sort by start time within each group
                const active = appts.filter(a => ACTIVE_STATUSES.includes(a.status)).sort((a, b) => new Date(a.start) - new Date(b.start));
                const past = appts.filter(a => CLOSED_STATUSES.includes(a.status)).sort((a, b) => new Date(b.start) - new Date(a.start));
                setAppointments([...active, ...past]);
            } else {
                setAppointments([]);
            }
        } catch {
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAppointments(); }, []);

    const active = appointments.filter(a => ACTIVE_STATUSES.includes(a.status)).sort((a, b) => new Date(a.start) - new Date(b.start));
    const past = appointments.filter(a => CLOSED_STATUSES.includes(a.status)).sort((a, b) => new Date(b.start) - new Date(a.start));
    const shown = tab === "active" ? active : past;
    const futureAppointments = appointments
        .filter(a => ACTIVE_STATUSES.includes(a.status) && dayjs(a.start).tz(PH_TZ).isAfter(dayjs().tz(PH_TZ).subtract(1, "minute")))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const confirmedAppointment = futureAppointments.find(a => CONFIRMED_STATUSES.includes(a.status));
    const upcomingAppointment = futureAppointments[0];
    const missedRebookAppointment = active.find(isRebookActionAvailable);

    const doctorName = (appt) => {
        const d = appt.doctorId;
        if (!d) return appt.instituteId?.instituteName || "Provider";
        if (typeof d === "object" && d.firstName) return `Dr. ${d.firstName} ${d.lastName}`;
        return "Doctor";
    };

    const providerId = (appt) => {
        const d = appt.doctorId;
        const i = appt.instituteId;
        return typeof d === "object" ? d._id : (typeof i === "object" ? i._id : null);
    };

    const providerPic = (appt) => {
        return appt.doctorId?.profilePic?.url || appt.instituteId?.profilePic?.url || null;
    };

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
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
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
                <AppointmentSummaryBar
                    label="Today's Appointment"
                    appointment={confirmedAppointment}
                    getName={doctorName}
                    emptyText="No confirmed appointment yet."
                />
                <AppointmentSummaryBar
                    label="Upcoming Appointment"
                    appointment={upcomingAppointment}
                    getName={doctorName}
                    emptyText="No upcoming appointment scheduled."
                />
            </div>

            <div role="tablist" className="tabs tabs-bordered">
                <button role="tab" className={`tab gap-2 ${tab === "active" ? "tab-active" : ""}`} onClick={() => setTab("active")}>
                    <CalendarIcon className="size-4" /> Active
                    {active.length > 0 && <span className="badge badge-error badge-xs text-white">{active.length}</span>}
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "past" ? "tab-active" : ""}`} onClick={() => setTab("past")}>
                    History
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : shown.length === 0 ? (
                <div className="text-center py-16 opacity-50">
                    <CalendarIcon className="size-12 mx-auto mb-3" />
                    <p className="mb-4">{tab === "active" ? "No active appointments." : "No past appointments."}</p>
                    {tab === "active" && (
                        <Link to="/search" className="btn btn-primary btn-sm gap-2">
                            <SearchIcon className="size-4" /> Find a Doctor
                        </Link>
                    )}
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map(appt => {
                        const name = doctorName(appt);
                        const pid = providerId(appt);
                        const pic = providerPic(appt);
                        const start = dayjs(appt.start).tz(PH_TZ);
                        return (
                            <div
                                key={appt._id}
                                className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)] cursor-pointer hover:border-primary/40 hover:shadow-[0_0_0_2px_rgba(47,112,186,0.18),0_12px_30px_rgba(15,23,42,0.24)] transition-all"
                                onClick={() => setSelected(appt)}
                            >
                                <div className="card-body p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="avatar placeholder shrink-0">
                                                <div className="bg-base-300 rounded-full w-9">
                                                    {pic ? (
                                                        <img src={pic} alt={name} className="rounded-full" />
                                                    ) : (
                                                        <UserIcon className="size-4 text-base-content/40 mx-auto mt-2.5" />
                                                    )}
                                                </div>
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
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
                                                <p className="text-xs opacity-60">{start.format("ddd, MMM D, YYYY · h:mm A")}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            {appt.amount != null && (
                                                <span className="text-sm opacity-70">₱{appt.amount.toLocaleString("en-PH")}</span>
                                            )}
                                            <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">{getAppointmentStatusLabel(appt)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {selected && (
                <ViewPendingAppointmentPatientPopup
                    appointment={selected}
                    onClose={() => setSelected(null)}
                    onUpdated={fetchAppointments}
                />
            )}
        </div>
    );
};

export default PatientAppointmentsPage;
