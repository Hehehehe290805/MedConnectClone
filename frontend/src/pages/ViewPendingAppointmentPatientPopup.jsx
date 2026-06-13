import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon, StarIcon, UserIcon, MessageCircleIcon, FlagIcon, ChevronLeftIcon, ChevronRightIcon, UsersIcon } from "lucide-react";
import AppointmentFilesPanel from "../components/AppointmentFilesPanel.jsx";
import ChatAttachmentsSection from "../components/ChatAttachmentsSection.jsx";
import toast from "react-hot-toast";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";
const DOW = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const REBOOKABLE_STATUSES = ["missed_by_patient", "missed_by_provider", "missed_by_both"];
const rebookConditionLabel = (missedBy) => {
    if (missedBy === "patient") return "Patient missed the original virtual appointment.";
    if (missedBy === "provider") return "Provider missed the original virtual appointment; mock cashback applies.";
    if (missedBy === "both") return "Both parties missed the original virtual appointment; free rebook applies.";
    return "Virtual missed appointment rebook policy applied.";
};
const rebookOutcomeLabel = (appt) => {
    if (!appt?.rebooked && appt?.missedBy) return "Rebooking available";
    if (appt?.status === "cancelled") {
        const reason = (appt.rejectionReason || "").toLowerCase();
        if (reason.includes("missed")) return "Missed and cancelled";
        if (reason.includes("rejected")) return "Rejected and cancelled";
        if (reason.includes("passed")) return "Expired and cancelled";
        return "Cancelled";
    }
    if (appt?.status === "deposit_paid") return "Rebooked - pending provider approval";
    if (["accepted", "ongoing", "awaiting_balance", "completed", "fully_paid"].includes(appt?.status)) return "Rebooked successfully";
    return "Rebooked";
};

const fmt = (d) => dayjs(d).tz(PH_TZ).format("ddd, MMM D, YYYY");
const fmtTime = (d) => dayjs(d).tz(PH_TZ).format("h:mm A");

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
    missed_by_patient: "Missed - Rebook Available",
    missed_by_provider: "Provider Missed - Rebook Available",
    missed_by_both: "Missed - Free Rebook Available",
};

const CHAT_STATUSES = ["accepted", "ongoing", "awaiting_balance", "completed", "fully_paid", "disputed"];

