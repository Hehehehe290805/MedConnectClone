import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

const CreateBookingPopup = ({ provider, onClose, onBookingCreated }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [pricing, setPricing] = useState(null);
    const [appointmentServiceId, setAppointmentServiceId] = useState(null);

    useEffect(() => {
        const fetchAppointmentService = async () => {
            try {
                const res = await axiosInstance.get("/pricing/pricing", {
                    params: { serviceName: "Appointment" }
                });
                const service = res.data.pricing?.find(p => p.serviceId.name === "Appointment");
                if (service) setAppointmentServiceId(service.serviceId._id);
            } catch (err) {
                console.error("Failed to fetch Appointment service:", err);
            }
        };

        fetchAppointmentService();
    }, []);

    useEffect(() => {
        const fetchPricing = async () => {
            try {
                const res = await axiosInstance.get(
                    `/pricing/pricing?providerId=${provider._id}`
                );

                if (Array.isArray(res.data.pricing) && res.data.pricing.length > 0) {
                    setPricing(res.data.pricing[0]);
                }
            } catch (err) {
                console.error("❌ Error fetching pricing:", err);
            }
        };

        if (provider?._id) fetchPricing();
    }, [provider]);

    useEffect(() => {
        const fetchAvailableSlots = async () => {
            try {
                const res = await axiosInstance.get(
                    `/doctor-schedule/public-doctor-calendar?doctorId=${provider._id}&daysAhead=2`
                );

                if (res.data.success) {

                    const available = res.data.events
                        .filter(e => e.type === "availability")
                        .map(e => {
                            const slotTime = dayjs(e.start);
                            const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slotTime.day()];
                            return {
                                start: e.start,
                                end: e.end,
                                display: dayjs(e.start).format("ddd, MMM D, h:mm A"),
                            };
                        });

                    setAvailableSlots(available);
                }
            } catch (err) {
                console.error("Error fetching available slots:", err);
                setError("Failed to load available slots");
            }
        };

        fetchAvailableSlots();
    }, [provider._id]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!selectedSlot) {
            setError("Please select an available slot.");
            return;
        }

        if (!appointmentServiceId) {
            setError("Service information not loaded yet. Please try again.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            // 🚨 FIX: Send the time exactly as received from available slots
            // The backend expects Manila time with timezone offset
            const startTime = selectedSlot.start;

            const bookingData = {
                doctorId: provider._id,
                serviceId: appointmentServiceId,
                start: startTime, // Send exactly as received
            };


            const res = await axiosInstance.post("/booking/book", bookingData);

            if (res.data.message === "Appointment booked successfully.") {
                toast.success("Appointment booked successfully!");
                if (typeof onBookingCreated === "function") {
                    onBookingCreated(res.data.appointment);
                }
                onClose();
            }
        } catch (err) {
            console.error("❌ Booking error:", err);
            console.error("Backend error details:", err.response?.data);

            const errorMsg = err.response?.data?.message || "Failed to book appointment. Please try again.";
            setError(errorMsg);
            toast.error(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const getProviderName = () =>
        provider.role === "doctor"
            ? `Dr. ${provider.firstName} ${provider.lastName}`
            : provider.facilityName;

    const getPrice = () =>
        pricing ? `₱${pricing.price}` : "Price not set";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Book Appointment</h2>

                {/* Provider Info */}
                <div className="bg-base-200 p-4 rounded-lg mb-4">
                    <h3 className="font-semibold">{getProviderName()}</h3>
                    <p className="text-sm text-gray-600">{provider.profession || "Doctor"}</p>
                    {!appointmentServiceId && (
                        <p className="text-sm text-yellow-600 mt-1">Loading service info...</p>
                    )}
                </div>

                <form onSubmit={handleSubmit}>
                    {/* Locked Service */}
                    <div className="form-control w-full mb-4">
                        <label className="label">
                            <span className="label-text">Service Type</span>
                        </label>
                        <input
                            type="text"
                            className="input input-bordered w-full bg-gray-100 cursor-not-allowed"
                            value="Appointment"
                            disabled
                        />
                    </div>

                    {/* Available Slots */}
                    <div className="form-control w-full mb-4">
                        <label className="label">
                            <span className="label-text">Available Slots</span>
                        </label>
                        {availableSlots.length > 0 ? (
                            <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto">
                                {availableSlots.map((slot, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        className={`btn btn-outline btn-sm ${selectedSlot?.start === slot.start ? "btn-primary" : ""}`}
                                        onClick={() => setSelectedSlot(slot)}
                                        disabled={loading}
                                    >
                                        {slot.display}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">Loading available slots...</p>
                        )}
                    </div>

                    {/* Summary */}
                    {selectedSlot && (
                        <div className="bg-base-200 p-4 rounded-lg mb-4">
                            <h3 className="font-semibold mb-2">Booking Summary</h3>
                            <div className="space-y-1 text-sm">
                                <p><strong>Provider:</strong> {getProviderName()}</p>
                                <p><strong>Date:</strong> {dayjs(selectedSlot.start).format("ddd, MMM D, YYYY")}</p>
                                <p><strong>Time:</strong> {dayjs(selectedSlot.start).format("h:mm A")}</p>
                                <p><strong>Duration:</strong> 30 minutes</p>
                                <p><strong>Price:</strong> {getPrice()}</p>
                                {pricing && (
                                    <>
                                        <p><strong>Deposit (10%):</strong> ₱{(pricing.price * 0.1).toFixed(2)}</p>
                                        <p><strong>Balance:</strong> ₱{(pricing.price * 0.9).toFixed(2)}</p>
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {error && (
                        <div className="alert alert-error mb-4">
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            className="btn btn-outline"
                            onClick={onClose}
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={loading || !selectedSlot || !appointmentServiceId}
                        >
                            {loading ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Booking...
                                </>
                            ) : (
                                "Book Appointment"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateBookingPopup;