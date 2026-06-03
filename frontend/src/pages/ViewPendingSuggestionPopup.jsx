import { useState, useEffect } from "react";
import { axiosInstance } from "../lib/axios";
import { rejectSuggestion } from "../lib/api";
import toast from "react-hot-toast";
import { XIcon } from "lucide-react";

const ViewPendingSuggestionPopup = ({ suggestion, onClose, onSuggestionApproved, onSuggestionRejected }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState(null);
    const [rootSpecialtyName, setRootSpecialtyName] = useState("");
    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    useEffect(() => {
        if (suggestion?.type === "subspecialty" && suggestion._id) {
            axiosInstance.get(`/specialties/subspecialty-root/${suggestion._id}`)
                .then((r) => setRootSpecialtyName(r.data.name || "Unknown"))
                .catch(() => setRootSpecialtyName("Unknown"));
        }
    }, [suggestion]);

    if (!suggestion) return null;

    const handleApprove = async () => {
        setLoading(true); setError(null);
        try {
            await axiosInstance.patch("/admin/approve", { id: suggestion._id });
            toast.success(`"${suggestion.name}" approved.`);
            onSuggestionApproved?.(suggestion._id);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to approve");
        } finally { setLoading(false); }
    };

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            await rejectSuggestion({ id: suggestion._id });
            toast.success(`"${suggestion.name}" rejected.`);
            onSuggestionRejected?.(suggestion._id);
            onClose();
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to reject");
        } finally { setIsRejecting(false); setShowRejectConfirm(false); }
    };

    const typeLabel = { specialty: "Medical Specialty", subspecialty: "Subspecialty", service: "Service", departmenttype: "Dept. Type" }[suggestion.type] || suggestion.type;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 p-6 rounded-xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-bold">Suggestion Details</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose} disabled={loading || isRejecting}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                {error && <p className="text-error text-sm mb-3">{error}</p>}

                <div className="space-y-3 text-sm">
                    <p><span className="opacity-50">Name:</span> <strong className="text-base">{suggestion.name}</strong></p>
                    <p><span className="opacity-50">Type:</span> <span className="badge badge-info badge-sm rounded-md">{typeLabel}</span></p>
                    {suggestion.type === "subspecialty" && rootSpecialtyName && (
                        <p><span className="opacity-50">Under:</span> {rootSpecialtyName}</p>
                    )}
                    {suggestion.suggestedBy && (
                        <div>
                            <p className="opacity-50">Suggested By:</p>
                            <p>{suggestion.suggestedBy.firstName} {suggestion.suggestedBy.lastName}</p>
                            {suggestion.suggestedBy.email && <p className="opacity-60 text-xs">{suggestion.suggestedBy.email}</p>}
                        </div>
                    )}
                    {suggestion.createdAt && (
                        <p><span className="opacity-50">Submitted:</span> {new Date(suggestion.createdAt).toLocaleDateString("en-PH")}</p>
                    )}
                </div>

                <div className="flex gap-2 mt-6">
                    <button className="btn btn-success flex-1" onClick={handleApprove} disabled={loading || isRejecting}>
                        {loading ? <span className="loading loading-spinner loading-sm" /> : "Approve"}
                    </button>
                    <button className="btn btn-error btn-outline flex-1" onClick={() => setShowRejectConfirm(true)} disabled={loading || isRejecting}>
                        Reject
                    </button>
                </div>
            </div>

            {showRejectConfirm && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                        <h3 className="font-bold text-lg">Reject Suggestion?</h3>
                        <p className="text-sm opacity-70">Reject "<strong>{suggestion.name}</strong>"? This will remove it.</p>
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

export default ViewPendingSuggestionPopup;
