import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import toast from "react-hot-toast";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import { XIcon, ChevronLeftIcon, ChevronRightIcon, CalendarIcon, ListIcon } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const DAYS_AHEAD = 90; // 3 months
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CreateBookingPopup = ({ provider, onClose, onBookingCreated }) => {
    const [loading, setLoading] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(true);
    const [error, setError] = useState("");
    const [allSlots, setAllSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [price, setPrice] = useState(null);
    const [isVirtual, setIsVirtual] = useState(true);
    const [viewMode, setViewMode] = useState("calendar"); // "calendar" | "list"
    const [calendarMonth, setCalendarMonth] = useState(dayjs().tz(PH_TZ).startOf("month"));

    const today = dayjs().tz(PH_TZ);
    const maxMonth = today.add(3, "month").startOf("month");

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

    useEffect(() => {
        if (!provider?._id) return;
        setSlotsLoading(true);
        setError("");
        axiosInstance.get(`/doctor-schedule/public-doctor-calendar?doctorId=${provider._id}&daysAhead=${DAYS_AHEAD}`)
            .then(res => {
                const events = res.data.data?.events || [];
                const slots = events
                    .filter(e => e.type === "availability")
                    .map(e => ({ start: e.start, end: e.end }));
                setAllSlots(slots);
                if (slots.length > 0) {
                    const firstDate = dayjs(slots[0].start).tz(PH_TZ).format("YYYY-MM-DD");
                    setSelectedDate(firstDate);
                    setCalendarMonth(dayjs(slots[0].start).tz(PH_TZ).startOf("month"));
                }
            })
            .catch(() => setError("Failed to load schedule. The doctor may not have set their schedule yet."))
            .finally(() => setSlotsLoading(false));
    }, [provider?._id]);

    const slotsByDate = useMemo(() => {
        const map = {};
        for (const slot of allSlots) {
            const date = dayjs(slot.start).tz(PH_TZ).format("YYYY-MM-DD");
            if (!map[date]) map[date] = [];
            map[date].push(slot);
        }
        return map;
    }, [allSlots]);

    const availableDates = useMemo(() => Object.keys(slotsByDate).sort(), [slotsByDate]);
    const slotsForDate = selectedDate ? (slotsByDate[selectedDate] || []) : [];

    const handleDateSelect = (date) => {
        setSelectedDate(date);
        setSelectedSlot(null);
    };

    // Build the calendar grid for calendarMonth
    const calendarDays = useMemo(() => {
        const start = calendarMonth.startOf("month");
        const end = calendarMonth.endOf("month");
        const days = [];
        // padding before month start
        for (let i = 0; i < start.day(); i++) days.push(null);
        for (let d = 1; d <= end.date(); d++) days.push(calendarMonth.date(d));
        return days;
    }, [calendarMonth]);

    const handleSubmit = async () => {
        if (!selectedSlot) { setError("Please select a time slot."); return; }
        try {
            setLoading(true);
            setError("");
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
                <div className="bg-base-200 rounded-xl p-4 flex items-center gap-3">
                    <div className="relative shrink-0">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-base-300 flex items-center justify-center">
                            {provider.profilePic?.url
                                ? <img src={provider.profilePic.url} alt={providerName} className="w-full h-full object-cover" />
                                : <span className="text-base">👨‍⚕️</span>
                            }
                        </div>
                        <span
                            className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-base-200 ${provider.isOnline ? "bg-success" : "bg-base-content/30"}`}
                            title={provider.isOnline ? "Online" : "Offline"}
                        />
                    </div>
                    <div>
                        <p className="font-semibold">{providerName}</p>
                        <p className="text-xs opacity-60 capitalize flex items-center gap-1">
                            {provider.role}
                            <span className={`text-xs font-medium ${provider.isOnline ? "text-success" : "opacity-40"}`}>
                                · {provider.isOnline ? "Online" : "Offline"}
                            </span>
                        </p>
                        {price != null ? (
                            <p className="text-sm font-medium text-primary mt-0.5">
                                ₱{price.toLocaleString("en-PH")} · 30 min session
                            </p>
                        ) : (
                            <p className="text-sm opacity-50 mt-0.5">Loading price…</p>
                        )}
                    </div>
                </div>

                {/* Virtual / In-person toggle */}
                <div>
                    <p className="text-sm font-semibold mb-2">Appointment Type</p>
                    <div className="join w-full">
                        <button type="button" className={`join-item btn btn-sm flex-1 ${isVirtual ? "btn-primary" : "btn-outline"}`} onClick={() => setIsVirtual(true)}>
                            Virtual
                        </button>
                        <button type="button" className={`join-item btn btn-sm flex-1 ${!isVirtual ? "btn-primary" : "btn-outline"}`} onClick={() => setIsVirtual(false)}>
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
                        No available slots in the next 3 months. The doctor may not have set their schedule yet.
                    </p>
                ) : (
                    <>
                        {/* View mode toggle */}
                        <div className="flex items-center justify-between">
                            <p className="text-sm font-semibold">Select a Date</p>
                            <div className="join">
                                <button type="button" className={`join-item btn btn-xs ${viewMode === "calendar" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("calendar")}>
                                    <CalendarIcon className="size-3" /> Calendar
                                </button>
                                <button type="button" className={`join-item btn btn-xs ${viewMode === "list" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewMode("list")}>
                                    <ListIcon className="size-3" /> List
                                </button>
                            </div>
                        </div>

                        {viewMode === "calendar" && (
                            <div className="space-y-2">
                                {/* Month nav */}
                                <div className="flex items-center justify-between">
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-xs btn-circle"
                                        disabled={!calendarMonth.isAfter(today.startOf("month"))}
                                        onClick={() => setCalendarMonth(m => m.subtract(1, "month"))}
                                    >
                                        <ChevronLeftIcon className="size-3.5" />
                                    </button>
                                    <span className="text-sm font-semibold">{calendarMonth.format("MMMM YYYY")}</span>
                                    <button
                                        type="button"
                                        className="btn btn-ghost btn-xs btn-circle"
                                        disabled={!calendarMonth.isBefore(maxMonth)}
                                        onClick={() => setCalendarMonth(m => m.add(1, "month"))}
                                    >
                                        <ChevronRightIcon className="size-3.5" />
                                    </button>
                                </div>

                                {/* Day-of-week headers */}
                                <div className="grid grid-cols-7 gap-0.5">
                                    {DOW.map(d => (
                                        <div key={d} className="text-xs text-center opacity-40 font-medium py-1">{d}</div>
                                    ))}
                                    {calendarDays.map((day, i) => {
                                        if (!day) return <div key={`pad-${i}`} />;
                                        const dateStr = day.format("YYYY-MM-DD");
                                        const hasSlots = Boolean(slotsByDate[dateStr]);
                                        const isPast = day.isBefore(today, "day");
                                        const isSelected = selectedDate === dateStr;
                                        return (
                                            <button
                                                key={dateStr}
                                                type="button"
                                                disabled={!hasSlots || isPast}
                                                onClick={() => handleDateSelect(dateStr)}
                                                className={`
                                                    relative rounded-lg py-1.5 text-xs flex flex-col items-center transition-colors
                                                    ${isSelected ? "bg-primary text-primary-content font-bold" : ""}
                                                    ${hasSlots && !isPast && !isSelected ? "hover:bg-primary/10 font-medium text-base-content" : ""}
                                                    ${(!hasSlots || isPast) ? "opacity-25 cursor-default" : ""}
                                                `}
                                            >
                                                {day.date()}
                                                {hasSlots && !isPast && (
                                                    <span className={`w-1 h-1 rounded-full mt-0.5 ${isSelected ? "bg-primary-content" : "bg-primary"}`} />
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                                <p className="text-xs opacity-40 text-center">Dates with available slots are shown with a dot</p>
                            </div>
                        )}

                        {viewMode === "list" && (
                            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
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
                        )}

                        {/* Time slot picker */}
                        {selectedDate && slotsForDate.length > 0 && (
                            <div>
                                <p className="text-sm font-semibold mb-2">
                                    {dayjs(selectedDate).tz(PH_TZ).format("dddd, MMMM D")} — Select a Time
                                </p>
                                <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pr-1">
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
                        <p><span className="opacity-60">Date: </span>{dayjs(selectedSlot.start).tz(PH_TZ).format("dddd, MMMM D, YYYY")}</p>
                        <p><span className="opacity-60">Time: </span>{dayjs(selectedSlot.start).tz(PH_TZ).format("h:mm A")} – {dayjs(selectedSlot.end).tz(PH_TZ).format("h:mm A")}</p>
                        <p><span className="opacity-60">Type: </span>{isVirtual ? "Virtual" : "In-Person"}</p>
                        <p><span className="opacity-60">Total: </span>₱{price.toLocaleString("en-PH")}</p>
                        <p><span className="opacity-60">Deposit (50%): </span>₱{(price * 0.5).toLocaleString("en-PH")}</p>
                        <p className="text-xs opacity-40 pt-1">Platform fee (10%) is included in the total.</p>
                    </div>
                )}

                {error && <p className="text-error text-sm">{error}</p>}

                <div className="space-y-2">
                    <div className="flex gap-2 justify-end">
                        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button className="btn btn-primary" disabled={loading || !selectedSlot} onClick={handleSubmit}>
                            {loading
                                ? <><span className="loading loading-spinner loading-xs" />Booking…</>
                                : "Confirm Appointment"
                            }
                        </button>
                    </div>
                    {selectedSlot && (
                        <p className="text-xs text-center opacity-50">
                            By clicking this button, you agree to our{" "}
                            <Link to="/terms-of-service" target="_blank" className="link link-primary">Terms &amp; Conditions</Link>.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CreateBookingPopup;
