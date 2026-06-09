import { useState } from "react";
import { useNavigate } from "react-router";
import { Link } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { XIcon, StarIcon, UserIcon, MessageCircleIcon, FlagIcon } from "lucide-react";
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
};

const CHAT_STATUSES = ["accepted", "ongoing", "awaiting_balance", "completed", "fully_paid", "disputed"];

const ViewPendingAppointmentPatientPopup = ({ appointment: appt, onClose, onUpdated }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [reviewRating, setReviewRating] = useState(0);
    const [reviewText, setReviewText] = useState("");
    const [disputeText, setDisputeText] = useState("");
    const [showDisputeInput, setShowDisputeInput] = useState(false);

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

    if (!appt) return null;

    const durationMin = Math.round((new Date(appt.end) - new Date(appt.start)) / 60000);
    const canDispute = ["ongoing", "completed", "awaiting_balance", "fully_paid"].includes(appt.status);
    const providerId = appt.doctorId?._id || appt.doctorId || appt.instituteId?._id || appt.instituteId;
    const canChat = CHAT_STATUSES.includes(appt.status) && providerId;

    const goToPayment = (type) => {
        const amount = type === "deposit" ? appt.depositAmount : appt.balanceAmount;
        navigate(`/mock-payment?appointmentId=${appt._id}&type=${type}&amount=${amount}`);
        onClose();
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
                        <span className="text-sm font-semibold">{STATUS_LABEL[appt.status] || appt.status}</span>
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
                    </div>

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
        </div>
    );
};

export default ViewPendingAppointmentPatientPopup;
