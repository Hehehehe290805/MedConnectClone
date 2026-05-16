import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";

const SetSchedulePopup = ({ onClose, onScheduleSet, currentSchedule }) => {
    const [formData, setFormData] = useState({
        startHour: "09:00",
        endHour: "17:00",
        daysOfWeek: [1, 2, 3, 4, 5], // Monday to Friday
        isActive: true
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Days of week options
    const daysOptions = [
        { value: 0, label: "Sunday" },
        { value: 1, label: "Monday" },
        { value: 2, label: "Tuesday" },
        { value: 3, label: "Wednesday" },
        { value: 4, label: "Thursday" },
        { value: 5, label: "Friday" },
        { value: 6, label: "Saturday" }
    ];

    // Initialize form with current schedule if available
    useEffect(() => {
        if (currentSchedule) {
            setFormData({
                startHour: currentSchedule.startHour || "09:00",
                endHour: currentSchedule.endHour || "17:00",
                daysOfWeek: currentSchedule.daysOfWeek || [1, 2, 3, 4, 5],
                isActive: currentSchedule.isActive !== false
            });
        }
    }, [currentSchedule]);

    const handleDayToggle = (dayValue) => {
        setFormData(prev => ({
            ...prev,
            daysOfWeek: prev.daysOfWeek.includes(dayValue)
                ? prev.daysOfWeek.filter(d => d !== dayValue)
                : [...prev.daysOfWeek, dayValue]
        }));
    };

    const handleTimeChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    // In SetSchedulePopup.jsx, change back to handleSubmit:
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.startHour || !formData.endHour) {
            setError("Please set both start and end times.");
            return;
        }

        if (formData.daysOfWeek.length === 0) {
            setError("Please select at least one day of the week.");
            return;
        }

        // Validate time logic
        const start = new Date(`2000-01-01T${formData.startHour}`);
        const end = new Date(`2000-01-01T${formData.endHour}`);

        if (end <= start) {
            setError("End time must be after start time.");
            return;
        }

        try {
            setLoading(true);
            setError("");

            const res = await axiosInstance.post("/doctor-schedule/availability", formData);



            if (res.data.success) {
                onScheduleSet(res.data.availability);
                onClose();
            }
        } catch (err) {
            console.error("Schedule API error details:", err);
            console.error("Error response:", err.response?.data);
            console.error("Error status:", err.response?.status);

            // Check if it's a route issue or server issue
            if (err.code === 'ERR_NETWORK') {
                setError("Network error. Please check your connection.");
            } else if (err.response?.status === 404) {
                setError("Schedule feature is not available. Please contact support.");
            } else if (err.response?.status === 500) {
                setError("Server error. Please try again later.");
            } else {
                setError(err.response?.data?.message || "Failed to update schedule.");
            }
        } finally {
            setLoading(false);
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

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-base-100 p-6 rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold mb-4">Set Work Schedule</h2>

                <form onSubmit={handleSubmit}>
                    {/* Time Selection */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">Start Time</span>
                            </label>
                            <input
                                type="time"
                                className="input input-bordered w-full"
                                value={formData.startHour}
                                onChange={(e) => handleTimeChange('startHour', e.target.value)}
                                disabled={loading}
                            />
                            <label className="label">
                                <span className="label-text-alt">
                                    {formatTimeDisplay(formData.startHour)}
                                </span>
                            </label>
                        </div>

                        <div className="form-control">
                            <label className="label">
                                <span className="label-text">End Time</span>
                            </label>
                            <input
                                type="time"
                                className="input input-bordered w-full"
                                value={formData.endHour}
                                onChange={(e) => handleTimeChange('endHour', e.target.value)}
                                disabled={loading}
                            />
                            <label className="label">
                                <span className="label-text-alt">
                                    {formatTimeDisplay(formData.endHour)}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Days of Week Selection */}
                    <div className="mb-6">
                        <label className="label">
                            <span className="label-text">Available Days</span>
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            {daysOptions.map(day => (
                                <div key={day.value} className="form-control">
                                    <label className="label cursor-pointer justify-start gap-2 p-2 hover:bg-base-200 rounded">
                                        <input
                                            type="checkbox"
                                            className="checkbox checkbox-sm"
                                            checked={formData.daysOfWeek.includes(day.value)}
                                            onChange={() => handleDayToggle(day.value)}
                                            disabled={loading}
                                        />
                                        <span className="label-text">{day.label}</span>
                                    </label>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="form-control mb-6">
                        <label className="label cursor-pointer justify-start gap-2">
                            <input
                                type="checkbox"
                                className="toggle toggle-primary"
                                checked={formData.isActive}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    isActive: e.target.checked
                                }))}
                                disabled={loading}
                            />
                            <span className="label-text">Active Schedule</span>
                        </label>
                    </div>

                    {error && (
                        <div className="alert alert-error mb-4">
                            <svg xmlns="http://www.w3.org/2000/svg" className="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="flex gap-2 justify-end">
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
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="loading loading-spinner loading-sm"></span>
                                    Saving...
                                </>
                            ) : (
                                "Save Schedule"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SetSchedulePopup;