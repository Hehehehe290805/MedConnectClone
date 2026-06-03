import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import ViewPendingAppointmentPatientPopup from "./ViewPendingAppointmentPatientPopup.jsx";
import { Link } from "react-router";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { CalendarIcon, UserIcon, SearchIcon } from "lucide-react";

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

const ACTIVE_STATUSES = ["pending_payment", "deposit_paid", "accepted", "ongoing", "awaiting_balance", "disputed"];
const CLOSED_STATUSES = ["completed", "fully_paid", "cancelled", "rejected", "resolved"];

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

    const active = appointments.filter(a => ACTIVE_STATUSES.includes(a.status));
    const past = appointments.filter(a => CLOSED_STATUSES.includes(a.status));
    const shown = tab === "active" ? active : past;

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

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-2xl font-bold">My Appointments</h1>
                    <p className="text-sm opacity-50">{appointments.length} total</p>
                </div>
                <Link to="/search" className="btn btn-primary btn-sm gap-2">
                    <SearchIcon className="size-4" /> Find a Doctor
                </Link>
            </div>

            <div role="tablist" className="tabs tabs-bordered">
                <button role="tab" className={`tab gap-2 ${tab === "active" ? "tab-active" : ""}`} onClick={() => setTab("active")}>
                    <CalendarIcon className="size-4" /> Active
                    {active.length > 0 && <span className="badge badge-info badge-xs">{active.length}</span>}
                </button>
                <button role="tab" className={`tab gap-2 ${tab === "past" ? "tab-active" : ""}`} onClick={() => setTab("past")}>
                    History
                    {past.length > 0 && <span className="badge badge-ghost badge-xs">{past.length}</span>}
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
                                className="card bg-base-100 border border-base-300 cursor-pointer hover:border-primary/30 transition-colors"
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
                                            <span className="text-xs opacity-70">{STATUS_LABEL[appt.status] || appt.status}</span>
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
