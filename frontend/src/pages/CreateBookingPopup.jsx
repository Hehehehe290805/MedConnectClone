import { useState, useEffect, useMemo } from "react";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { XIcon } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(isSameOrBefore);
const PH_TZ = "Asia/Manila";

const CreateBookingPopup = ({ provider, onClose, onBookingCreated }) => {
    const [loading, setLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(true);
    const [error, setError] = useState("");
    const [allSlots, setAllSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [price, setPrice] = useState(null);
    const [isVirtual, setIsVirtual] = useState(true);

    // Fetch doctor's consultation price
    useEffect(() => {
        if (!provider?._id) return;
        axiosInstance.get(`/pricing/pricing?providerId=${provider._id}`)
            .then(res => {
                const list = res.data.data?.pricing || [];
                const record = list.find(p => p.serviceId == null);
                if (record) setPrice(record.price);
            })
            .catch(() => {});
    }, [provider?._id]);

    // Fetch available slots
    useEffect(() => {
        if (!provider?._id) return;
        setSlotsLoading(true);
        setError("");
        axiosInstance.get(`/doctor-schedule/public-doctor-calendar?doctorId=${provider._id}&daysAhead=14`)
            .then(res => {
                const events = res.data.data?.events || [];
                const slots = events
                    .filter(e => e.type === "availability")
                    .map(e => ({ start: e.start, end: e.end }));
                setAllSlots(slots);
                if (slots.length > 0) {
                    const firstDate = dayjs(slots[0].start).tz(PH_TZ).format("YYYY-MM-DD");
                    setSelectedDate(firstDate);
                }
            })
            .catch(() => setError("Failed to load schedule. The doctor may not have set their schedule yet."))
            .finally(() => setSlotsLoading(false));
    }, [provider?._id]);

    // Group slots by date
    const slotsByDate = useMemo(() => {
        const map = {};
        for (const slot of allSlots) {
            const date = dayjs(slot.start).tz(PH_TZ).format("YYYY-MM-DD");
            if (!map[date]) map[date] = [];
            map[date].push(slot);
        }
        return map;
    }, [allSlots]);

    const availableDates = Object.keys(slotsByDate).sort();
    const slotsForDate = selectedDate ? (slotsByDate[selectedDate] || []) : [];

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedSlot(null);
    };

    const handleSubmit = async () => {
        if (!selectedSlot) { setError("Please select a time slot."); return; }
        try {
            setLoading(true);
            setError("");
            // Attach pre-consultation wizard answers if the patient came from the wizard
            let preConsultationMarkdown;
            try {
                const raw = sessionStorage.getItem("preConsultation");
                if (raw) preConsultationMarkdown = JSON.parse(raw)?.markdown;
            } catch { /* non-fatal */ }

            const res = await axiosInstance.post("/booking/book", {
                doctorId: provider._id,
                start: new Date(selectedSlot.start).toISOString(),
                virtual: isVirtual,
                ...(preConsultationMarkdown ? { preConsultationMarkdown } : {}),
            });
            if (res.data.success) {
                toast.success("Appointment booked! Pay the deposit to confirm.");
                onBookingCreated?.(res.data.data?.appointment);
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to book appointment.");
        } finally {
            setLoading(false);
        }
    };

    const providerName = provider.role === "doctor"
        ? `Dr. ${provider.firstName} ${provider.lastName}`
        : provider.instituteName || "Provider";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Book Appointment</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} disabled={loading}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {/* Provider info */}
                <div className="bg-base-200 rounded-xl p-4">
                    <p className="font-semibold">{providerName}</p>
                    <p className="text-sm opacity-60 capitalize">{provider.role}</p>
                    {price != null ? (
                        <p className="text-sm font-medium text-primary mt-1">
                            ₱{price.toLocaleString("en-PH")} · 30 min session
                        </p>
                    ) : (
                        <p className="text-sm opacity-50 mt-1">Loading price…</p>
                    )}
                </div>

                {/* Virtual / In-person toggle */}
                <div>
                    <p className="text-sm font-semibold mb-2">Appointment Type</p>
                    <div className="join w-full">
                        <button
                            type="button"
                            className={`join-item btn btn-sm flex-1 ${isVirtual ? "btn-primary" : "btn-outline"}`}
                            onClick={() => setIsVirtual(true)}
                        >
                            Virtual
                        </button>
                        <button
                            type="button"
                            className={`join-item btn btn-sm flex-1 ${!isVirtual ? "btn-primary" : "btn-outline"}`}
                            onClick={() => setIsVirtual(false)}
                        >
                            In-Person
                        </button>
                    </div>
                </div>

                {slotsLoading ? (
                    <div className="flex items-center gap-2 py-6 text-sm opacity-50 justify-center">
                        <span className="loading loading-spinner loading-sm" />
                        Loading available slots…
                    </div>
                ) : availableDates.length === 0 ? (
                    <p className="text-sm opacity-50 py-4 text-center">
                        No available slots in the next 14 days. The doctor may not have set their schedule yet.
                    </p>
                ) : (
                    <>
                        {/* Date selector */}
                        <div>
                            <p className="text-sm font-semibold mb-2">Select a Date</p>
                            <div className="flex flex-wrap gap-1.5">
                                {availableDates.map(date => {
                                    const d = dayjs(date).tz(PH_TZ);
                                    const isSelected = selectedDate === date;
                                    return (
                                        <button
                                            key={date}
                                            type="button"
                                            onClick={() => handleDateSelect(date)}
                                            className={`btn btn-sm flex-col h-auto py-2 px-3 gap-0 leading-tight ${isSelected ? "btn-primary" : "btn-outline"}`}
                                        >
                                            <span className="text-xs font-normal">{d.format("ddd")}</span>
                                            <span className="text-sm font-semibold">{d.format("MMM D")}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Time slot selector */}
                        {selectedDate && (
                            <div>
                                <p className="text-sm font-semibold mb-2">Select a Start Time</p>
                                <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                    {slotsForDate.map((slot, i) => {
                                        const t = dayjs(slot.start).tz(PH_TZ);
                                        const isSelected = selectedSlot?.start === slot.start;
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setSelectedSlot(slot)}
                                                className={`btn btn-sm font-normal ${isSelected ? "btn-primary" : "btn-outline"}`}
                                            >
                                                {t.format("h:mm A")}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Booking summary */}
                {selectedSlot && price != null && (
                    <div className="bg-base-200 rounded-xl p-4 text-sm space-y-1">
                        <p className="font-semibold mb-2">Booking Summary</p>
                        <p>
                            <span className="opacity-60">Date: </span>
                            {dayjs(selectedSlot.start).tz(PH_TZ).format("dddd, MMMM D, YYYY")}
                        </p>
                        <p>
                            <span className="opacity-60">Time: </span>
                            {dayjs(selectedSlot.start).tz(PH_TZ).format("h:mm A")} – {dayjs(selectedSlot.end).tz(PH_TZ).format("h:mm A")}
                        </p>
                        <p><span className="opacity-60">Type: </span>{isVirtual ? "Virtual" : "In-Person"}</p>
                        <p><span className="opacity-60">Duration: </span>30 minutes</p>
                        <p><span className="opacity-60">Total: </span>₱{price.toLocaleString("en-PH")}</p>
                        <p><span className="opacity-60">Deposit (50%): </span>₱{(price * 0.5).toLocaleString("en-PH")}</p>
                        <p className="text-xs opacity-40 pt-1">Platform fee (10%) is included in the total.</p>
                    </div>
                )}

                <div className="flex gap-2 justify-end">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button
                        className="btn btn-primary"
                        disabled={loading || !selectedSlot}
                        onClick={handleSubmit}
                    >
                        {loading
                            ? <><span className="loading loading-spinner loading-xs" />Booking…</>
                            : "Book Appointment"
                        }
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateBookingPopup;
