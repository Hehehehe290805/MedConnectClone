import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";
import {
    UsersIcon,
    ArrowRightCircleIcon,
    UserXIcon,
    UserPlusIcon,
    ZapIcon,
    ClockIcon,
    CheckCircleIcon,
    XCircleIcon,
} from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const STATUS_STYLES = {
    waiting:   "badge-warning",
    active:    "badge-success",
    done:      "badge-neutral",
    skipped:   "badge-info",
    cancelled: "badge-error",
};

const TYPE_STYLES = {
    booked:    "badge-ghost",
    walkin:    "badge-primary",
    emergency: "badge-error",
};

const TYPE_LABELS = { booked: "Booked", walkin: "Walk-in", emergency: "Emergency" };

// ── Slot Card ────────────────────────────────────────────────────────────────
const SlotCard = ({ slot, onAdvance, onNoShow, isAdvancing, isNoShowing }) => {
    const isActive = slot.status === "active";
    const isDone   = slot.status === "done" || slot.status === "cancelled";

    return (
        <div className={`card border p-4 flex flex-col gap-3 ${
            isActive  ? "border-success bg-success/5"  :
            isDone    ? "border-base-300 opacity-50"   :
                        "border-base-300 bg-base-100"
        }`}>
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                    <span className={`badge badge-lg font-mono font-bold ${
                        isActive ? "badge-success" : "badge-ghost"
                    }`}>
                        #{slot.position}
                    </span>
                    <div>
                        <p className="font-semibold text-sm">
                            Patient {slot.position}
                        </p>
                        <p className="text-xs opacity-60">
                            {dayjs(slot.currentStart).tz(PH_TZ).format("h:mm A")}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`badge badge-sm rounded-md ${TYPE_STYLES[slot.type]}`}>
                        {TYPE_LABELS[slot.type]}
                    </span>
                    <span className={`badge badge-sm rounded-md ${STATUS_STYLES[slot.status]}`}>
                        {slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                    </span>
                </div>
            </div>

            {isActive && (
                <div className="flex gap-2 flex-wrap">
                    <button
                        className="btn btn-success btn-sm gap-1 flex-1"
                        onClick={onAdvance}
                        disabled={isAdvancing}
                    >
                        <ArrowRightCircleIcon className="size-4" />
                        {isAdvancing ? "Advancing..." : "Next Patient"}
                    </button>
                    <button
                        className="btn btn-error btn-sm gap-1"
                        onClick={onNoShow}
                        disabled={isNoShowing}
                    >
                        <UserXIcon className="size-4" />
                        No-show
                    </button>
                </div>
            )}
        </div>
    );
};

// ── Walk-in Modal ────────────────────────────────────────────────────────────
const WalkinModal = ({ onClose, onSubmit, isSubmitting }) => {
    const [form, setForm] = useState({ patientFirstName: "", patientLastName: "", type: "walkin" });

    const handleChange = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!form.patientFirstName.trim() || !form.patientLastName.trim()) {
            toast.error("Please enter patient's first and last name");
            return;
        }
        onSubmit(form);
    };

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-md">
                <h3 className="font-bold text-lg mb-4">Add Patient to Queue</h3>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="form-control">
                        <label className="label"><span className="label-text">First Name</span></label>
                        <input
                            type="text"
                            name="patientFirstName"
                            className="input input-bordered"
                            value={form.patientFirstName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Last Name</span></label>
                        <input
                            type="text"
                            name="patientLastName"
                            className="input input-bordered"
                            value={form.patientLastName}
                            onChange={handleChange}
                            required
                        />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Type</span></label>
                        <select
                            name="type"
                            className="select select-bordered"
                            value={form.type}
                            onChange={handleChange}
                        >
                            <option value="walkin">Walk-in</option>
                            <option value="emergency">Emergency</option>
                        </select>
                        {form.type === "emergency" && (
                            <p className="text-xs text-error mt-1">
                                Emergency patients are placed at position #1. The current active appointment will be paused.
                            </p>
                        )}
                    </div>
                    <div className="modal-action">
                        <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? "Adding..." : "Add to Queue"}
                        </button>
                    </div>
                </form>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

