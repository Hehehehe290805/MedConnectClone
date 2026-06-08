import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { rejectClaim } from "../lib/api";
import toast from "react-hot-toast";
import { XIcon } from "lucide-react";

const ViewPendingClaimPopup = ({ claim, onClose, onClaimApproved, onClaimRejected, otherPendingClaims = [] }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState(null);
    const [licenseNumber, setLicenseNumber] = useState(null);
    const [licenseLoading, setLicenseLoading] = useState(false);
    const [doctorSpecialties, setDoctorSpecialties] = useState([]);
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    if (!claim) return null;

    // Fall back to field presence for old records that pre-date the claimType field
    const isServiceClaim = claim.claimType === "service" || Boolean(claim.departmentId);
    const doctorId = claim.doctorId?._id || claim.doctorId;

    useEffect(() => {
        if (!doctorId || isServiceClaim) return;

        const fetchLicenseNumber = async () => {
            try {
                setLicenseLoading(true);
                const res = await axiosInstance.get(`/admin/license/${doctorId}`);
                setLicenseNumber(res.data.licenseNumber || null);
            } catch {
                setLicenseNumber(null);
            } finally {
                setLicenseLoading(false);
            }
        };

        const fetchDoctorSpecialties = async () => {
            try {
                const res = await axiosInstance.get(`/specialties/doctor/${doctorId}`);
                setDoctorSpecialties(res.data.specialties || []);
            } catch {
                setDoctorSpecialties([]);
            }
        };

        fetchLicenseNumber();
        fetchDoctorSpecialties();
    }, [doctorId, isServiceClaim]);

    const handleApprove = async () => {
        try {
            setLoading(true);
            setError(null);
            await axiosInstance.patch("/admin/approve-claim", { claimId: claim._id });
            toast.success("Claim approved.");
            onClaimApproved?.(claim._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to approve claim");
        } finally {
            setLoading(false);
        }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            await rejectClaim({ claimId: claim._id });
            toast.success("Claim rejected.");
            onClaimRejected?.(claim._id);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to reject.");
        } finally {
            setIsRejecting(false); setShowRejectConfirm(false);
        }
    };

    const itemName = claim.specialtyId?.name || claim.subspecialtyId?.name || claim.serviceId?.name || "—";
    const itemType = claim.claimType?.charAt(0).toUpperCase() + claim.claimType?.slice(1) || "Claim";

    const doctorName = claim.doctorId?.firstName
        ? `${claim.doctorId.firstName} ${claim.doctorId.lastName}`
        : claim.doctorId?.email || "Unknown";
    const doctorEmail = claim.doctorId?.email || "";

    const deptName = claim.departmentId?.technologistFirstName
        ? `${claim.departmentId.technologistFirstName} ${claim.departmentId.technologistLastName || ""}`.trim()
        : claim.departmentId?.email || "Department";
    const deptEmail = claim.departmentId?.email || "";
    const instituteName = claim.departmentId?.rootInstitute?.instituteName || "";
    const claimerName = isServiceClaim ? deptName : doctorName;
    const claimerEmail = isServiceClaim ? deptEmail : doctorEmail;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Claim Review</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} disabled={loading || isRejecting}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {error && <p className="text-error text-sm">{error}</p>}

                {/* Claim info */}
                <div className="space-y-3">
                    <div className="bg-base-200 rounded-lg p-3 space-y-2">
                        <div className="flex items-center gap-2">
                            <span className="badge badge-primary badge-sm">{itemType}</span>
                        </div>
                        <p className="font-semibold text-lg">{itemName}</p>
                        <p className="text-xs opacity-60">Submitted {new Date(claim.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}</p>
                    </div>

                    {/* Claimant info */}
                    <div className="bg-base-200 rounded-lg p-3 space-y-1">
                        <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Claimed By</p>
                        <p className="font-semibold">{claimerName}</p>
                        {instituteName && <p className="text-xs opacity-60">{instituteName}</p>}
                        {claimerEmail && <p className="text-xs opacity-50">{claimerEmail}</p>}
                        {!isServiceClaim && (
                            licenseLoading ? (
                                <p className="text-xs opacity-50">Loading license…</p>
                            ) : licenseNumber ? (
                                <p className="text-xs font-mono">License: {licenseNumber}</p>
                            ) : null
                        )}
                        {isServiceClaim && (
                            <div className="space-y-1 mt-2 pt-2 border-t border-base-300">
                                {claim.durationMinutes && (
                                    <div className="flex justify-between text-xs">
                                        <span className="opacity-50">Duration</span>
                                        <span className="font-medium">{claim.durationMinutes} min</span>
                                    </div>
                                )}
                                {claim.maxPatientsPerDay && (
                                    <div className="flex justify-between text-xs">
                                        <span className="opacity-50">Max patients/day</span>
                                        <span className="font-medium">{claim.maxPatientsPerDay}</span>
                                    </div>
                                )}
                                {claim.price != null && (
                                    <div className="flex justify-between text-xs">
                                        <span className="opacity-50">Price</span>
                                        <span className="font-medium text-primary">₱{Number(claim.price).toLocaleString("en-PH")}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Doctor-specific: other pending claims */}
                    {!isServiceClaim && otherPendingClaims.length > 0 && (
                        <div className="bg-base-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Other Pending Claims</p>
                            <div className="flex flex-wrap gap-1">
                                {otherPendingClaims.map(c => (
                                    <span key={c._id} className="badge badge-sm badge-warning">
                                        {c.subspecialtyId?.name || c.specialtyId?.name || "—"} ({c.claimType})
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Doctor-specific: approved specialties */}
                    {!isServiceClaim && doctorSpecialties.length > 0 && (
                        <div className="bg-base-200 rounded-lg p-3 space-y-2">
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Doctor's Approved Specialties</p>
                            <div className="flex flex-wrap gap-1">
                                {doctorSpecialties.map(s => (
                                    <span key={s._id} className="badge badge-sm badge-ghost">{s.name}</span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex gap-2 pt-2">
                    <button className="btn btn-success flex-1" onClick={handleApprove} disabled={loading || isRejecting}>
                        {loading ? <span className="loading loading-spinner loading-xs" /> : "Approve"}
                    </button>
                    <button className="btn btn-error btn-outline flex-1" onClick={() => setShowRejectConfirm(true)} disabled={loading || isRejecting}>
                        Reject
                    </button>
                </div>
            </div>

            {/* Reject confirm modal */}
            {showRejectConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                        <h3 className="font-bold text-lg">Reject Claim?</h3>
                        <p className="text-sm opacity-70">This will reject the <strong>{itemName}</strong> claim by {claimerName}.</p>
                        <div className="flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowRejectConfirm(false)} disabled={isRejecting}>Cancel</button>
                            <button className="btn btn-error btn-sm" onClick={handleReject} disabled={isRejecting}>
                                {isRejecting ? <span className="loading loading-spinner loading-xs" /> : "Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewPendingClaimPopup;
