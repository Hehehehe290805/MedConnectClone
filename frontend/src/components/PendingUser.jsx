import { useState } from "react";
import { rejectRole } from "../lib/api";
import toast from "react-hot-toast";

const PendingUser = ({ user, onViewDetails, onRejected }) => {
    const [isRejecting, setIsRejecting] = useState(false);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            await rejectRole({ userId: user._id });
            toast.success("Account rejected.");
            onRejected?.(user._id);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to reject.");
        } finally {
            setIsRejecting(false);
            setShowRejectConfirm(false);
        }
    };

    const displayName = user.firstName
        ? `${user.firstName} ${user.lastName || ""}`.trim()
        : user.instituteName || user.pharmacyName || user._id;

    return (
        <>
            <div className="flex items-center justify-between p-4 border rounded shadow-sm bg-base-100 mb-2 gap-2">
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{displayName}</p>
                    <span className="badge badge-outline badge-xs capitalize">{user.role}</span>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-sm btn-primary" onClick={() => onViewDetails(user)}>View</button>
                    <button className="btn btn-sm btn-error btn-outline" onClick={() => setShowRejectConfirm(true)} disabled={isRejecting}>
                        {isRejecting ? <span className="loading loading-spinner loading-xs" /> : "Reject"}
                    </button>
                </div>
            </div>

            {showRejectConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-5 w-full max-w-xs space-y-3 shadow-xl">
                        <p className="text-sm">Reject account for <strong>{displayName}</strong>?</p>
                        <div className="flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowRejectConfirm(false)} disabled={isRejecting}>Cancel</button>
                            <button className="btn btn-error btn-sm" onClick={handleReject} disabled={isRejecting}>
                                {isRejecting ? <span className="loading loading-spinner loading-xs" /> : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default PendingUser;
