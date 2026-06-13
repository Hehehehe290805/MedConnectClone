import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { Link } from "react-router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { CalendarIcon, UserIcon, SearchIcon, ClockIcon, CheckCircleIcon, HistoryIcon } from "lucide-react";

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
        if (i.technologistFirstName) return `${i.technologistFirstName} ${i.technologistLastName || ""}`.trim();
        if (i.departmentType?.name) return i.departmentType.name;
    }
    return "Provider";
};

const providerSubtitle = (appt) => {
    const i = appt.instituteId;
    if (appt.serviceId?.name) return appt.serviceId.name;
    if (i?.departmentType?.name) return i.departmentType.name;
    if (appt.doctorId?.email) return appt.doctorId.email;
    return null;
};

const providerPic = (appt) =>
    appt.doctorId?.profilePic?.url || appt.instituteId?.profilePic?.url || null;

const AppointmentCard = ({ appt, onClick }) => {
    const name = providerName(appt);
    const subtitle = providerSubtitle(appt);
    const pic = providerPic(appt);
    const start = dayjs(appt.start).tz(PH_TZ);
    const isOngoing = appt.status === "ongoing";

    return (
        <div
            className={`card border cursor-pointer hover:border-primary/40 transition-colors ${
                isOngoing ? "bg-primary/5 border-primary/30" : "bg-base-100 border-base-300"
            }`}
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
                            <p className="font-semibold text-sm truncate">{name}</p>
                            {subtitle && <p className="text-xs opacity-60 truncate">{subtitle}</p>}
                            <p className="text-xs opacity-50 mt-0.5">
                                {start.format("ddd, MMM D, YYYY")}
                                {appt.status !== "pending_payment" && ` · ${start.format("h:mm A")}`}
                            </p>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                        <span className={`badge badge-sm ${STATUS_BADGE[appt.status] || "badge-ghost"}`}>
                            {STATUS_LABEL[appt.status] || appt.status}
                        </span>
                        {appt.amount != null && (
                            <span className="text-xs opacity-60">₱{appt.amount.toLocaleString("en-PH")}</span>
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
                setAppointments(appts);
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

    const ongoing  = appointments.filter(a => a.status === "ongoing")
                                 .sort((a, b) => new Date(a.start) - new Date(b.start));
    const upcoming = appointments.filter(a => UPCOMING_STATUSES.includes(a.status))
                                 .sort((a, b) => new Date(a.start) - new Date(b.start));
    const past     = appointments.filter(a => CLOSED_STATUSES.includes(a.status))
                                 .sort((a, b) => new Date(b.start) - new Date(a.start));

    const activeCount = ongoing.length + upcoming.length;

    return (
        <div className="p-4 sm:p-8 max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">My Appointments</h1>
                    <p className="text-sm opacity-50">{appointments.length} total</p>
                </div>
                <Link to="/search" className="btn btn-primary btn-sm gap-2">
                    <SearchIcon className="size-4" /> Find a Doctor
                </Link>
            </div>

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-bordered">
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "active" ? "tab-active" : ""}`}
                    onClick={() => setTab("active")}
                >
                    <CalendarIcon className="size-4" /> Active
                    {activeCount > 0 && <span className="badge badge-info badge-xs">{activeCount}</span>}
                </button>
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "past" ? "tab-active" : ""}`}
                    onClick={() => setTab("past")}
                >
                    <HistoryIcon className="size-4" /> History
                    {past.length > 0 && <span className="badge badge-ghost badge-xs">{past.length}</span>}
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : tab === "active" ? (
                activeCount === 0 ? (
                    <div className="text-center py-16 opacity-50 space-y-3">
                        <CalendarIcon className="size-12 mx-auto" />
                        <p>No active appointments.</p>
                        <Link to="/search" className="btn btn-primary btn-sm gap-2">
                            <SearchIcon className="size-4" /> Find a Doctor
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ongoing.length > 0 && (
                            <>
                                <SectionHeader icon={ClockIcon} label="Ongoing" count={ongoing.length} />
                                {ongoing.map(appt => (
                                    <AppointmentCard key={appt._id} appt={appt} onClick={setSelected} />
                                ))}
                            </>
                        )}
                        {upcoming.length > 0 && (
                            <>
                                <SectionHeader icon={CalendarIcon} label="Upcoming" count={upcoming.length} />
                                {upcoming.map(appt => (
                                    <AppointmentCard key={appt._id} appt={appt} onClick={setSelected} />
                                ))}
                            </>
                        )}
                    </div>
                )
            ) : (
                past.length === 0 ? (
                    <div className="text-center py-16 opacity-50">
                        <HistoryIcon className="size-12 mx-auto mb-3" />
                        <p>No past appointments.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <SectionHeader icon={CheckCircleIcon} label="Past Appointments" count={past.length} />
                        {past.map(appt => (
                            <AppointmentCard key={appt._id} appt={appt} onClick={setSelected} />
                        ))}
                    </div>
                )
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