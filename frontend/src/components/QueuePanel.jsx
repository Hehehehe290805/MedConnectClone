import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import toast from "react-hot-toast";
import { UsersIcon, ArrowRightCircleIcon, UserXIcon, UserPlusIcon, ZapIcon, RefreshCwIcon } from "lucide-react";

const TYPE_BADGE = { booked: "badge-ghost", walkin: "badge-primary", emergency: "badge-error" };
const TYPE_LABEL = { booked: "Booked", walkin: "Walk-in", emergency: "Emergency" };

const QueuePanel = () => {
    const queryClient = useQueryClient();
    const [showWalkinForm, setShowWalkinForm] = useState(false);
    const [walkinFirst, setWalkinFirst] = useState("");
    const [walkinLast, setWalkinLast] = useState("");
    const [walkinType, setWalkinType] = useState("walkin");
    const [showNoShowConfirm, setShowNoShowConfirm] = useState(false);

    const { data, isLoading, refetch } = useQuery({
        queryKey: ["queue-today"],
        queryFn: () => axiosInstance.get("/queue/today").then(r => r.data.data),
        refetchInterval: 30_000,
    });

    const queue = data?.queue;
    const slots = queue?.slots || [];
    const activeSlot = slots.find(s => s.status === "active");
    const waitingSlots = slots.filter(s => s.status === "waiting");
    const doneSlots = slots.filter(s => ["done", "cancelled", "skipped"].includes(s.status));

    const inval = () => queryClient.invalidateQueries({ queryKey: ["queue-today"] });

    const { mutate: buildQueue, isPending: isBuilding } = useMutation({
        mutationFn: () => axiosInstance.post("/queue/build"),
        onSuccess: () => { toast.success("Queue built for today."); inval(); },
        onError: (e) => toast.error(e?.response?.data?.message || "Failed to build queue."),
    });

    const { mutate: advance, isPending: isAdvancing } = useMutation({
        mutationFn: () => axiosInstance.post("/queue/advance"),
        onSuccess: () => { toast.success("Advanced to next patient."); inval(); },
        onError: (e) => toast.error(e?.response?.data?.message || "Cannot advance yet."),
    });

    const { mutate: handleNoShow, isPending: isNoShowing } = useMutation({
        mutationFn: (outcome) => axiosInstance.post("/queue/no-show", { outcome }),
        onSuccess: (_, outcome) => {
            toast.success(outcome === "skip" ? "Patient skipped to end of queue." : "Appointment cancelled.");
            setShowNoShowConfirm(false);
            inval();
        },
        onError: (e) => toast.error(e?.response?.data?.message || "Failed."),
    });

    const { mutate: addWalkin, isPending: isAddingWalkin } = useMutation({
        mutationFn: () => axiosInstance.post("/queue/walkin", {
            patientFirstName: walkinFirst.trim(),
            patientLastName: walkinLast.trim(),
            type: walkinType,
        }),
        onSuccess: () => {
            toast.success(`${walkinType === "emergency" ? "Emergency" : "Walk-in"} added to queue.`);
            setShowWalkinForm(false);
            setWalkinFirst(""); setWalkinLast(""); setWalkinType("walkin");
            inval();
        },
        onError: (e) => toast.error(e?.response?.data?.message || "Failed to add."),
    });

    if (isLoading) {
        return (
            <div className="card bg-base-200 p-4 flex items-center justify-center py-8">
                <span className="loading loading-spinner loading-sm" />
            </div>
        );
    }

    if (!queue || !queue.isActive) {
        return (
            <div className="card bg-base-200 border border-base-300 p-5">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <UsersIcon className="size-5 text-primary" />
                        <h3 className="font-semibold">Today's Queue</h3>
                    </div>
                    <button className="btn btn-primary btn-sm" disabled={isBuilding} onClick={() => buildQueue()}>
                        {isBuilding ? <span className="loading loading-spinner loading-xs" /> : "Build Queue"}
                    </button>
                </div>
                <p className="text-sm opacity-50">Queue hasn't been built yet for today. Click "Build Queue" to load today's accepted appointments.</p>
            </div>
        );
    }

    return (
        <div className="card bg-base-200 border border-base-300 p-5 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                    <UsersIcon className="size-5 text-primary" />
                    <h3 className="font-semibold">Today's Queue</h3>
                    <span className="badge badge-primary badge-sm">{waitingSlots.length} waiting</span>
                    {doneSlots.length > 0 && <span className="badge badge-ghost badge-sm">{doneSlots.length} done</span>}
                </div>
                <div className="flex items-center gap-2">
                    <button className="btn btn-ghost btn-xs gap-1" onClick={() => refetch()}>
                        <RefreshCwIcon className="size-3" />
                    </button>
                    <button className="btn btn-outline btn-xs gap-1" onClick={() => setShowWalkinForm(v => !v)}>
                        <UserPlusIcon className="size-3" /> Add Walk-in
                    </button>
                </div>
            </div>

            {/* Add walk-in form */}
            {showWalkinForm && (
                <div className="bg-base-100 rounded-xl p-3 space-y-3 border border-base-300">
                    <p className="text-sm font-semibold">Add Patient</p>
                    <div className="grid grid-cols-2 gap-2">
                        <input className="input input-sm input-bordered" placeholder="First name" value={walkinFirst} onChange={e => setWalkinFirst(e.target.value)} />
                        <input className="input input-sm input-bordered" placeholder="Last name" value={walkinLast} onChange={e => setWalkinLast(e.target.value)} />
                    </div>
                    <div className="join w-full">
                        <button type="button" className={`join-item btn btn-xs flex-1 ${walkinType === "walkin" ? "btn-primary" : "btn-ghost"}`} onClick={() => setWalkinType("walkin")}>
                            Walk-in (end of queue)
                        </button>
                        <button type="button" className={`join-item btn btn-xs flex-1 gap-1 ${walkinType === "emergency" ? "btn-error" : "btn-ghost"}`} onClick={() => setWalkinType("emergency")}>
                            <ZapIcon className="size-3" /> Emergency (front)
                        </button>
                    </div>
                    <div className="flex gap-2 justify-end">
                        <button className="btn btn-ghost btn-xs" onClick={() => setShowWalkinForm(false)}>Cancel</button>
                        <button className="btn btn-primary btn-xs" disabled={!walkinFirst.trim() || !walkinLast.trim() || isAddingWalkin} onClick={() => addWalkin()}>
                            {isAddingWalkin ? <span className="loading loading-spinner loading-xs" /> : "Add"}
                        </button>
                    </div>
                </div>
            )}

            {/* Active slot */}
            {activeSlot ? (
                <div className="bg-success/5 border border-success/30 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <div>
                            <p className="text-xs font-medium text-success uppercase tracking-wide">Now Serving — Slot #{activeSlot.position}</p>
                            <p className="font-bold text-lg">{activeSlot.patientName || "Patient"}</p>
                            <span className={`badge badge-xs ${TYPE_BADGE[activeSlot.type]}`}>{TYPE_LABEL[activeSlot.type]}</span>
                        </div>
                        <div className="flex gap-2">
                            {!showNoShowConfirm ? (
                                <>
                                    <button className="btn btn-ghost btn-sm gap-1 text-warning" onClick={() => setShowNoShowConfirm(true)}>
                                        <UserXIcon className="size-4" /> No-show
                                    </button>
                                    <button className="btn btn-success btn-sm gap-1" disabled={isAdvancing} onClick={() => advance()}>
                                        {isAdvancing ? <span className="loading loading-spinner loading-xs" /> : <><ArrowRightCircleIcon className="size-4" /> Next Patient</>}
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col gap-1.5 items-end">
                                    <p className="text-xs text-warning">Patient didn't show. What to do?</p>
                                    <div className="flex gap-2">
                                        <button className="btn btn-ghost btn-xs" onClick={() => setShowNoShowConfirm(false)}>Cancel</button>
                                        <button className="btn btn-warning btn-xs" disabled={isNoShowing} onClick={() => handleNoShow("skip")}>
                                            Skip to End
                                        </button>
                                        <button className="btn btn-error btn-xs" disabled={isNoShowing} onClick={() => handleNoShow("cancel")}>
                                            Cancel (no refund)
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : waitingSlots.length > 0 ? (
                <div className="flex items-center justify-between bg-base-100 rounded-xl p-4 border border-base-300">
                    <p className="text-sm opacity-60">Queue ready — call the first patient</p>
                    <button className="btn btn-primary btn-sm gap-1" disabled={isAdvancing} onClick={() => advance()}>
                        <ArrowRightCircleIcon className="size-4" /> Start Queue
                    </button>
                </div>
            ) : null}

            {/* Waiting list */}
            {waitingSlots.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-xs font-semibold uppercase opacity-50 tracking-wide">Up Next</p>
                    {waitingSlots.map((slot) => (
                        <div key={slot._id} className="flex items-center gap-3 bg-base-100 rounded-lg px-3 py-2">
                            <span className="size-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                {slot.position}
                            </span>
                            <span className="text-sm font-medium flex-1 truncate">{slot.patientName || "Patient"}</span>
                            <span className={`badge badge-xs ${TYPE_BADGE[slot.type]}`}>{TYPE_LABEL[slot.type]}</span>
                        </div>
                    ))}
                </div>
            )}

            {slots.length === 0 && (
                <p className="text-sm opacity-40 text-center py-2">No patients in queue today.</p>
            )}
        </div>
    );
};

export default QueuePanel;