const ViewPendingAppointmentPatientPopup = ({ appointment: appt, onClose, onUpdated }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [disputeText, setDisputeText] = useState("");
    const [showDisputeInput, setShowDisputeInput] = useState(false);
    const [showRebook, setShowRebook] = useState(false);
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [allSlots, setAllSlots] = useState([]);
    const [selectedDate, setSelectedDate] = useState("");
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [calendarMonth, setCalendarMonth] = useState(dayjs().tz(PH_TZ).startOf("month"));

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["myAppointments"] });
        onUpdated?.();
    };

    const { mutate: cancel, isPending: isCancelling } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/cancel", { appointmentId: appt._id }),
        onSuccess: () => { toast.success("Appointment cancelled."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to cancel."),
    });

    const { mutate: complete, isPending: isCompleting } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/complete", { appointmentId: appt._id }),
        onSuccess: () => { toast.success("Marked as complete."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed."),
    });

    const { mutate: submitReview, isPending: isReviewing } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/review", { appointmentId: appt._id, rating: reviewRating, review: reviewText }),
        onSuccess: () => { toast.success("Review submitted!"); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to submit review."),
    });

    const { mutate: dispute, isPending: isDisputing } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/dispute", { appointmentId: appt._id, complaint: disputeText }),
        onSuccess: () => { toast.success("Dispute filed."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to file dispute."),
    });

    const { mutate: rebook, isPending: isRebooking } = useMutation({
        mutationFn: ({ start, referenceNumber }) => axiosInstance.post("/booking/rebook", {
            appointmentId: appt._id,
            start,
            ...(referenceNumber ? { referenceNumber } : {}),
        }),
        onSuccess: () => { toast.success("Rebook request sent for provider approval."); invalidate(); onClose(); },
        onError: (err) => {
            const message = err?.response?.data?.message || "Failed to rebook.";
            if (message.toLowerCase().includes("already been rebooked")) {
                toast("Rebook request was already sent. Refreshing your appointments.");
                setShowRebook(false);
                invalidate();
                onClose();
                return;
            }
            toast.error(message);
        },
    });

    const providerIdForSlots = appt?.doctorId?._id || appt?.doctorId;

    useEffect(() => {
        if (!showRebook || !providerIdForSlots) return;
        setSlotsLoading(true);
        axiosInstance.get(`/doctor-schedule/public-doctor-calendar?doctorId=${providerIdForSlots}&daysAhead=90`)
            .then((res) => {
                const slots = (res.data.data?.events || [])
                    .filter((event) => event.type === "availability")
                    .map((event) => ({ start: event.start, end: event.end }))
                    .filter((slot) => dayjs(slot.start).tz(PH_TZ).isAfter(dayjs().tz(PH_TZ)));
                setAllSlots(slots);
                const firstSlot = slots[0] || null;
                const firstDate = firstSlot ? dayjs(firstSlot.start).tz(PH_TZ).format("YYYY-MM-DD") : "";
                setSelectedDate(firstDate);
                setSelectedSlot(firstSlot);
                if (firstSlot) setCalendarMonth(dayjs(firstSlot.start).tz(PH_TZ).startOf("month"));
            })
            .catch(() => toast.error("Failed to load available slots."))
            .finally(() => setSlotsLoading(false));
    }, [showRebook, providerIdForSlots]);

    const slotsByDate = useMemo(() => {
        const map = {};
        for (const slot of allSlots) {
            const date = dayjs(slot.start).tz(PH_TZ).format("YYYY-MM-DD");
            if (!map[date]) map[date] = [];
            map[date].push(slot);
        }
        return map;
    }, [allSlots]);

    const today = dayjs().tz(PH_TZ);
    const maxMonth = today.add(3, "month").startOf("month");

    const calendarDays = useMemo(() => {
        const start = calendarMonth.startOf("month");
        const end = calendarMonth.endOf("month");
        const days = [];
        for (let i = 0; i < start.day(); i++) days.push(null);
        for (let d = 1; d <= end.date(); d++) days.push(calendarMonth.date(d));
        return days;
    }, [calendarMonth]);

    if (!appt) return null;

    const durationMin = Math.round((new Date(appt.end) - new Date(appt.start)) / 60000);
    const canDispute = ["ongoing", "completed", "awaiting_balance", "fully_paid"].includes(appt.status);
    const providerId = appt.doctorId?._id || appt.doctorId || appt.instituteId?._id || appt.instituteId;
    const canChat = CHAT_STATUSES.includes(appt.status) && providerId;
    const rebookFee = Math.round((appt.amount || 0) * 0.1 * 100) / 100;
    const rebookDeadline = appt.rebookDeadline ? dayjs(appt.rebookDeadline).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A") : "";
    const isRebookStatus = REBOOKABLE_STATUSES.includes(appt.status);
    const isRebookWindowOpen = !appt.rebookDeadline || dayjs().tz(PH_TZ).isBefore(dayjs(appt.rebookDeadline));
    const canRebookAppointment = isRebookStatus && !appt.rebookUsed && !appt.rebooked && isRebookWindowOpen;
    const statusText = appt.rebooked && isRebookStatus ? "Rebooked" : (STATUS_LABEL[appt.status] || appt.status);
    const availableDates = Object.keys(slotsByDate).sort();
    const slotsForDate = selectedDate ? (slotsByDate[selectedDate] || []) : [];

    const selectRebookDate = (date) => {
        setSelectedDate(date);
        setSelectedSlot((slotsByDate[date] || [])[0] || null);
    };

    const submitRebook = () => {
        if (!canRebookAppointment) {
            toast.error(appt.rebookUsed || appt.rebooked ? "This appointment has already been rebooked." : "The rebook window is no longer available.");
            setShowRebook(false);
            invalidate();
            return;
        }
        if (!selectedSlot) return toast.error("Please choose a rebook date.");
        const referenceNumber = appt.status === "missed_by_patient"
            ? `RB-${Date.now()}-${String(appt._id).slice(-4)}`
            : undefined;
        rebook({ start: new Date(selectedSlot.start).toISOString(), referenceNumber });
    };

    const goToPayment = (type) => {
        const amount = type === "deposit" ? appt.depositAmount : appt.balanceAmount;
        navigate(`/mock-payment?appointmentId=${appt._id}&type=${type}&amount=${amount}`);
        onClose();
    };

    const renderRebookButton = (label) => {
        if (canRebookAppointment) {
            return (
                <button className="btn btn-primary w-full" onClick={() => setShowRebook(true)}>
                    {label}
                </button>
            );
        }

        return (
            <div className="rounded-lg border border-base-300 bg-base-100 p-3 text-xs opacity-70">
                {appt.rebookUsed || appt.rebooked
                    ? "A rebook request has already been sent for this appointment. Please wait for the provider to approve or reject it."
                    : "The rebook window for this appointment is no longer available."}
            </div>
        );
    };

    const renderActions = () => {
        switch (appt.status) {
            case "pending_payment":
                return (
                    <div className="space-y-2">
                        <button className="btn btn-primary w-full" onClick={() => goToPayment("deposit")}>
                            Confirm &amp; Pay Deposit — ₱{appt.depositAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </button>
                        <p className="text-xs text-center opacity-50">
                            By clicking this button, you agree to our{" "}
                            <Link to="/terms-of-service" target="_blank" className="link link-primary">Terms &amp; Conditions</Link>.
                        </p>
                        <button className="btn btn-error btn-outline btn-sm w-full" disabled={isCancelling} onClick={() => cancel()}>
                            Cancel Appointment
                        </button>
                    </div>
                );
            case "deposit_paid":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Deposit received. Waiting for the provider to confirm.</p>
                        <button className="btn btn-error btn-outline btn-sm w-full" disabled={isCancelling} onClick={() => cancel()}>
                            Cancel Appointment
                        </button>
                    </div>
                );
            case "accepted":
                return (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Confirmed — see you on {fmt(appt.start)} at {fmtTime(appt.start)}.</p>
                        {canChat && (
                            <button className="btn btn-primary w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Message Provider
                            </button>
                        )}
                        <button className="btn btn-error btn-outline btn-sm w-full" disabled={isCancelling} onClick={() => cancel()}>
                            Cancel (deposit non-refundable)
                        </button>
                    </div>
                );
            case "ongoing":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Appointment is in progress.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                        <button className="btn btn-primary w-full" disabled={isCompleting} onClick={() => complete()}>
                            Mark as Complete
                        </button>
                    </div>
                );
            case "completed":
                return appt.virtual
                    ? (
                        <div className="space-y-2">
                            {canChat && (
                                <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                    <MessageCircleIcon className="size-4" />Open Chat
                                </button>
                            )}
                            <button className="btn btn-primary w-full" onClick={() => goToPayment("balance")}>
                                Confirm &amp; Pay Balance — ₱{appt.balanceAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </button>
                            <p className="text-xs text-center opacity-50">
                                By clicking this button, you agree to our{" "}
                                <Link to="/terms-of-service" target="_blank" className="link link-primary">Terms &amp; Conditions</Link>.
                            </p>
                        </div>
                    )
                    : (
                        <div className="space-y-2">
                            <p className="text-sm opacity-60">Appointment completed.</p>
                            {canChat && (
                                <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                    <MessageCircleIcon className="size-4" />Open Chat
                                </button>
                            )}
                        </div>
                    );
            case "awaiting_balance":
                return (
                    <div className="space-y-2">
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                        <button className="btn btn-primary w-full" onClick={() => goToPayment("balance")}>
                            Confirm &amp; Pay Balance — ₱{appt.balanceAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </button>
                        <p className="text-xs text-center opacity-50">
                            By clicking this button, you agree to our{" "}
                            <Link to="/terms-of-service" target="_blank" className="link link-primary">Terms &amp; Conditions</Link>.
                        </p>
                    </div>
                );
            case "fully_paid":
                if (appt.rating) {
                    return (
                        <div className="space-y-2">
                            <p className="text-sm opacity-60">Review submitted. Thank you!</p>
                            {canChat && (
                                <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                    <MessageCircleIcon className="size-4" />Open Chat
                                </button>
                            )}
                        </div>
                    );
                }
                return (
                    <div className="space-y-3">
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                        <p className="text-sm font-semibold">Leave a review:</p>
                        <div className="flex gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                                <button key={n} onClick={() => setReviewRating(n)}>
                                    <StarIcon className={`w-7 h-7 ${n <= reviewRating ? "text-yellow-400 fill-yellow-400" : "text-base-content/30"}`} />
                                </button>
                            ))}
                        </div>
                        <textarea
                            className="textarea textarea-bordered w-full text-sm resize-none"
                            rows={3}
                            placeholder="Share your experience..."
                            value={reviewText}
                            onChange={(e) => setReviewText(e.target.value)}
                        />
                        <button
                            className="btn btn-primary w-full"
                            disabled={!reviewRating || isReviewing}
                            onClick={() => submitReview()}
                        >
                            Submit Review
                        </button>
                    </div>
                );
            case "cancelled":
                return <p className="text-sm opacity-60">This appointment was cancelled.</p>;
            case "missed_by_patient":
                return (
                    <div className="space-y-3 rounded-xl border border-warning/30 bg-warning/10 p-4">
                        <p className="text-sm font-semibold">You missed this virtual appointment.</p>
                        <p className="text-xs opacity-70">
                            You can rebook this same appointment once within 3 days. The rebooking fee is{" "}
                            <span className="font-semibold">₱{rebookFee.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>.
                            {rebookDeadline ? ` Deadline: ${rebookDeadline}.` : ""} If the deadline passes, this appointment will be cancelled with no refund.
                        </p>
                        {renderRebookButton("Rebook & Pay Fee")}
                    </div>
                );
            case "missed_by_provider":
                return (
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                        <p className="text-sm font-semibold">The provider missed this virtual appointment.</p>
                        <p className="text-xs opacity-70">
                            You received{" "}
                            <span className="font-semibold">₱{(appt.cashbackAmount || rebookFee).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>{" "}
                            mock cashback and can rebook this same appointment once for free within 3 days.
                            {rebookDeadline ? ` Deadline: ${rebookDeadline}.` : ""}
                        </p>
                        {renderRebookButton("Rebook Appointment")}
                    </div>
                );
            case "missed_by_both":
                return (
                    <div className="space-y-3 rounded-xl border border-primary/30 bg-primary/10 p-4">
                        <p className="text-sm font-semibold">Both parties missed this virtual appointment.</p>
                        <p className="text-xs opacity-70">
                            You can rebook this same appointment once for free within 3 days. No payment exchange will be made for this missed session.
                            {rebookDeadline ? ` Deadline: ${rebookDeadline}.` : ""}
                        </p>
                        {renderRebookButton("Rebook Appointment")}
                    </div>
                );
            case "rejected":
                return (
                    <p className="text-sm opacity-60">
                        Appointment rejected.{appt.rejectionReason ? ` Reason: ${appt.rejectionReason}` : ""} Your deposit will be refunded.
                    </p>
                );
            case "disputed":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Dispute filed. Awaiting admin resolution.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${providerId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                    </div>
                );
            case "resolved":
                return <p className="text-sm opacity-60">Dispute resolved by admin.</p>;
            default:
                return null;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between p-5 border-b border-base-300">
                    <h2 className="text-lg font-bold">Appointment Details</h2>
                    <div className="flex items-center gap-1">
                        {(appt.doctorId?._id || appt.doctorId) && (
                            <Link
                                to={`/profile/${appt.doctorId?._id || appt.doctorId}`}
                                className="btn btn-ghost btn-xs gap-1 opacity-60"
                                onClick={onClose}
                            >
                                <UserIcon className="size-3" />Doctor Profile
                            </Link>
                        )}
                        <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                            <XIcon className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    {/* Status */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm opacity-60">Status</span>
                        <span className="text-sm font-semibold">
                            {statusText}
                            {appt.rebooked && !isRebookStatus ? <span className="ml-2 text-primary">(Rebooked)</span> : ""}
                        </span>
                    </div>

                    {/* Schedule */}
                    <div className="bg-base-200 rounded-xl p-4 space-y-1 text-sm">
                        <p className="font-semibold">{fmt(appt.start)}</p>
                        <p className="opacity-70">{fmtTime(appt.start)} – {fmtTime(appt.end)} ({durationMin} min)</p>
                        <p className="opacity-70">{appt.virtual ? "Virtual / Online" : "In-Person"}</p>
                    </div>

                    {/* Payment */}
                    <div className="bg-base-200 rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between font-semibold">
                            <span>Total</span>
                            <span>₱{appt.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between opacity-60 text-xs">
                            <span>Platform Fee (10%)</span>
                            <span>₱{appt.platformFee?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="divider my-1" />
                        <div className="flex justify-between">
                            <span className="opacity-70">Deposit (50%)</span>
                            <span className={appt.depositPaid ? "text-success font-medium" : ""}>
                                ₱{appt.depositAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                {appt.depositPaid ? " ✓" : ""}
                            </span>
                        </div>
                        {appt.virtual && (
                            <div className="flex justify-between">
                                <span className="opacity-70">Balance (50%)</span>
                                <span className={appt.balancePaid ? "text-success font-medium" : ""}>
                                    ₱{appt.balanceAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                    {appt.balancePaid ? " ✓" : ""}
                                </span>
                            </div>
                        )}
                        {appt.depositRef && (
                            <p className="text-xs opacity-50">Deposit ref: <span className="font-mono">{appt.depositRef}</span></p>
                        )}
                        {appt.balanceRef && (
                            <p className="text-xs opacity-50">Balance ref: <span className="font-mono">{appt.balanceRef}</span></p>
                        )}
                        {(appt.rebooked || appt.missedBy) && (
                            <div className="mt-3 border-t border-base-300 pt-3 space-y-2">
                                <div className="flex justify-between gap-3">
                                    <span className="font-semibold text-primary">Rebook Details</span>
                                    <span className="font-semibold text-right">{rebookOutcomeLabel(appt)}</span>
                                </div>
                                <p className="opacity-70">{rebookConditionLabel(appt.missedBy)}</p>
                                {appt.rebooked ? (
                                    <>
                                        <div className="flex justify-between gap-3">
                                            <span className="opacity-60">Rebooked schedule</span>
                                            <span className="font-semibold text-right">{fmt(appt.start)} at {fmtTime(appt.start)}</span>
                                        </div>
                                        {appt.rebookedAt && (
                                            <div className="flex justify-between gap-3 text-xs">
                                                <span className="opacity-60">Requested</span>
                                                <span className="text-right">{dayjs(appt.rebookedAt).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")}</span>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="flex justify-between gap-3">
                                        <span className="opacity-60">Rebook deadline</span>
                                        <span className="font-semibold text-right">{rebookDeadline || "Within 3 days"}</span>
                                    </div>
                                )}
                                {appt.rebookFeePaid && appt.rebookFeeRef && (
                                    <p className="text-xs opacity-60">Rebooking fee ref: <span className="font-mono">{appt.rebookFeeRef}</span></p>
                                )}
                                {appt.cashbackAmount > 0 && (
                                    <p className="text-xs opacity-60">Mock cashback: ₱{appt.cashbackAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                                )}
                            </div>
                        )}
                    </div>

                    {false && (appt.rebooked || appt.missedBy) && (
                        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm space-y-2">
                            <p className="font-semibold text-primary">Rebook Details</p>
                            <p className="opacity-70">{rebookConditionLabel(appt.missedBy)}</p>
                            {appt.rebooked ? (
                                <>
                                    <div className="flex justify-between gap-3">
                                        <span className="opacity-60">Rebooked schedule</span>
                                        <span className="font-semibold text-right">{fmt(appt.start)} at {fmtTime(appt.start)}</span>
                                    </div>
                                    {appt.rebookedAt && (
                                        <div className="flex justify-between gap-3 text-xs">
                                            <span className="opacity-60">Requested</span>
                                            <span className="text-right">{dayjs(appt.rebookedAt).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")}</span>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="flex justify-between gap-3">
                                    <span className="opacity-60">Rebook deadline</span>
                                    <span className="font-semibold text-right">{rebookDeadline || "Within 3 days"}</span>
                                </div>
                            )}
                            {appt.rebookFeePaid && appt.rebookFeeRef && (
                                <p className="text-xs opacity-60">Rebooking fee ref: <span className="font-mono">{appt.rebookFeeRef}</span></p>
                            )}
                            {appt.cashbackAmount > 0 && (
                                <p className="text-xs opacity-60">Mock cashback: ₱{appt.cashbackAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</p>
                            )}
                        </div>
                    )}

                    {/* Main action area */}
                    {renderActions()}

                    {/* Appointment Files */}
                    {appt._id && (
                        <div className="pt-2 border-t border-base-300">
                            <AppointmentFilesPanel
                                appointmentId={appt._id}
                                participantRole="patient"
                                readOnly={["cancelled", "rejected"].includes(appt.status)}
                            />
                        </div>
                    )}

                    {/* Files shared in chat */}
                    {appt._id && appt.doctorId && (
                        <ChatAttachmentsSection appointmentId={appt._id} />
                    )}

                    {/* Dispute section */}
                    {canDispute && !["disputed", "resolved"].includes(appt.status) && (
                        <div className="pt-2 border-t border-base-300">
                            {!showDisputeInput ? (
                                <button className="btn btn-error btn-outline btn-sm w-full gap-2" onClick={() => setShowDisputeInput(true)}>
                                    <FlagIcon className="size-3.5" />File a Dispute
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-xs opacity-60">Disputes must be filed within 8 hours of appointment start time.</p>
                                    <textarea
                                        className="textarea textarea-bordered w-full text-sm resize-none"
                                        rows={3}
                                        placeholder="Describe your complaint..."
                                        value={disputeText}
                                        onChange={(e) => setDisputeText(e.target.value)}
                                    />
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost btn-sm flex-1" onClick={() => setShowDisputeInput(false)}>Back</button>
                                        <button
                                            className="btn btn-error btn-sm flex-1"
                                            disabled={!disputeText.trim() || isDisputing}
                                            onClick={() => dispute()}
                                        >
                                            Submit Dispute
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
            {showRebook && canRebookAppointment && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold">Rebook Appointment</h2>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowRebook(false)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <div className="space-y-4">
                            <div className="rounded-xl border border-base-300 bg-base-200 p-3 text-sm">
                                <div className="flex justify-between">
                                    <span className="opacity-60">Deadline</span>
                                    <span className="font-semibold text-right">{rebookDeadline || "3 days from missed appointment"}</span>
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="opacity-60">Fee</span>
                                    <span className="font-semibold">
                                        {appt.status === "missed_by_patient"
                                            ? `₱${rebookFee.toLocaleString("en-PH", { minimumFractionDigits: 2 })}`
                                            : "Free"}
                                    </span>
                                </div>
                            </div>

                            {slotsLoading ? (
                                <div className="flex items-center justify-center gap-2 py-8 text-sm opacity-60">
                                    <span className="loading loading-spinner loading-sm" />
                                    Loading slots...
                                </div>
                            ) : availableDates.length === 0 ? (
                                <p className="text-sm opacity-60 text-center py-6">No available slots found.</p>
                            ) : (
                                <>
                                    <p className="text-sm font-semibold">Select a Date</p>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs btn-circle"
                                                disabled={!calendarMonth.isAfter(today.startOf("month"))}
                                                onClick={() => setCalendarMonth((m) => m.subtract(1, "month"))}
                                            >
                                                <ChevronLeftIcon className="size-3.5" />
                                            </button>
                                            <span className="text-sm font-semibold">{calendarMonth.format("MMMM YYYY")}</span>
                                            <button
                                                type="button"
                                                className="btn btn-ghost btn-xs btn-circle"
                                                disabled={!calendarMonth.isBefore(maxMonth)}
                                                onClick={() => setCalendarMonth((m) => m.add(1, "month"))}
                                            >
                                                <ChevronRightIcon className="size-3.5" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-7 gap-0.5">
                                            {DOW.map((d) => (
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
                                                        onClick={() => selectRebookDate(dateStr)}
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
                                        <p className="text-xs opacity-40 text-center">Dots indicate available days</p>
                                    </div>

                                    <div className="rounded-xl border border-base-300 bg-base-200 p-3 text-sm">
                                        <p className="font-semibold">
                                            {selectedDate ? dayjs(selectedDate).tz(PH_TZ).format("dddd, MMMM D, YYYY") : "Select a date"}
                                        </p>
                                        <div className="mt-1 flex items-center gap-1.5 text-xs opacity-60">
                                            <UsersIcon className="size-3.5" />
                                            {slotsForDate.length > 0
                                                ? <span>{slotsForDate.length} appointment slot{slotsForDate.length !== 1 ? "s" : ""} available this day.</span>
                                                : "No queue slots available for this date."}
                                        </div>
                                        <p className="mt-1 text-xs opacity-40">Your exact time will be assigned based on queue order after doctor approval.</p>
                                    </div>
                                </>
                            )}

                            <button className="btn btn-primary w-full" disabled={!selectedSlot || isRebooking} onClick={submitRebook}>
                                {isRebooking
                                    ? <><span className="loading loading-spinner loading-xs" />Rebooking...</>
                                    : appt.status === "missed_by_patient" ? "Pay Fee & Rebook" : "Confirm Rebook"}
                            </button>
                            <p className="text-xs text-center opacity-50">
                                Rebooking is available once within 3 days for virtual missed appointments.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewPendingAppointmentPatientPopup;
