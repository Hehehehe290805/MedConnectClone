import { useState } from "react";
import { axiosInstance } from "../lib/axios";
import { rejectClaim } from "../lib/api";
import toast from "react-hot-toast";

const PendingClaim = ({ claim, onClaimApproved, onClaimRejected, onViewDetails }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    const handleApprove = async () => {
        setLoading(true); setError(null);
        try {
            const res = await axiosInstance.patch("/admin/approve-claim", { claimId: claim._id });
            if (res.data.success) {
                toast.success("Claim approved.");
                onClaimApproved?.(claim._id);
            }
        } catch (err) {
            setError(err.response?.data?.message || "Failed to approve claim");
        } finally { setLoading(false); }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            await rejectClaim({ claimId: claim._id });
            toast.success("Claim rejected.");
            onClaimRejected?.(claim._id);
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to reject");
        } finally { setIsRejecting(false); setShowRejectConfirm(false); }
    };

    const getClaimType = () => {
        const map = { specialty: "Specialty", subspecialty: "Subspecialty", service: "Service" };
        return map[claim.claimType] || "Claim";
    };

    const getUserInfo = () => {
        if (claim.doctorId) return `${claim.doctorId.firstName} ${claim.doctorId.lastName}`;
        if (claim.instituteId) return claim.instituteId.facilityName || claim.instituteId.instituteName;
        return "Unknown";
    };

    const getItemInfo = () => claim.specialtyId?.name || claim.subspecialtyId?.name || claim.serviceId?.name || "Unknown";

    return (
        <>
            <div className="card bg-base-200 shadow-sm mb-3">
                <div className="card-body p-4">
                    <div className="flex justify-between items-start gap-2">
                        <div className="flex-1 cursor-pointer" onClick={() => onViewDetails(claim)}>
                            <h3 className="font-semibold text-lg">{getItemInfo()}</h3>
                            <div className="flex flex-wrap gap-2 mt-1">
                                <span className="badge badge-info badge-sm rounded-md">{getClaimType()} Claim</span>
                                <span className="badge badge-outline badge-sm">By: {getUserInfo()}</span>
                            </div>
                        </div>
                        <div className="flex flex-col gap-1 ml-2">
                            <button className="btn btn-info btn-sm" onClick={() => onViewDetails(claim)}>View</button>
                            <button className="btn btn-success btn-sm" onClick={handleApprove} disabled={loading || isRejecting}>
                                {loading ? <span className="loading loading-spinner loading-xs" /> : "Approve"}
                            </button>
                            <button className="btn btn-error btn-outline btn-sm" onClick={() => setShowRejectConfirm(true)} disabled={loading || isRejecting}>
                                Reject
                            </button>
                        </div>
                    </div>
                    {error && <p className="text-error text-xs mt-2">{error}</p>}
                </div>
            </div>

            {showRejectConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-5 w-full max-w-xs space-y-3 shadow-xl">
                        <p className="text-sm">Reject this <strong>{getClaimType()}</strong> claim by {getUserInfo()}?</p>
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

export default PendingClaim;