// ── No-show Modal ────────────────────────────────────────────────────────────
const NoShowModal = ({ onClose, onSubmit, isSubmitting }) => {
    const [outcome, setOutcome] = useState("skip");

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-md">
                <h3 className="font-bold text-lg mb-2">Patient No-show</h3>
                <p className="text-sm opacity-70 mb-4">The current patient has not shown up. Choose an outcome:</p>

                <div className="space-y-3">
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${outcome === "skip" ? "border-primary bg-primary/5" : "border-base-300"}`}>
                        <input
                            type="radio"
                            className="radio radio-primary mt-0.5"
                            checked={outcome === "skip"}
                            onChange={() => setOutcome("skip")}
                        />
                        <div>
                            <p className="font-medium">Move to end of queue</p>
                            <p className="text-xs opacity-60">Patient gets another chance at the end. Appointment stays active.</p>
                        </div>
                    </label>
                    <label className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer ${outcome === "cancel" ? "border-error bg-error/5" : "border-base-300"}`}>
                        <input
                            type="radio"
                            className="radio radio-error mt-0.5"
                            checked={outcome === "cancel"}
                            onChange={() => setOutcome("cancel")}
                        />
                        <div>
                            <p className="font-medium text-error">Cancel appointment</p>
                            <p className="text-xs opacity-60">Appointment is cancelled. Deposit is non-refundable.</p>
                        </div>
                    </label>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Back</button>
                    <button
                        className={`btn ${outcome === "cancel" ? "btn-error" : "btn-warning"}`}
                        onClick={() => onSubmit(outcome)}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Processing..." : "Confirm"}
                    </button>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────────────────
