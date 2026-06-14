import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import ViewPendingAppointmentDoctorPopup from "./ViewPendingAppointmentDoctorPopup.jsx";
import AppointmentFilesPanel from "../components/AppointmentFilesPanel.jsx";
import { Link, useNavigate } from "react-router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { CalendarIcon, UserIcon, MessageCircleIcon, PaperclipIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react";
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
};

const APPROVAL_STATUSES = ["deposit_paid"];
const ACTIVE_STATUSES = ["pending_payment", "deposit_paid", "accepted", "ongoing", "awaiting_balance", "disputed"];
const CONFIRMED_STATUSES = ["accepted", "ongoing"];
const CLOSED_STATUSES = ["completed", "fully_paid", "cancelled", "rejected", "resolved"];
const isApprovalRequest = (appt) => APPROVAL_STATUSES.includes(appt?.status);
const getAppointmentStatusLabel = (appt) => STATUS_LABEL[appt?.status] || appt?.status;
const CountPill = ({ children, active = false }) => (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${
        active
            ? "border-red-500 bg-red-500 text-white"
            : "border-base-300 bg-white text-slate-700"
    }`}>
        {children}
    </span>
);

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

const DoctorAppointmentsPage = () => {
    const navigate = useNavigate();
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [tab, setTab] = useState("active"); // "active" | "past"
    const [expandedFiles, setExpandedFiles] = useState(new Set());

    const toggleFiles = (e, apptId) => {
        e.stopPropagation();
        setExpandedFiles(prev => {
            const next = new Set(prev);
            next.has(apptId) ? next.delete(apptId) : next.add(apptId);
            return next;
        });
    };

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            const res = await axiosInstance.get("/booking/my-appointments");
            const appts = res.data.data?.appointments;
            if (res.data.success && Array.isArray(appts)) {
                setAppointments(appts.sort((a, b) => new Date(a.start) - new Date(b.start)));
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

    const active = appointments.filter(isApprovalRequest).sort((a, b) => new Date(a.start) - new Date(b.start));
    const past = appointments.filter(a => CLOSED_STATUSES.includes(a.status)).sort((a, b) => new Date(b.start) - new Date(a.start));
    const shown = tab === "active" ? active : past;
    const futureAppointments = appointments
        .filter(a => ACTIVE_STATUSES.includes(a.status) && dayjs(a.start).tz(PH_TZ).isAfter(dayjs().tz(PH_TZ).subtract(1, "minute")))
        .sort((a, b) => new Date(a.start) - new Date(b.start));
    const confirmedAppointment = futureAppointments.find(a => CONFIRMED_STATUSES.includes(a.status));
    const upcomingAppointment = futureAppointments[0];

    const patientName = (appt) => {
        const p = appt.patientId;
        if (!p) return "Patient";
        if (typeof p === "object" && p.firstName) return `${p.firstName} ${p.lastName}`;
        return "Patient";
    };

    const patientId = (appt) => {
        const p = appt.patientId;
        return typeof p === "object" ? p._id : p;
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Appointments</h1>
            </div>

            <div className="space-y-3">
                <AppointmentSummaryBar
                    label="Today's Appointment"
                    appointment={confirmedAppointment}
                    getName={patientName}
                    emptyText="No confirmed appointment yet."
                />
                <AppointmentSummaryBar
                    label="Upcoming Appointment"
                    appointment={upcomingAppointment}
                    getName={patientName}
                    emptyText="No upcoming appointment scheduled."
                />
            </div>

            <div role="tablist" className="tabs tabs-bordered">
                <button role="tab" className={`tab gap-2 ${tab === "active" ? "tab-active" : ""}`} onClick={() => setTab("active")}>
                    <CalendarIcon className="size-4" />Approval Requests
                    {active.length > 0 && <CountPill active>{active.length}</CountPill>}
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
                    <p>{tab === "active" ? "No appointment approval requests." : "No past appointments."}</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {shown.map(appt => {
                        const name = patientName(appt);
                        const pid = patientId(appt);
                        const start = dayjs(appt.start).tz(PH_TZ);
                        return (
                            <div
                                key={appt._id}
                                className="card bg-base-100 border border-base-300 cursor-pointer hover:border-primary/30 transition-colors"
                                onClick={() => setSelected(appt)}
                            >
                                <div className="card-body p-4">
                                    <div className="flex items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="avatar placeholder shrink-0">
                                                <div className="bg-base-300 rounded-full w-9">
                                                    {appt.patientId?.profilePic?.url ? (
                                                        <img src={appt.patientId.profilePic.url} alt={name} className="rounded-full" />
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
                                            <span className="text-xs opacity-70">{getAppointmentStatusLabel(appt)}</span>
                                            {ACTIVE_STATUSES.includes(appt.status) && patientId(appt) && (
                                                <button
                                                    className="btn btn-ghost btn-xs btn-circle"
                                                    title="Open chat"
                                                    onClick={e => { e.stopPropagation(); navigate(`/chat/${patientId(appt)}`); }}
                                                >
                                                    <MessageCircleIcon className="size-4" />
                                                </button>
                                            )}
                                            <button
                                                className="btn btn-ghost btn-xs gap-1"
                                                title="Appointment files"
                                                onClick={e => toggleFiles(e, appt._id)}
                                            >
                                                <PaperclipIcon className="size-3.5" />
                                                {expandedFiles.has(appt._id) ? <ChevronUpIcon className="size-3" /> : <ChevronDownIcon className="size-3" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                                {expandedFiles.has(appt._id) && (
                                    <div className="px-4 pb-4 border-t border-base-300 mt-2 pt-3" onClick={e => e.stopPropagation()}>
                                        <AppointmentFilesPanel appointmentId={appt._id} participantRole="doctor" />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {selected && (
                <ViewPendingAppointmentDoctorPopup
                    appointment={selected}
                    onClose={() => setSelected(null)}
                    onUpdated={fetchAppointments}
                />
            )}
        </div>
    );
};

export default DoctorAppointmentsPage;
