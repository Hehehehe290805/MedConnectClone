import { useState, useCallback, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { ActivityIcon, ClockIcon, PlusIcon, LightbulbIcon, Trash2Icon, XIcon, CalendarIcon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";
import toast from "react-hot-toast";
import ClaimServicesPopup from "../components/ClaimServicesPopup";
import SuggestServicePopup from "../components/SuggestServicePopup";
import SetSchedulePopup from "./SetSchedulePopup";

const DAYS_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const ServicesPage = () => {
    const [services, setServices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [showClaim, setShowClaim] = useState(false);
    const [showSuggest, setShowSuggest] = useState(false);
    const [deleting, setDeleting] = useState(null);
    const [schedule, setSchedule] = useState(null);
    const [scheduleLoading, setScheduleLoading] = useState(true);
    const [showSchedule, setShowSchedule] = useState(false);

    const verified = services.filter(s => s.status === "verified");
    const pending = services.filter(s => s.status === "pending");
    const rejected = services.filter(s => s.status === "rejected");

    const fetchServices = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get("/services/my-services");
            setServices(res.data.data?.services || []);
        } catch {
            toast.error("Failed to load services.");
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchSchedule = useCallback(async () => {
        setScheduleLoading(true);
        try {
            const res = await axiosInstance.get("/doctor-schedule/get-availability");
            setSchedule(res.data.data?.availability || null);
        } catch {
            setSchedule(null);
        } finally {
            setScheduleLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchServices();
        fetchSchedule();
    }, [fetchServices, fetchSchedule]);

    const handleDelete = async (claimId, name) => {
        setDeleting(claimId);
        try {
            await axiosInstance.delete(`/services/claim/${claimId}`);
            toast.success(`"${name}" removed.`);
            fetchServices();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove.");
        } finally {
            setDeleting(null);
        }
    };

    const handleClaimClose = () => { setShowClaim(false); fetchServices(); };
    const handleSuggestClose = () => { setShowSuggest(false); fetchServices(); };

    const statusColor = (status) => {
        if (status === "verified") return "bg-success/10 text-success";
        if (status === "pending") return "bg-warning/10 text-warning";
        return "bg-error/10 text-error";
    };

    const Column = ({ title, items, emptyText }) => (
        <div className="flex-1 min-w-0 bg-base-200 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-3">{title}</p>
            {loading ? (
                <div className="flex justify-center py-4">
                    <span className="loading loading-spinner loading-sm" />
                </div>
            ) : items.length === 0 ? (
                <p className="text-sm opacity-40 text-center py-4">{emptyText}</p>
            ) : (
                items.map(item => (
                    <div
                        key={item._id}
                        className="flex items-center justify-between bg-base-100 rounded-lg px-3 py-3 gap-2 shadow-sm"
                    >
                        <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2 rounded-lg shrink-0 ${statusColor(item.status)}`}>
                                {item.status === "pending"
                                    ? <ClockIcon className="w-4 h-4" />
                                    : <ActivityIcon className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm font-semibold truncate">
                                    {item.serviceId?.name || "Unknown Service"}
                                </p>
                                {item.durationMinutes && (
                                    <p className="text-xs opacity-60">{item.durationMinutes} min</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <span className={`badge badge-sm ${
                                item.status === "verified" ? "badge-success"
                                : item.status === "pending" ? "badge-warning"
                                : "badge-error"
                            }`}>
                                {item.status}
                            </span>
                            {showEdit && (
                                <button
                                    className="btn btn-ghost btn-xs text-error"
                                    onClick={() => handleDelete(item._id, item.serviceId?.name)}
                                    disabled={deleting === item._id}
                                >
                                    {deleting === item._id
                                        ? <span className="loading loading-spinner loading-xs" />
                                        : <Trash2Icon className="size-3" />}
                                </button>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">My Services</h1>
                <p className="text-sm opacity-70 mt-1">Manage the services offered by your department.</p>
            </div>

            {/* Schedule setup card */}
            {scheduleLoading ? (
                <div className="flex items-center gap-2 text-sm opacity-50">
                    <span className="loading loading-spinner loading-xs" /> Checking schedule…
                </div>
            ) : !schedule || !schedule.isActive ? (
                <div className="alert alert-warning rounded-xl">
                    <AlertTriangleIcon className="w-5 h-5 shrink-0" />
                    <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">No active schedule set</p>
                        <p className="text-xs opacity-80">Patients cannot book your services until you set your availability.</p>
                    </div>
                    <button className="btn btn-sm btn-warning" onClick={() => setShowSchedule(true)}>
                        <CalendarIcon className="w-4 h-4" /> Set Schedule
                    </button>
                </div>
            ) : (
                <div className="bg-base-200 rounded-xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-success/10 text-success">
                            <CheckCircleIcon className="w-5 h-5" />
                        </div>
                        <div>
                            <p className="font-semibold text-sm">Schedule Active</p>
                            <p className="text-xs opacity-60">
                                {DAYS_LABEL.filter((_, i) => schedule.daysOfWeek?.includes(i)).join(", ")}
                                {" · "}
                                {schedule.startHour} – {schedule.endHour}
                            </p>
                        </div>
                    </div>
                    <button className="btn btn-sm btn-outline gap-1" onClick={() => setShowSchedule(true)}>
                        <CalendarIcon className="w-4 h-4" /> Edit Schedule
                    </button>
                </div>
            )}

            <div className="flex flex-col md:flex-row gap-4 items-start">
                <Column
                    title="Approved Services"
                    items={verified}
                    emptyText="No approved services yet"
                />
                <Column
                    title="Pending Approvals"
                    items={pending}
                    emptyText="No pending services"
                />
                {rejected.length > 0 && (
                    <Column
                        title="Rejected"
                        items={rejected}
                        emptyText="No rejected services"
                    />
                )}
            </div>

            <div className="flex gap-3">
                {!showEdit ? (
                    <button className="btn btn-primary" onClick={() => setShowEdit(true)}>
                        Manage Services
                    </button>
                ) : (
                    <div className="w-full bg-base-200 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold">Manage Services</p>
                            <button
                                className="btn btn-ghost btn-sm btn-circle"
                                onClick={() => setShowEdit(false)}
                            >
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <button
                                className="btn btn-outline btn-sm gap-1"
                                onClick={() => setShowClaim(true)}
                            >
                                <PlusIcon className="size-3" /> Claim Existing
                            </button>
                            <button
                                className="btn btn-outline btn-sm gap-1"
                                onClick={() => setShowSuggest(true)}
                            >
                                <LightbulbIcon className="size-3" /> Suggest New
                            </button>
                        </div>
                        <p className="text-xs opacity-50">
                            To remove a service, click the <Trash2Icon className="size-3 inline" /> icon on its card above.
                        </p>
                    </div>
                )}
            </div>

            {showClaim && <ClaimServicesPopup onClose={handleClaimClose} />}
            {showSuggest && <SuggestServicePopup onClose={handleSuggestClose} />}
            {showSchedule && (
                <SetSchedulePopup
                    currentSchedule={schedule}
                    onClose={() => setShowSchedule(false)}
                    onScheduleSet={(newSchedule) => {
                        setSchedule(newSchedule);
                        setShowSchedule(false);
                    }}
                />
            )}
        </div>
    );
};

export default ServicesPage;
