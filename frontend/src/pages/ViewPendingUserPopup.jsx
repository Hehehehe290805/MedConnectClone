import { useState } from "react";
import { axiosInstance } from "../lib/axios";
import { rejectRole, approveRoleWithItems, editSuggestion } from "../lib/api";
import ImagePreviewModal from "../components/ImagePreviewModal.jsx";
import toast from "react-hot-toast";
import { XIcon } from "lucide-react";

const REJECT_REASONS = [
    "Image is broken or unreadable",
    "License expired or invalid",
    "Business permit invalid",
    "Construction permit invalid",
    "ID does not match information",
    "Insufficient documentation",
];

const ViewPendingUserPopup = ({ user, onClose, onUserApproved, onUserRejected, pendingSuggestions = [], pendingClaims = [] }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [selectedReasons, setSelectedReasons] = useState([]);
    const [customReason, setCustomReason] = useState("");

    const userSuggestions = pendingSuggestions.filter(
        (s) => (s.suggestedBy?._id || s.suggestedBy)?.toString() === user?._id?.toString()
    );
    const [itemDecisions, setItemDecisions] = useState(() =>
        Object.fromEntries(userSuggestions.map((s) => [s._id, "approve"]))
    );
    const [editedNames, setEditedNames] = useState(() =>
        Object.fromEntries(userSuggestions.map((s) => [s._id, s.name]))
    );

    if (!user) return null;

    const handleApprove = async () => {
        setLoading(true); setError(null);
        try {
            if (userSuggestions.length > 0) {
                for (const s of userSuggestions) {
                    if (itemDecisions[s._id] === "approve" && editedNames[s._id]?.trim() && editedNames[s._id] !== s.name) {
                        await editSuggestion({ id: s._id, name: editedNames[s._id].trim() });
                    }
                }
                const approvedSuggestions = userSuggestions.filter((s) => itemDecisions[s._id] === "approve").map((s) => s._id);
                const rejectedSuggestions = userSuggestions.filter((s) => itemDecisions[s._id] === "reject").map((s) => s._id);
                await approveRoleWithItems({ userId: user._id, approvedSuggestions, rejectedSuggestions });
            } else {
                await axiosInstance.patch("/admin/approve-role", { userId: user._id });
            }
            toast.success("Account approved.");
            onUserApproved?.(user._id);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to approve");
        } finally { setLoading(false); }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            const parts = [...selectedReasons];
            if (customReason.trim()) parts.push(customReason.trim());
            const rejectionReason = parts.join("; ") || undefined;
            await rejectRole({ userId: user._id, rejectionReason });
            toast.success("Account rejected.");
            onUserRejected?.(user._id);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to reject");
        } finally {
            setIsRejecting(false);
            setShowRejectModal(false);
        }
    };

    const toggleReason = (reason) =>
        setSelectedReasons(prev =>
            prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
        );

    const renderRoleFields = () => {
        switch (user.role) {
            case "doctor":
                return (
                    <div className="space-y-2 text-sm">
                        <p><span className="opacity-50">Name:</span> {user.firstName} {user.lastName}</p>
                        {user.birthDate && <p><span className="opacity-50">DOB:</span> {new Date(user.birthDate).toLocaleDateString("en-PH")}</p>}
                        {user.licenseExpiration && <p><span className="opacity-50">License expires:</span> {new Date(user.licenseExpiration).toLocaleDateString("en-PH")}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                            <ImagePreviewModal s3Key={user.licenseImage?.key} label="View License" />
                            <ImagePreviewModal s3Key={user.legalIDImage?.key} label="View Legal ID" />
                        </div>
                        {user.specialty?.length > 0 && (
                            <div className="pt-1">
                                <p className="opacity-50 mb-1">Claimed specialties:</p>
                                <div className="flex flex-wrap gap-1">
                                    {user.specialty.map(s => (
                                        <span key={s._id} className="badge badge-sm badge-outline">{s.name}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                        {user.subSpecialty?.length > 0 && (
                            <div className="pt-1">
                                <p className="opacity-50 mb-1">Claimed subspecialties:</p>
                                <div className="flex flex-wrap gap-1">
                                    {user.subSpecialty.map(s => (
                                        <span key={s._id} className="badge badge-sm badge-ghost">{s.name}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                );
            case "pharmacy":
                return (
                    <div className="space-y-2 text-sm">
                        <p><span className="opacity-50">Pharmacy:</span> {user.pharmacyName}</p>
                        <p><span className="opacity-50">Pharmacist:</span> {user.pharmacistFirstName} {user.pharmacistLastName}</p>
                        {user.pharmacistLicenseExpiration && <p><span className="opacity-50">License expires:</span> {new Date(user.pharmacistLicenseExpiration).toLocaleDateString("en-PH")}</p>}
                        <div className="flex flex-wrap gap-2 pt-1">
                            <ImagePreviewModal s3Key={user.pharmacistLicenseImage?.key} label="View Pharmacist License" />
                            <ImagePreviewModal s3Key={user.businessPermit?.key} label="View Business Permit" />
                            <ImagePreviewModal s3Key={user.fdaLicense?.key} label="View FDA License" />
                        </div>
                    </div>
                );
            case "institute":
                return (
                    <div className="space-y-2 text-sm">
                        <p><span className="opacity-50">Institute:</span> {user.instituteName || user.facilityName}</p>
                        <p><span className="opacity-50">Contact:</span> {user.contactFirstName} {user.contactLastName}</p>
                        <p><span className="opacity-50">Agency:</span> {user.licensingAgency}</p>
                        <p><span className="opacity-50">Type:</span> <span className="capitalize">{user.instituteType}</span></p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <ImagePreviewModal s3Key={user.businessPermit?.key} label="View Business Permit" />
                            {user.constructionPermit?.key && (
                                <ImagePreviewModal s3Key={user.constructionPermit.key} label="View Construction Permit" />
                            )}
                        </div>
                    </div>
                );
            case "admin":
                return (
                    <div className="space-y-1 text-sm">
                        <p><span className="opacity-50">Name:</span> {user.firstName} {user.lastName}</p>
                    </div>
                );
            default:
                return <p className="text-sm opacity-70">No additional details.</p>;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 p-6 rounded-xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Account Review</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} disabled={loading || isRejecting}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {error && <p className="text-error text-sm mb-3">{error}</p>}

                <div className="mb-2">
                    <span className="badge badge-sm badge-primary capitalize">{user.role}</span>
                </div>

                {renderRoleFields()}

                {pendingClaims.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-base-300">
                        <p className="font-semibold text-sm mb-2">Specialty claims (existing)</p>
                        <p className="text-xs opacity-50 mb-3">Reviewed separately in the Claims tab.</p>
                        <div className="space-y-2">
                            {pendingClaims.map((c) => {
                                const name = c.subspecialtyId?.name || c.specialtyId?.name || "Unknown";
                                return (
                                    <div key={c._id} className="bg-base-200 rounded-lg px-3 py-2 flex items-center gap-2">
                                        <span className="text-sm flex-1">{name}</span>
                                        <span className="badge badge-info badge-sm rounded-md capitalize">{c.claimType}</span>
                                        <span className="badge badge-warning badge-sm rounded-md">pending</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {userSuggestions.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-base-300">
                        <p className="font-semibold text-sm mb-3">New specialty suggestions</p>
                        <div className="space-y-3">
                            {userSuggestions.map((s) => (
                                <div key={s._id} className="bg-base-200 rounded-lg p-3">
                                    <div className="flex items-center gap-2 mb-2">
                                        <input
                                            type="text"
                                            className="input input-xs input-bordered flex-1"
                                            value={editedNames[s._id] ?? s.name}
                                            onChange={(e) => setEditedNames((p) => ({ ...p, [s._id]: e.target.value }))}
                                        />
                                        <span className="badge badge-info badge-sm rounded-md capitalize">{s.type}</span>
                                    </div>
                                    <div className="flex gap-4 text-xs">
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name={`item-${s._id}`} className="radio radio-success radio-xs"
                                                checked={itemDecisions[s._id] === "approve"}
                                                onChange={() => setItemDecisions((p) => ({ ...p, [s._id]: "approve" }))} />
                                            Approve
                                        </label>
                                        <label className="flex items-center gap-1 cursor-pointer">
                                            <input type="radio" name={`item-${s._id}`} className="radio radio-error radio-xs"
                                                checked={itemDecisions[s._id] === "reject"}
                                                onChange={() => setItemDecisions((p) => ({ ...p, [s._id]: "reject" }))} />
                                            Reject
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="flex gap-2 mt-6">
                    <button className="btn btn-success flex-1" onClick={handleApprove} disabled={loading || isRejecting}>
                        {loading ? <span className="loading loading-spinner loading-sm" /> : userSuggestions.length > 0 ? "Approve & Apply" : "Approve"}
                    </button>
                    <button className="btn btn-error btn-outline flex-1" onClick={() => { setSelectedReasons([]); setCustomReason(""); setShowRejectModal(true); }} disabled={loading || isRejecting}>
                        Reject
                    </button>
                </div>
            </div>

            {/* Reject with reason modal */}
            {showRejectModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl max-h-[85vh] overflow-y-auto">
                        <h3 className="font-bold text-lg">Reject Account</h3>
                        <p className="text-sm opacity-70">
                            Select reasons (optional) so the applicant knows what to fix:
                        </p>
                        <div className="space-y-2">
                            {REJECT_REASONS.map(reason => (
                                <label key={reason} className="flex items-center gap-2 cursor-pointer text-sm">
                                    <input
                                        type="checkbox"
                                        className="checkbox checkbox-sm checkbox-error"
                                        checked={selectedReasons.includes(reason)}
                                        onChange={() => toggleReason(reason)}
                                    />
                                    {reason}
                                </label>
                            ))}
                        </div>
                        <div>
                            <label className="label label-text text-xs">Additional note (optional)</label>
                            <textarea
                                className="textarea textarea-bordered w-full text-sm"
                                rows={2}
                                placeholder="Any other reason…"
                                value={customReason}
                                onChange={e => setCustomReason(e.target.value)}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowRejectModal(false)} disabled={isRejecting}>Cancel</button>
                            <button className="btn btn-error btn-sm" onClick={handleReject} disabled={isRejecting}>
                                {isRejecting ? <span className="loading loading-spinner loading-xs" /> : "Confirm Reject"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewPendingUserPopup;
