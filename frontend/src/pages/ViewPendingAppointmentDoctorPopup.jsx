import { useState } from "react";
import { useNavigate } from "react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router";
import { XIcon, UserIcon, MessageCircleIcon, FlagIcon, ShieldOffIcon } from "lucide-react";
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

const ViewPendingAppointmentDoctorPopup = ({ appointment: appt, onClose, onUpdated }) => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [rejectReason, setRejectReason] = useState("");
    const [showRejectInput, setShowRejectInput] = useState(false);
    const [disputeText, setDisputeText] = useState("");
    const [showDisputeInput, setShowDisputeInput] = useState(false);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["myAppointments"] });
        onUpdated?.();
    };

    const { mutate: accept, isPending: isAccepting } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/accept", { appointmentId: appt._id }),
        onSuccess: () => { toast.success("Appointment accepted!"); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to accept."),
    });

    const { mutate: reject, isPending: isRejecting } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/reject", { appointmentId: appt._id, reason: rejectReason }),
        onSuccess: () => { toast.success("Appointment rejected."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to reject."),
    });

    const { mutate: complete, isPending: isCompleting } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/complete", { appointmentId: appt._id }),
        onSuccess: () => { toast.success("Marked as complete."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed."),
    });

    const { mutate: dispute, isPending: isDisputing } = useMutation({
        mutationFn: () => axiosInstance.post("/booking/dispute", { appointmentId: appt._id, complaint: disputeText }),
        onSuccess: () => { toast.success("Dispute filed."); invalidate(); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to file dispute."),
    });

    const { mutate: blockPatient, isPending: isBlocking } = useMutation({
        mutationFn: (patientId) => axiosInstance.post("/users/block", { patientId }),
        onSuccess: () => { toast.success("Patient blocked and their reviews removed."); onClose(); },
        onError: (err) => toast.error(err?.response?.data?.message || "Failed to block patient."),
    });

    const [showBlockConfirm, setShowBlockConfirm] = useState(false);

    if (!appt) return null;

    const durationMin = Math.round((new Date(appt.end) - new Date(appt.start)) / 60000);
    const canDispute = ["ongoing", "completed", "awaiting_balance", "fully_paid"].includes(appt.status);
    const patientId = appt.patientId?._id || appt.patientId;
    const canChat = CHAT_STATUSES.includes(appt.status) && patientId;

    const renderActions = () => {
        switch (appt.status) {
            case "pending_payment":
                return <p className="text-sm opacity-60">Waiting for patient to pay the deposit.</p>;
            case "deposit_paid":
                return (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Deposit received — accept or reject this appointment.</p>
                        {!showRejectInput ? (
                            <div className="flex gap-2">
                                <button className="btn btn-success flex-1" disabled={isAccepting} onClick={() => accept()}>
                                    {isAccepting ? <span className="loading loading-spinner loading-sm" /> : "Accept"}
                                </button>
                                <button className="btn btn-error btn-outline flex-1" onClick={() => setShowRejectInput(true)}>
                                    Reject
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <textarea
                                    className="textarea textarea-bordered w-full text-sm resize-none"
                                    rows={3}
                                    placeholder="Reason for rejection (optional)..."
                                    value={rejectReason}
                                    onChange={(e) => setRejectReason(e.target.value)}
                                />
                                <div className="flex gap-2">
                                    <button className="btn btn-ghost btn-sm flex-1" onClick={() => setShowRejectInput(false)}>Back</button>
                                    <button className="btn btn-error btn-sm flex-1" disabled={isRejecting} onClick={() => reject()}>
                                        {isRejecting ? <span className="loading loading-spinner loading-sm" /> : "Confirm Reject"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            case "accepted":
                return (
                    <div className="space-y-2">
                        <p className="text-sm font-semibold">Confirmed — starts {fmt(appt.start)} at {fmtTime(appt.start)}.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${patientId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Message Patient
                            </button>
                        )}
                    </div>
                );
            case "ongoing":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Appointment is in progress.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${patientId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                        <button className="btn btn-primary w-full" disabled={isCompleting} onClick={() => complete()}>
                            Mark as Complete
                        </button>
                    </div>
                );
            case "completed":
            case "awaiting_balance":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Appointment complete. Waiting for patient to pay the balance.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${patientId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                    </div>
                );
            case "fully_paid":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">Payment received. Appointment fully paid.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${patientId}`); onClose(); }}>
                                <MessageCircleIcon className="size-4" />Open Chat
                            </button>
                        )}
                    </div>
                );
            case "cancelled":
                return <p className="text-sm opacity-60">Patient cancelled this appointment. The deposit has been forfeited.</p>;
            case "rejected":
                return <p className="text-sm opacity-60">You rejected this appointment. The patient's deposit was refunded.</p>;
            case "disputed":
                return (
                    <div className="space-y-2">
                        <p className="text-sm opacity-60">A dispute was filed. Awaiting admin resolution.</p>
                        {canChat && (
                            <button className="btn btn-ghost btn-sm w-full gap-2" onClick={() => { navigate(`/chat/${patientId}`); onClose(); }}>
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
                        {patientId && (
                            <Link
                                to={`/profile/${patientId}`}
                                className="btn btn-ghost btn-xs gap-1 opacity-60"
                                onClick={onClose}
                            >
                                <UserIcon className="size-3" />Patient Profile
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
                            <span>Total Price</span>
                            <span>₱{appt.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between opacity-60 text-xs">
                            <span>Platform Fee (10%)</span>
                            <span>-₱{appt.platformFee?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between text-xs font-medium opacity-60">
                            <span>You Receive (after completion)</span>
                            <span>₱{((appt.amount || 0) - (appt.platformFee || 0)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="divider my-1" />
                        <div className="flex justify-between">
                            <span className="opacity-70">Deposit (held)</span>
                            <span className={appt.depositPaid ? "text-success" : ""}>
                                ₱{appt.depositAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                {appt.depositPaid ? " ✓" : ""}
                            </span>
                        </div>
                        {appt.virtual && (
                            <div className="flex justify-between">
                                <span className="opacity-70">Balance</span>
                                <span className={appt.balancePaid ? "text-success" : ""}>
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

                    {/* Main actions */}
                    {renderActions()}

                    {/* Appointment Files */}
                    {appt._id && (
                        <div className="pt-2 border-t border-base-300">
                            <AppointmentFilesPanel
                                appointmentId={appt._id}
                                participantRole="doctor"
                                readOnly={["cancelled", "rejected"].includes(appt.status)}
                            />
                        </div>
                    )}

                    {/* Files shared in chat */}
                    {appt._id && appt.patientId && (
                        <ChatAttachmentsSection appointmentId={appt._id} />
                    )}

                    {/* Dispute */}
                    {canDispute && !["disputed", "resolved"].includes(appt.status) && (
                        <div className="pt-2 border-t border-base-300">
                            {!showDisputeInput ? (
                                <button className="btn btn-ghost btn-sm w-full gap-2 opacity-60" onClick={() => setShowDisputeInput(true)}>
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
                    {/* Block patient */}
                    {patientId && (
                        <div className="pt-2 border-t border-base-300">
                            {!showBlockConfirm ? (
                                <button
                                    className="btn btn-ghost btn-xs w-full gap-1 text-error opacity-50 hover:opacity-100"
                                    onClick={() => setShowBlockConfirm(true)}
                                >
                                    <ShieldOffIcon className="size-3" />Block this patient
                                </button>
                            ) : (
                                <div className="space-y-2 bg-error/5 border border-error/20 rounded-xl p-3">
                                    <p className="text-xs text-error font-medium">Block this patient?</p>
                                    <p className="text-xs opacity-60">They will no longer be able to find or book you. All reviews they left on your profile will be deleted. This cannot be undone from the platform.</p>
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost btn-xs flex-1" onClick={() => setShowBlockConfirm(false)}>Cancel</button>
                                        <button
                                            className="btn btn-error btn-xs flex-1"
                                            disabled={isBlocking}
                                            onClick={() => blockPatient(patientId)}
                                        >
                                            {isBlocking ? <span className="loading loading-spinner loading-xs" /> : "Confirm Block"}
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

export default ViewPendingAppointmentDoctorPopup;
