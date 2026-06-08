import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import toast from "react-hot-toast";
import { XIcon, UsersIcon, ClockIcon } from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const CreateDepartmentBookingPopup = ({ provider, onClose, onBookingCreated }) => {
    const [services, setServices] = useState([]);
    const [servicesLoading, setServicesLoading] = useState(true);
    const [selectedService, setSelectedService] = useState(null);

    const [availableDates, setAvailableDates] = useState([]);
    const [datesLoading, setDatesLoading] = useState(false);
    const [selectedDate, setSelectedDate] = useState(null);

    const [booking, setBooking] = useState(false);
    const [error, setError] = useState("");

    const departmentId = provider._id;
    const departmentName = provider.departmentTypeName || "Department";
    const instituteName = provider.rootInstitute?.instituteName || "";

    // Load verified services for this department
    useEffect(() => {
        setServicesLoading(true);
        axiosInstance.get(`/services/department/${departmentId}`)
            .then(res => {
                const list = res.data.data?.services || [];
                setServices(list);
                if (list.length === 1) setSelectedService(list[0]);
            })
            .catch(() => setError("Failed to load services."))
            .finally(() => setServicesLoading(false));
    }, [departmentId]);

    // Load availability when service is selected
    useEffect(() => {
        if (!selectedService) return;
        setDatesLoading(true);
        setSelectedDate(null);
        setError("");
        axiosInstance.get("/doctor-schedule/department-availability", {
            params: { departmentId, serviceId: selectedService.serviceId?._id || selectedService.serviceId, daysAhead: 14 },
        })
            .then(res => {
                setAvailableDates(res.data.data?.availableDates || []);
            })
            .catch(err => {
                const msg = err.response?.data?.message || "Failed to load availability.";
                setError(msg);
                setAvailableDates([]);
            })
            .finally(() => setDatesLoading(false));
    }, [selectedService, departmentId]);

    const handleBook = async () => {
        if (!selectedDate || !selectedService) { setError("Please select a service and date."); return; }
        setBooking(true);
        setError("");
        try {
            const serviceId = selectedService.serviceId?._id || selectedService.serviceId;
            const res = await axiosInstance.post("/booking/book", {
                instituteId: departmentId,
                serviceId,
                start: selectedDate.estimatedStartISO,
                virtual: false,
            });
            if (res.data.success) {
                toast.success("Appointment booked! Pay the deposit to confirm.");
                onBookingCreated?.(res.data.data?.appointment);
                onClose();
            }
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to book appointment.");
        } finally {
            setBooking(false);
        }
    };

    const selectedServiceId = selectedService?.serviceId?._id || selectedService?.serviceId;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">Book Appointment</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} disabled={booking}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {/* Department info */}
                <div className="bg-base-200 rounded-xl p-4 space-y-0.5">
                    <p className="font-semibold">{departmentName}</p>
                    {instituteName && <p className="text-sm opacity-60">{instituteName}</p>}
                </div>

                {error && <p className="text-error text-sm">{error}</p>}

                {/* Service selector */}
                {servicesLoading ? (
                    <div className="flex items-center gap-2 text-sm opacity-50 py-4 justify-center">
                        <span className="loading loading-spinner loading-sm" /> Loading services…
                    </div>
                ) : services.length === 0 ? (
                    <p className="text-sm opacity-50 text-center py-4">
                        This department has no approved services yet.
                    </p>
                ) : services.length > 1 ? (
                    <div>
                        <p className="text-sm font-semibold mb-2">Select a Service</p>
                        <div className="space-y-2">
                            {services.map(svc => {
                                const svcId = svc.serviceId?._id || svc.serviceId;
                                const isSelected = selectedServiceId === svcId;
                                return (
                                    <button
                                        key={svc._id}
                                        type="button"
                                        onClick={() => setSelectedService(svc)}
                                        className={`w-full text-left rounded-lg px-4 py-3 border transition-colors ${isSelected ? "border-primary bg-primary/10" : "border-base-300 bg-base-100 hover:border-primary/50"}`}
                                    >
                                        <p className="font-medium text-sm">{svc.serviceId?.name || "Service"}</p>
                                        <div className="flex gap-3 mt-1 text-xs opacity-60">
                                            <span className="flex items-center gap-1">
                                                <ClockIcon className="size-3" /> {svc.durationMinutes} min
                                            </span>
                                            {svc.maxPatientsPerDay && (
                                                <span className="flex items-center gap-1">
                                                    <UsersIcon className="size-3" /> Max {svc.maxPatientsPerDay}/day
                                                </span>
                                            )}
                                            {svc.price != null && (
                                                <span className="text-primary font-medium">₱{svc.price.toLocaleString("en-PH")}</span>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ) : selectedService ? (
                    <div className="bg-base-200 rounded-xl px-4 py-3 text-sm space-y-0.5">
                        <p className="font-medium">{selectedService.serviceId?.name || "Service"}</p>
                        <div className="flex gap-3 text-xs opacity-60">
                            <span className="flex items-center gap-1"><ClockIcon className="size-3" /> {selectedService.durationMinutes} min</span>
                            {selectedService.maxPatientsPerDay && (
                                <span className="flex items-center gap-1"><UsersIcon className="size-3" /> Max {selectedService.maxPatientsPerDay}/day</span>
                            )}
                            {selectedService.price != null && (
                                <span className="text-primary font-medium">₱{selectedService.price.toLocaleString("en-PH")}</span>
                            )}
                        </div>
                    </div>
                ) : null}

                {/* Date selector */}
                {selectedService && (
                    datesLoading ? (
                        <div className="flex items-center gap-2 text-sm opacity-50 py-4 justify-center">
                            <span className="loading loading-spinner loading-sm" /> Checking availability…
                        </div>
                    ) : availableDates.length === 0 ? (
                        !error && (
                            <p className="text-sm opacity-50 text-center py-4">
                                No available slots in the next 14 days. The department may not have set their schedule yet.
                            </p>
                        )
                    ) : (
                        <div>
                            <p className="text-sm font-semibold mb-2">Select a Date</p>
                            <div className="flex flex-wrap gap-1.5">
                                {availableDates.map(slot => {
                                    const d = dayjs(slot.date).tz(PH_TZ);
                                    const isSelected = selectedDate?.date === slot.date;
                                    return (
                                        <button
                                            key={slot.date}
                                            type="button"
                                            onClick={() => setSelectedDate(slot)}
                                            className={`btn btn-sm flex-col h-auto py-2 px-3 gap-0 leading-tight ${isSelected ? "btn-primary" : "btn-outline"}`}
                                        >
                                            <span className="text-xs font-normal">{d.format("ddd")}</span>
                                            <span className="text-sm font-semibold">{d.format("MMM D")}</span>
                                            {slot.remainingSlots != null && (
                                                <span className="text-xs font-normal opacity-70">{slot.remainingSlots} left</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )
                )}

                {/* Queue info & summary */}
                {selectedDate && selectedService && (
                    <div className="bg-base-200 rounded-xl p-4 text-sm space-y-1.5">
                        <p className="font-semibold mb-2">Booking Summary</p>
                        <p><span className="opacity-60">Service: </span>{selectedService.serviceId?.name}</p>
                        <p><span className="opacity-60">Date: </span>{dayjs(selectedDate.date).tz(PH_TZ).format("dddd, MMMM D, YYYY")}</p>
                        <div className="flex items-center gap-2">
                            <span className="opacity-60">Queue Number: </span>
                            <span className="badge badge-primary font-bold">#{selectedDate.nextQueueNumber}</span>
                        </div>
                        <p><span className="opacity-60">Estimated Time: </span>{selectedDate.estimatedStartDisplay}</p>
                        <p><span className="opacity-60">Duration: </span>{selectedService.durationMinutes} min</p>
                        {selectedService.price != null && (
                            <>
                                <p><span className="opacity-60">Total: </span>₱{selectedService.price.toLocaleString("en-PH")}</p>
                                <p><span className="opacity-60">Deposit (50%): </span>₱{(selectedService.price * 0.5).toLocaleString("en-PH")}</p>
                            </>
                        )}
                        <p className="text-xs opacity-40 pt-1">In-person appointment · Platform fee (10%) included.</p>
                    </div>
                )}

                <div className="flex gap-2 justify-end">
                    <button type="button" className="btn btn-ghost" onClick={onClose} disabled={booking}>Cancel</button>
                    <button
                        className="btn btn-primary"
                        disabled={booking || !selectedDate || !selectedService}
                        onClick={handleBook}
                    >
                        {booking ? <><span className="loading loading-spinner loading-xs" />Booking…</> : "Book Appointment"}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CreateDepartmentBookingPopup;