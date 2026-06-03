import { useState, useEffect } from "react";
import { PencilIcon, CheckIcon, XIcon } from "lucide-react";
import { axiosInstance } from "../lib/axios";
import { rejectSuggestion, editSuggestion } from "../lib/api";
import toast from "react-hot-toast";

const PendingSuggestion = ({ suggestion, onSuggestionApproved, onSuggestionRejected, onViewDetails }) => {
    const [loading, setLoading] = useState(false);
    const [isRejecting, setIsRejecting] = useState(false);
    const [error, setError] = useState(null);
    const [rootSpecialtyName, setRootSpecialtyName] = useState("");
    const [editing, setEditing] = useState(false);
    const [editedName, setEditedName] = useState(suggestion.name);

    useEffect(() => {
        const fetchRootSpecialtyName = async () => {
            if (suggestion.type === "subspecialty" && suggestion._id) {
                try {
                    const res = await axiosInstance.get(`/specialties/subspecialty-root/${suggestion._id}`);
                    setRootSpecialtyName(res.data.name || "Unknown");
                } catch { setRootSpecialtyName("Unknown"); }
            }
        };
        fetchRootSpecialtyName();
    }, [suggestion]);

    const handleApprove = async () => {
        setLoading(true); setError(null);
        try {
            if (editing && editedName.trim() && editedName !== suggestion.name) {
                await editSuggestion({ id: suggestion._id, name: editedName.trim() });
            }
            await axiosInstance.patch("/admin/approve", { id: suggestion._id });
            onSuggestionApproved?.(suggestion._id);
        } catch (err) {
            setError(err.response?.data?.message || "Failed to approve");
        } finally { setLoading(false); }
    };

    const [showRejectConfirm, setShowRejectConfirm] = useState(false);

    const handleReject = async () => {
        setIsRejecting(true);
        try {
            await rejectSuggestion({ id: suggestion._id });
            toast.success(`"${suggestion.name}" rejected.`);
            onSuggestionRejected?.(suggestion._id);
        } catch (err) {
            setError(err?.response?.data?.message || "Failed to reject");
        } finally { setIsRejecting(false); setShowRejectConfirm(false); }
    };

    const handleSaveName = async () => {
        if (!editedName.trim()) return;
        try { await editSuggestion({ id: suggestion._id, name: editedName.trim() }); setEditing(false); }
        catch (err) { setError(err?.response?.data?.message || "Failed to save name"); }
    };

    const getSuggestionType = () => {
        const map = { specialty: "Medical Specialty", subspecialty: "Subspecialty", service: "Service", departmenttype: "Dept. Type" };
        return map[suggestion.type] || suggestion.type;
    };

    return (
        <>
        <div className="card bg-base-200 shadow-sm mb-3">
            <div className="card-body p-4">
                <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 cursor-pointer" onClick={() => !editing && onViewDetails(suggestion)}>
                        {editing ? (
                            <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <input
                                    className="input input-sm input-bordered flex-1"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    autoFocus
                                />
                                <button className="btn btn-xs btn-success" onClick={handleSaveName}><CheckIcon className="size-3" /></button>
                                <button className="btn btn-xs btn-ghost" onClick={() => { setEditing(false); setEditedName(suggestion.name); }}><XIcon className="size-3" /></button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-1">
                                <h3 className="font-semibold text-lg">{editedName}</h3>
                                <button className="btn btn-ghost btn-xs" onClick={(e) => { e.stopPropagation(); setEditing(true); }}>
                                    <PencilIcon className="size-3 opacity-50" />
                                </button>
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                            <span className="badge badge-primary badge-sm">{getSuggestionType()}</span>
                            {suggestion.type === "subspecialty" && rootSpecialtyName && (
                                <span className="badge badge-outline badge-sm">Under: {rootSpecialtyName}</span>
                            )}
                        </div>
                        {suggestion.suggestedBy && (
                            <p className="text-xs opacity-60 mt-1">By: {suggestion.suggestedBy.firstName} {suggestion.suggestedBy.lastName}</p>
                        )}
                    </div>
                    <div className="flex flex-col gap-1 ml-2">
                        <button className="btn btn-info btn-sm" onClick={() => onViewDetails(suggestion)}>View</button>
                        <button className="btn btn-success btn-sm" onClick={handleApprove} disabled={loading || isRejecting}>
                            {loading ? <span className="loading loading-spinner loading-xs" /> : "Approve"}
                        </button>
                        <button className="btn btn-error btn-outline btn-sm" onClick={() => setShowRejectConfirm(true)} disabled={loading || isRejecting}>
                            {isRejecting ? <span className="loading loading-spinner loading-xs" /> : "Reject"}
                        </button>
                    </div>
                </div>
                {error && <p className="text-error text-xs mt-2">{error}</p>}
            </div>

        </div>

        {showRejectConfirm && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                <div className="bg-base-100 rounded-xl p-5 w-full max-w-xs space-y-3 shadow-xl">
                    <p className="text-sm">Reject "<strong>{suggestion.name}</strong>"?</p>
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

export default PendingSuggestion;