const QueueManagementPage = () => {
    const queryClient = useQueryClient();
    const [showWalkinModal, setShowWalkinModal] = useState(false);
    const [showNoShowModal, setShowNoShowModal] = useState(false);

    const { data, isLoading, error } = useQuery({
        queryKey: ["queue-today"],
        queryFn: () => axiosInstance.get("/queue/today").then(r => r.data.data),
        refetchInterval: 30_000,   // auto-refresh every 30 seconds
    });

    const queue = data?.queue;
    const slots = queue?.slots ?? [];
    const waitingSlots  = slots.filter(s => s.status === "waiting").sort((a, b) => a.position - b.position);
    const activeSlot    = slots.find(s => s.status === "active");
    const doneSlots     = slots.filter(s => s.status === "done" || s.status === "skipped" || s.status === "cancelled");

    const { mutate: buildQueue, isPending: isBuilding } = useMutation({
        mutationFn: () => axiosInstance.post("/queue/build"),
        onSuccess: () => {
            toast.success("Queue built for today");
            queryClient.invalidateQueries({ queryKey: ["queue-today"] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to build queue"),
    });

    const { mutate: advanceQueue, isPending: isAdvancing } = useMutation({
        mutationFn: () => axiosInstance.post("/queue/advance"),
        onSuccess: () => {
            toast.success("Advanced to next patient");
            queryClient.invalidateQueries({ queryKey: ["queue-today"] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Cannot advance — current appointment may not be done yet"),
    });

    const { mutate: addWalkin, isPending: isAddingWalkin } = useMutation({
        mutationFn: (body) => axiosInstance.post("/queue/walkin", body),
        onSuccess: (res) => {
            toast.success("Patient added to queue");
            setShowWalkinModal(false);
            queryClient.invalidateQueries({ queryKey: ["queue-today"] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to add patient"),
    });

    const { mutate: noShow, isPending: isNoShowing } = useMutation({
        mutationFn: (outcome) => axiosInstance.post("/queue/no-show", { outcome }),
        onSuccess: () => {
            toast.success("No-show processed");
            setShowNoShowModal(false);
            queryClient.invalidateQueries({ queryKey: ["queue-today"] });
        },
        onError: (err) => toast.error(err.response?.data?.message || "Failed to process no-show"),
    });

    const todayLabel = dayjs().tz(PH_TZ).format("dddd, MMMM D, YYYY");

    return (
        <div className="p-8 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <UsersIcon className="size-6" /> Queue Management
                    </h1>
                    <p className="text-sm opacity-60 mt-1">{todayLabel}</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-outline btn-sm gap-1"
                        onClick={() => setShowWalkinModal(true)}
                    >
                        <UserPlusIcon className="size-4" /> Add Patient
                    </button>
                    <button
                        className="btn btn-primary btn-sm gap-1"
                        onClick={() => buildQueue()}
                        disabled={isBuilding}
                    >
                        {isBuilding ? "Building..." : "Rebuild Queue"}
                    </button>
                </div>
            </div>

            {/* Stats row */}
            {queue && (
                <div className="flex gap-3 flex-wrap">
                    <div className="stat bg-base-200 rounded-xl p-4 flex-1 min-w-28">
                        <div className="stat-title text-xs">Total</div>
                        <div className="stat-value text-2xl">{slots.length}</div>
                    </div>
                    <div className="stat bg-warning/10 rounded-xl p-4 flex-1 min-w-28">
                        <div className="stat-title text-xs">Waiting</div>
                        <div className="stat-value text-2xl text-warning">{waitingSlots.length + (activeSlot ? 1 : 0)}</div>
                    </div>
                    <div className="stat bg-success/10 rounded-xl p-4 flex-1 min-w-28">
                        <div className="stat-title text-xs">Done</div>
                        <div className="stat-value text-2xl text-success">{doneSlots.length}</div>
                    </div>
                </div>
            )}

            {/* Loading / Error */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg" />
                </div>
            )}
            {error && <div className="alert alert-error"><span>Failed to load queue.</span></div>}

            {/* No queue yet */}
            {!isLoading && !queue && (
                <div className="card border border-base-300 p-8 text-center space-y-3">
                    <ClockIcon className="size-10 opacity-30 mx-auto" />
                    <p className="font-semibold">No queue for today</p>
                    <p className="text-sm opacity-60">Click "Rebuild Queue" to generate the queue from today's accepted appointments.</p>
                </div>
            )}

            {/* Queue complete */}
            {queue && slots.length > 0 && !activeSlot && waitingSlots.length === 0 && (
                <div className="alert bg-success/10 border border-success/30">
                    <CheckCircleIcon className="size-5 text-success" />
                    <span>All patients have been seen. Queue complete for today.</span>
                </div>
            )}

            {/* Start button when no active slot yet */}
            {queue && waitingSlots.length > 0 && !activeSlot && (
                <div className="flex justify-center">
                    <button
                        className="btn btn-success gap-2"
                        onClick={() => advanceQueue()}
                        disabled={isAdvancing}
                    >
                        <ArrowRightCircleIcon className="size-5" />
                        {isAdvancing ? "Starting..." : "Start Queue"}
                    </button>
                </div>
            )}

            {/* Active slot */}
            {activeSlot && (
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-2">Now Serving</h2>
                    <SlotCard
                        slot={activeSlot}
                        onAdvance={() => advanceQueue()}
                        onNoShow={() => setShowNoShowModal(true)}
                        isAdvancing={isAdvancing}
                        isNoShowing={isNoShowing}
                    />
                </div>
            )}

            {/* Waiting slots */}
            {waitingSlots.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-2">
                        Waiting ({waitingSlots.length})
                    </h2>
                    <div className="space-y-3">
                        {waitingSlots.map((slot, i) => (
                            <SlotCard
                                key={`${slot.appointmentId}-${i}`}
                                slot={slot}
                                onAdvance={() => {}}
                                onNoShow={() => {}}
                                isAdvancing={false}
                                isNoShowing={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Done slots */}
            {doneSlots.length > 0 && (
                <div>
                    <h2 className="text-sm font-semibold uppercase tracking-wider opacity-60 mb-2">
                        Done / Closed ({doneSlots.length})
                    </h2>
                    <div className="space-y-3">
                        {doneSlots.map((slot, i) => (
                            <SlotCard
                                key={`${slot.appointmentId}-${i}`}
                                slot={slot}
                                onAdvance={() => {}}
                                onNoShow={() => {}}
                                isAdvancing={false}
                                isNoShowing={false}
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* Modals */}
            {showWalkinModal && (
                <WalkinModal
                    onClose={() => setShowWalkinModal(false)}
                    onSubmit={(form) => addWalkin(form)}
                    isSubmitting={isAddingWalkin}
                />
            )}
            {showNoShowModal && (
                <NoShowModal
                    onClose={() => setShowNoShowModal(false)}
                    onSubmit={(outcome) => noShow(outcome)}
                    isSubmitting={isNoShowing}
                />
            )}
        </div>
    );
};

export default QueueManagementPage;
