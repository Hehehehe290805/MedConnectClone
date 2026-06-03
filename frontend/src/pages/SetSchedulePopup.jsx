import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const DAYS = [
    { value: 0, abbr: "Sun" },
    { value: 1, abbr: "Mon" },
    { value: 2, abbr: "Tue" },
    { value: 3, abbr: "Wed" },
    { value: 4, abbr: "Thu" },
    { value: 5, abbr: "Fri" },
    { value: 6, abbr: "Sat" },
];

const SetSchedulePopup = ({ onClose, onScheduleSet, currentSchedule }) => {
    const [formData, setFormData] = useState({
        startHour: "09:00",
        endHour: "17:00",
        daysOfWeek: [1, 2, 3, 4, 5],
        isActive: true,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (currentSchedule) {
            setFormData({
                startHour: currentSchedule.startHour || "09:00",
                endHour: currentSchedule.endHour || "17:00",
                daysOfWeek: currentSchedule.daysOfWeek || [1, 2, 3, 4, 5],
                isActive: currentSchedule.isActive !== false,
            });
        }
    }, [currentSchedule]);

    const toggleDay = (val) =>
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(val)
                ? prev.daysOfWeek.filter(d => d !== val)
                : [...prev.daysOfWeek, val],
        }));

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.startHour || !formData.endHour) {
            setError("Please set both start and end times.");
            return;
        }
        if (formData.daysOfWeek.length === 0) {
            setError("Please select at least one day.");
            return;
        }
        if (new Date(`2000-01-01T${formData.endHour}`) <= new Date(`2000-01-01T${formData.startHour}`)) {
            setError("End time must be after start time.");
            return;
        }
        try {
            setLoading(true);
            setError("");
            const res = await axiosInstance.post("/doctor-schedule/availability", formData);
            if (res.data.success) {
                onScheduleSet(res.data.data?.availability);
                onClose();
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to update schedule.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-base-100 p-6 rounded-xl w-full max-w-sm shadow-xl">
                <h2 className="text-xl font-bold mb-5">Set Work Schedule</h2>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Time range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="form-control">
                            <label className="label pb-1">
                                <span className="label-text text-xs font-semibold uppercase tracking-wide opacity-60">Start Time</span>
                            </label>
                            <input
                                type="time"
                                className="input input-bordered w-full"
                                value={formData.startHour}
                                onChange={e => setFormData(p => ({ ...p, startHour: e.target.value }))}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-control">
                            <label className="label pb-1">
                                <span className="label-text text-xs font-semibold uppercase tracking-wide opacity-60">End Time</span>
                            </label>
                            <input
                                type="time"
                                className="input input-bordered w-full"
                                value={formData.endHour}
                                onChange={e => setFormData(p => ({ ...p, endHour: e.target.value }))}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Days of week */}
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-60 mb-3">Available Days</p>
                        <div className="flex justify-between">
                            {DAYS.map(day => (
                                <label key={day.value} className="flex flex-col items-center gap-1 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm checkbox-primary"
                                        checked={formData.daysOfWeek.includes(day.value)}
                                        onChange={() => toggleDay(day.value)}
                                        disabled={loading}
                                    />
                                    <span className="text-xs opacity-70">{day.abbr}</span>
                                </label>
                            ))}
                        </div>
                    </div>

                    {/* Active toggle */}
                    <div className="form-control">
                        <label className="label cursor-pointer justify-start gap-3">
                            <input
                                type="checkbox"
                                className="toggle toggle-sm"
                                checked={formData.isActive}
                                onChange={e => setFormData(p => ({ ...p, isActive: e.target.checked }))}
                                disabled={loading}
                            />
                            <span className="label-text text-sm">Schedule active</span>
                        </label>
                    </div>

                    {error && <p className="text-error text-sm">{error}</p>}

                    <div className="flex gap-2 justify-end">
                        <button type="button" className="btn btn-outline btn-sm" onClick={onClose} disabled={loading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary btn-sm" disabled={loading}>
                            {loading ? <><span className="loading loading-spinner loading-xs" />Saving…</> : "Save Schedule"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetSchedulePopup;
