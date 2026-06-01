import { useEffect, useState } from "react";
import { axiosInstance } from "../lib/axios.js";
import PendingAppointment from "../components/PendingAppointment.jsx";
import ViewPendingAppointmentDoctorPopup from "./ViewPendingAppointmentDoctorPopup.jsx";
import SetPricePopup from "./SetPricePopup.jsx";
import SetSchedulePopup from "./SetSchedulePopup.jsx";
import toast from "react-hot-toast";
import { ClockIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";

const HomePageDoctor = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";

    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [currentPrice, setCurrentPrice] = useState(null);
    const [priceLoading, setPriceLoading] = useState(false);
    const [workTime, setWorkTime] = useState(null);
    const [currentSchedule, setCurrentSchedule] = useState(null);
    const [showPricePopup, setShowPricePopup] = useState(false);
    const [showSchedulePopup, setShowSchedulePopup] = useState(false);

    useEffect(() => {
        fetchAppointments();
        fetchCurrentSchedule();
        fetchCurrentPrice();
    }, []);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axiosInstance.get("/booking/user-appointments");
            if (res.data.success && Array.isArray(res.data.appointments)) {
                const validStatuses = [
                    "pending_accept", "awaiting_deposit",
                    "booked", "confirmed", "ongoing",
                    "marked_complete", "completed",
                    "fully_paid", "confirm_fully_paid",
                    "no_show_patient", "no_show_doctor", "no_show_both",
                    "cancelled_unpaid", "cancelled", "rejected", "freeze"
                ];
                const filtered = res.data.appointments
                    .filter(a => validStatuses.includes(a.status))
                    .sort((a, b) => new Date(a.start) - new Date(b.start));
                setAppointments(filtered);
            } else {
                setAppointments([]);
            }
        } catch (err) {
            setError("Failed to load appointments.");
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchCurrentPrice = async () => {
        try {
            const res = await axiosInstance.get("/pricing/appointment-price");
            const price = res.data.pricing?.[0]?.price ?? null;
            setCurrentPrice(price);
        } catch (err) {
            console.error("Error fetching current price:", err);
            toast.error("Failed to fetch current price");
        }
    };

    const fetchCurrentSchedule = async () => {
        try {
            const res = await axiosInstance.get("/doctor-schedule/get-availability");
            if (res.data.success && res.data.availability) {
                setCurrentSchedule(res.data.availability);
                setWorkTime(formatScheduleDisplay(res.data.availability));
            } else {
                setWorkTime("Unset");
            }
        } catch (err) {
            console.error("Error fetching schedule:", err);
            setWorkTime("Unset");
        }
    };

    const formatTimeDisplay = (time) => {
        if (!time) return "";
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const displayHour = hour % 12 || 12;
        return `${displayHour}:${minutes} ${ampm}`;
    };

    const formatScheduleDisplay = (schedule) => {
        if (!schedule) return "Unset";
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const selectedDays = schedule.daysOfWeek?.map(day => daysOfWeek[day]).join(', ') || 'No days';
        const startTime = formatTimeDisplay(schedule.startHour);
        const endTime = formatTimeDisplay(schedule.endHour);
        return `${startTime} - ${endTime} (${selectedDays})`;
    };

    const handleSetNewPrice = () => setShowPricePopup(true);
    const handlePriceSet = async (newPrice) => {
        try {
            await axiosInstance.post("/pricing/set-pricing", { price: newPrice });
            const res = await axiosInstance.get("/pricing/appointment-price");
            const confirmedPrice = res.data.pricing?.[0]?.price;
            if (confirmedPrice !== undefined) {
                setCurrentPrice(confirmedPrice);
                toast.success(`Price updated to ₱${confirmedPrice}`);
            } else {
                setCurrentPrice(null);
                toast.success("Price updated (no price found in DB)");
            }
            setShowPricePopup(false);
        } catch (err) {
            console.error("Error updating price:", err);
            toast.error("Failed to update price");
        }
    };

    const handleSetWorkTime = () => setShowSchedulePopup(true);
    const handleScheduleSet = async (schedule) => {
        try {
            const res = await axiosInstance.post("/doctor-schedule/availability", schedule);
            if (res.data.success) {
                setCurrentSchedule(res.data.availability);
                setWorkTime(formatScheduleDisplay(res.data.availability));
            }
        } catch (err) {
            console.error("Error saving schedule:", err);
            setCurrentSchedule(schedule);
            setWorkTime(formatScheduleDisplay(schedule));
        }
    };

    const handleAppointmentUpdated = (appointmentId, newStatus) => {
        setAppointments(prev => prev.map(a => a._id === appointmentId ? { ...a, status: newStatus } : a));
    };

    const openAppointmentModal = (appointment) => setSelectedAppointment({ ...appointment });
    const closeAppointmentModal = () => setSelectedAppointment(null);

    const groups = {
        "Booking Level": ["pending_accept", "awaiting_deposit"],
        "Deposit Level": ["booked", "confirmed"],
        "Ongoing Appointments": ["ongoing"],
        "Completed Appointments": ["marked_complete", "completed", "fully_paid", "confirm_fully_paid", "no_show_doctor", "no_show_patient", "no_show_both"],
        "Cancelled Appointments": ["cancelled", "cancelled_unpaid", "rejected"],
        "Reported Appointments": ["freeze"],
    };

    const renderAppointmentGroup = (title, statuses, badgeColor) => {
        const groupAppointments = appointments.filter(a => statuses.includes(a.status));
        return (
            <section key={title} className="border rounded shadow-sm p-6">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{title}</h2>
                    <span className={`badge ${badgeColor}`}>{groupAppointments.length}</span>
                </div>
                {groupAppointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500"><p>No appointments in this group.</p></div>
                ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                        {groupAppointments.map(appointment => (
                            <PendingAppointment
                                key={appointment._id}
                                appointment={appointment}
                                onAppointmentUpdated={handleAppointmentUpdated}
                                onViewDetails={() => openAppointmentModal(appointment)}
                            />
                        ))}
                    </div>
                )}
            </section>
        );
    };

    return (
        <div className="p-8 space-y-8">
            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your account is pending approval</p>
                        <p className="text-sm opacity-70">
                            You can set up your schedule and pricing while you wait. Patients will be able to book once your account is approved.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold">Welcome to MedConnect</h1>
                <p className="mt-2 text-gray-600">Doctor Dashboard</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="card bg-base-100 shadow-sm border p-4">
                    <h3 className="font-bold text-lg mb-2">Consultation Pricing</h3>
                    <div className="flex items-center justify-between">
                        <div>{priceLoading ? <span className="loading loading-spinner loading-sm"></span> : currentPrice ? <p className="text-xl font-semibold">₱{currentPrice}</p> : <p className="text-gray-500">No price set</p>}</div>
                        <button className="btn btn-primary btn-sm" onClick={handleSetNewPrice} disabled={priceLoading}>{currentPrice ? "Update Price" : "Set Price"}</button>
                    </div>
                </div>
                <div className="card bg-base-100 shadow-sm border p-4">
                    <h3 className="font-bold text-lg mb-2">Work Schedule</h3>
                    <div className="flex items-center justify-between">
                        <div><p className={`text-sm ${workTime === "Unset" ? "text-gray-500" : "text-green-600 font-semibold"}`}>{workTime}</p></div>
                        <button className="btn btn-secondary btn-sm" onClick={handleSetWorkTime}>Set Work Time</button>
                    </div>
                </div>
            </div>

            {error && <div className="alert alert-error"><span>{error}</span></div>}

            {loading ? (
                <div className="flex justify-center py-8"><span className="loading loading-spinner loading-lg"></span></div>
            ) : (
                <>
                    {renderAppointmentGroup("Booking Level", groups["Booking Level"], "badge-warning")}
                    {renderAppointmentGroup("Deposit Level", groups["Deposit Level"], "badge-primary")}
                    {renderAppointmentGroup("Ongoing Appointments", groups["Ongoing Appointments"], "badge-secondary")}
                    {renderAppointmentGroup("Completed Appointments", groups["Completed Appointments"], "badge-success")}
                    {renderAppointmentGroup("Cancelled Appointments", groups["Cancelled Appointments"], "badge-error")}
                    {renderAppointmentGroup("Reported Appointments", groups["Reported Appointments"], "badge-neutral")}
                </>
            )}

            {selectedAppointment && (
                <ViewPendingAppointmentDoctorPopup
                    appointment={selectedAppointment}
                    onClose={closeAppointmentModal}
                    onAppointmentUpdated={handleAppointmentUpdated}
                />
            )}
            {showPricePopup && <SetPricePopup onClose={() => setShowPricePopup(false)} onPriceSet={handlePriceSet} currentPrice={currentPrice} />}
            {showSchedulePopup && <SetSchedulePopup onClose={() => setShowSchedulePopup(false)} onScheduleSet={handleScheduleSet} currentSchedule={currentSchedule} />}
        </div>
    );
};

export default HomePageDoctor;