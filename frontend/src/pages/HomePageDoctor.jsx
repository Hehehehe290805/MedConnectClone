import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios.js";
import AppointmentCalendar from "../components/AppointmentCalendar.jsx";
import ViewPendingAppointmentDoctorPopup from "./ViewPendingAppointmentDoctorPopup.jsx";
import SetPricePopup from "./SetPricePopup.jsx";
import SetSchedulePopup from "./SetSchedulePopup.jsx";
import toast from "react-hot-toast";
import { ClockIcon, CheckCircleIcon, AlertTriangleIcon, VideoIcon, UsersIcon, UserPlusIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import QueuePanel from "../components/QueuePanel";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";
const REBOOKABLE_STATUSES = ["missed_by_patient", "missed_by_provider", "missed_by_both"];
const isRebookApprovalRequest = (appt) =>
    Boolean(appt?.rebooked && REBOOKABLE_STATUSES.includes(appt.status));
const profileReadyStorageKey = (doctorId) => `medconnect:doctor-profile-ready-confirmed:${doctorId || "unknown"}`;

const HomePageDoctor = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";

    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const appointmentsLoadedRef = useRef(false);

    const [currentPrice, setCurrentPrice] = useState(null);
    const [priceLoading, setPriceLoading] = useState(false);
    const [workTime, setWorkTime] = useState(null);
    const [currentSchedule, setCurrentSchedule] = useState(null);
    const [showPricePopup, setShowPricePopup] = useState(false);
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);
    const [maxPatients, setMaxPatients] = useState(null);
    const [maxPatientsInput, setMaxPatientsInput] = useState("");
    const [showMaxPatients, setShowMaxPatients] = useState(false);
    const [savingMaxPatients, setSavingMaxPatients] = useState(false);
    const [showWalkinForm, setShowWalkinForm] = useState(false);
    const [profileReadyConfirmed, setProfileReadyConfirmed] = useState(false);

    useEffect(() => {
        fetchAppointments();
        fetchCurrentSchedule();
        fetchCurrentPrice();
        axiosInstance.get("/auth/me").then(r => {
            const val = r.data.data?.maxPatientsPerDay ?? null;
            setMaxPatients(val);
            setMaxPatientsInput(val != null ? String(val) : "");
        }).catch(() => {});

        const id = setInterval(fetchAppointments, 30_000);
        return () => clearInterval(id);
    }, []);

    useEffect(() => {
        if (!authUser?._id) return;
        setProfileReadyConfirmed(localStorage.getItem(profileReadyStorageKey(authUser._id)) === "true");
    }, [authUser?._id]);

    const fetchAppointments = async () => {
        try {
            if (!appointmentsLoadedRef.current) setLoading(true);
            setError(null);
            const res = await axiosInstance.get("/booking/my-appointments");
            const appts = res.data.data?.appointments;
            if (res.data.success && Array.isArray(appts)) {
                setAppointments(appts.sort((a, b) => new Date(a.start) - new Date(b.start)));
            } else {
                setAppointments([]);
            }
        } catch {
            setError("Failed to load appointments.");
            setAppointments([]);
        } finally {
            appointmentsLoadedRef.current = true;
            setLoading(false);
        }
    };

    const fetchCurrentPrice = async () => {
        try {
            const res = await axiosInstance.get("/pricing/appointment-price");
            setCurrentPrice(res.data.data?.pricing?.[0]?.price ?? null);
        } catch {
            toast.error("Failed to fetch current price");
        }
    };

    const fetchCurrentSchedule = async () => {
        try {
            const res = await axiosInstance.get("/doctor-schedule/get-availability");
            const avail = res.data.data?.availability;
            if (res.data.success && avail) {
                setCurrentSchedule(avail);
                setWorkTime(formatScheduleDisplay(avail));
            } else {
                setWorkTime(null);
            }
        } catch {
            setWorkTime("Unset");
        }
    };

    const formatTimeDisplay = (time) => {
        if (!time) return "";
        const [hours, minutes] = time.split(":");
        const hour = parseInt(hours);
        return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? "PM" : "AM"}`;
    };

    const DAY_ABBRS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const formatScheduleDisplay = (schedule) => {
        if (!schedule) return null;
        return {
            time: `${formatTimeDisplay(schedule.startHour)} – ${formatTimeDisplay(schedule.endHour)}`,
            days: schedule.daysOfWeek?.map(d => DAY_ABBRS[d]).join(", ") || "No days",
        };
    };

    const handlePriceSet = (newPrice) => {
        setCurrentPrice(newPrice);
        toast.success(`Price updated to ₱${newPrice}`);
        // Re-fetch to confirm DB value is in sync
        fetchCurrentPrice();
    };

    const handleScheduleSet = (availability) => {
        if (availability) {
            setCurrentSchedule(availability);
            setWorkTime(formatScheduleDisplay(availability));
        }
        fetchCurrentSchedule();
    };

    const saveMaxPatients = async () => {
        const val = maxPatientsInput.trim() === "" ? null : parseInt(maxPatientsInput, 10);
        if (val !== null && (isNaN(val) || val < 1)) {
            toast.error("Max patients must be a positive number.");
            return;
        }
        try {
            setSavingMaxPatients(true);
            await axiosInstance.patch("/auth/update-profile", { maxPatientsPerDay: val });
            setMaxPatients(val);
            setShowMaxPatients(false);
            toast.success(val == null ? "Max patients limit removed." : `Max patients set to ${val}.`);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to save.");
        } finally {
            setSavingMaxPatients(false);
        }
    };

    const profileReady = currentPrice !== null && workTime !== null;
    const calendarAppointments = appointments.filter((appt) =>
        !["pending_payment", "deposit_paid"].includes(appt.status) && !isRebookApprovalRequest(appt)
    );

    const confirmProfileReady = () => {
        if (authUser?._id) {
            localStorage.setItem(profileReadyStorageKey(authUser._id), "true");
        }
        setProfileReadyConfirmed(true);
        toast.success("Profile ready card dismissed.");
    };

    const joinCallAppt = appointments.find(a => {
        if (!a.virtual) return false;
        if (a.status === "ongoing") return true;
        if (a.status === "accepted") {
            const minsUntil = dayjs(a.start).tz(PH_TZ).diff(dayjs().tz(PH_TZ), "minute");
            return minsUntil <= 30 && minsUntil >= -5;
        }
        return false;
    });

    const doctorName = [authUser?.firstName, authUser?.lastName].filter(Boolean).join(" ") || "Doctor";

    return (
        <div className="p-8 space-y-6">
            {joinCallAppt && (
                <div className="alert bg-success/10 border border-success/30 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <VideoIcon className="size-5 text-success shrink-0" />
                        <div>
                            <p className="font-semibold">
                                {joinCallAppt.status === "ongoing"
                                    ? "A virtual appointment is in progress!"
                                    : "A virtual appointment starts soon!"}
                            </p>
                            <p className="text-sm opacity-70">
                                {dayjs(joinCallAppt.start).tz(PH_TZ).format("ddd, MMM D [at] h:mm A")}
                            </p>
                        </div>
                    </div>
                    <Link to={`/call/${joinCallAppt._id}`} className="btn btn-success btn-sm gap-2 shrink-0">
                        <VideoIcon className="size-4" /> Join Call
                    </Link>
                </div>
            )}

            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your account is pending approval</p>
                        <p className="text-sm opacity-70">
                            You can set up your schedule and pricing while you wait.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold">Hello, {doctorName}</h1>
            </div>

            <div className="space-y-6">
                    {/* Setup / status card */}
                    {currentPrice === null || workTime === null ? (
                        <div className="card bg-warning/5 border border-warning/20 p-4 rounded-xl">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-start gap-3">
                                    <AlertTriangleIcon className="size-5 text-warning mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold">Complete your account setup</p>
                                        <p className="text-sm opacity-70">
                                            {currentPrice === null && workTime === null
                                                ? "Set your consultation price and work schedule to start receiving bookings."
                                                : currentPrice === null
                                                    ? "Set your consultation price to start receiving bookings."
                                                    : "Set your work schedule to start receiving bookings."}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex gap-2 flex-wrap shrink-0">
                                    {currentPrice === null && (
                                        <button className="btn btn-warning btn-sm" onClick={() => setShowPricePopup(true)}>Set Price</button>
                                    )}
                                    {workTime === null && (
                                        <button className="btn btn-warning btn-sm" onClick={() => setShowSchedulePopup(true)}>Set Schedule</button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : !profileReadyConfirmed ? (
                        <div className="card bg-info/5 border border-info/20 p-4 rounded-xl">
                            <div className="flex items-center justify-between gap-4 flex-wrap">
                                <div className="flex items-center gap-3">
                                    <CheckCircleIcon className="size-5 text-info shrink-0" />
                                    <div>
                                        <p className="font-semibold">Profile Ready</p>
                                        <p className="text-sm opacity-70">Your profile is set up. Confirm this once to remove this reminder.</p>
                                    </div>
                                </div>
                                <button className="btn btn-primary btn-sm gap-2" onClick={confirmProfileReady}>
                                    <CheckCircleIcon className="size-4" />
                                    Confirm
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* Price + Schedule + Max Patients cards */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="card bg-base-100 border-2 border-base-300 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                            <h3 className="font-bold text-lg mb-2">Consultation Pricing</h3>
                            <div className="flex items-center justify-between">
                                <div>
                                    {priceLoading
                                        ? <span className="loading loading-spinner loading-sm" />
                                        : currentPrice
                                            ? <p className="text-xl font-semibold">₱{currentPrice}</p>
                                            : <p className="text-gray-500">No price set</p>
                                    }
                                </div>
                                <button className="btn btn-primary btn-sm" onClick={() => setShowPricePopup(true)} disabled={priceLoading}>
                                    {currentPrice ? "Update Price" : "Set Price"}
                                </button>
                            </div>
                        </div>
                        <div className="card bg-base-100 border-2 border-base-300 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                            <h3 className="font-bold text-lg mb-2">Work Schedule</h3>
                            <div className="flex items-center justify-between gap-3">
                                {workTime ? (
                                    <div className="text-sm space-y-0.5">
                                        <p className="font-medium">{workTime.time}</p>
                                        <p className="opacity-60">{workTime.days}</p>
                                    </div>
                                ) : (
                                    <p className="text-sm opacity-50">No schedule set</p>
                                )}
                                <button className="btn btn-primary btn-sm shrink-0" onClick={() => setShowSchedulePopup(true)}>
                                    {workTime ? "Update" : "Set Schedule"}
                                </button>
                            </div>
                        </div>
                        <div className="card bg-base-100 border-2 border-base-300 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                            <h3 className="font-bold text-lg mb-2">Max Patients Per Day</h3>
                            {!showMaxPatients ? (
                                <div className="flex items-center justify-between">
                                    <p className="text-sm opacity-70">
                                        {maxPatients != null ? `${maxPatients} patients/day limit` : "No limit set"}
                                    </p>
                                    <button className="btn btn-primary btn-sm" onClick={() => setShowMaxPatients(true)}>
                                        {maxPatients != null ? "Update" : "Set Limit"}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        className="input input-bordered input-sm flex-1"
                                        placeholder="e.g. 20 (leave blank for no limit)"
                                        value={maxPatientsInput}
                                        onChange={e => setMaxPatientsInput(e.target.value.replace(/[^0-9]/g, ""))}
                                    />
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowMaxPatients(false)}>Cancel</button>
                                    <button className="btn btn-primary btn-sm" disabled={savingMaxPatients} onClick={saveMaxPatients}>
                                        {savingMaxPatients ? <span className="loading loading-spinner loading-xs" /> : "Save"}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>

                    {error && <div className="alert alert-error"><span>{error}</span></div>}

                    {/* Queue section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <UsersIcon className="size-5 text-primary" />
                                <h3 className="font-semibold">Today's Queue</h3>
                            </div>
                            <button
                                className="btn btn-outline btn-sm gap-1"
                                onClick={() => setShowWalkinForm(v => !v)}
                            >
                                <UserPlusIcon className="size-3.5" /> Add Walk-In
                            </button>
                        </div>
                        <QueuePanel showWalkinForm={showWalkinForm} setShowWalkinForm={setShowWalkinForm} />
                    </div>

                    <AppointmentCalendar
                        appointments={calendarAppointments}
                        onViewDetails={setSelectedAppointment}
                        isLoading={loading}
                    />
            </div>

            {selectedAppointment && (
                <ViewPendingAppointmentDoctorPopup
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={fetchAppointments}
                />
            )}
            {showPricePopup && (
                <SetPricePopup onClose={() => setShowPricePopup(false)} onPriceSet={handlePriceSet} currentPrice={currentPrice} />
            )}
            {showSchedulePopup && (
                <SetSchedulePopup onClose={() => setShowSchedulePopup(false)} onScheduleSet={handleScheduleSet} currentSchedule={currentSchedule} />
            )}
        </div>
    );
};

export default HomePageDoctor;
