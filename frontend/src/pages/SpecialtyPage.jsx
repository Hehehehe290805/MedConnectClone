import { useState, useEffect, useCallback } from "react";
import { axiosInstance } from "../lib/axios";
import ViewAllSpecialtiesPopup from "./ViewAllSpecialtiesPopup";
import SuggestPopup from "./SuggestPopup";
import toast from "react-hot-toast";
import { XIcon, PlusIcon, LightbulbIcon, Trash2Icon } from "lucide-react";

const Column = ({ title, items, emptyText, loading, showEdit, deleting, onDelete }) => (
    <div className="flex-1 min-w-0 bg-base-200 rounded-xl p-4 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-3">{title}</p>
        {loading ? (
            <div className="flex justify-center py-4">
                <span className="loading loading-spinner loading-sm" />
            </div>
        ) : items.length === 0 ? (
            <p className="text-sm opacity-40 text-center py-4">{emptyText}</p>
        ) : (
            items.map(item => (
                <div key={item._id} className="flex items-center justify-between bg-base-100 rounded-lg px-3 py-2 gap-2">
                    <span className="text-sm font-medium truncate">{item.name}</span>
                    {showEdit && (
                        <button
                            className="btn btn-ghost btn-xs text-error shrink-0"
                            onClick={() => onDelete(item._id, item.name)}
                            disabled={deleting === item._id}
                        >
                            {deleting === item._id
                                ? <span className="loading loading-spinner loading-xs" />
                                : <Trash2Icon className="size-3" />
                            }
                        </button>
                    )}
                </div>
            ))
        )}
    </div>
);

const SpecialtyPage = () => {
    const [verified, setVerified] = useState([]);
    const [pending, setPending] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEdit, setShowEdit] = useState(false);
    const [showClaim, setShowClaim] = useState(false);
    const [showSuggest, setShowSuggest] = useState(false);
    const [deleting, setDeleting] = useState(null);

    const approvedSpecialties = verified.filter(v => v.type === "specialty");
    const approvedSubspecialties = verified.filter(v => v.type === "subspecialty");

    const fetchSpecialties = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get("/specialties/doctor-specialties");
            setVerified(res.data.data?.verified || []);
            setPending(res.data.data?.pending || []);
        } catch {
            toast.error("Failed to load specialties.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchSpecialties(); }, [fetchSpecialties]);

    const handleDelete = async (claimId, name) => {
        setDeleting(claimId);
        try {
            await axiosInstance.delete(`/specialties/claim/${claimId}`);
            toast.success(`"${name}" removed.`);
            fetchSpecialties();
        } catch (err) {
            toast.error(err.response?.data?.message || "Failed to remove.");
        } finally {
            setDeleting(null);
        }
    };

    const handleClaimClose = () => { setShowClaim(false); fetchSpecialties(); };
    const handleSuggestClose = () => { setShowSuggest(false); fetchSpecialties(); };

    return (
        <div className="p-6 max-w-5xl mx-auto space-y-6">
            <h1 className="text-2xl font-bold">My Specialties</h1>

            {/* Three columns */}
            <div className="flex gap-4 items-start">
                <Column
                    title="Approved Specialties"
                    items={approvedSpecialties}
                    emptyText="No approved specialties"
                    loading={loading}
                    showEdit={showEdit}
                    deleting={deleting}
                    onDelete={handleDelete}
                />
                <Column
                    title="Approved Subspecialties"
                    items={approvedSubspecialties}
                    emptyText="No approved subspecialties"
                    loading={loading}
                    showEdit={showEdit}
                    deleting={deleting}
                    onDelete={handleDelete}
                />
                <Column
                    title="Pending Claims"
                    items={pending}
                    emptyText="No pending claims"
                    loading={loading}
                    showEdit={false}
                    deleting={deleting}
                    onDelete={handleDelete}
                />
            </div>

            {/* Edit button */}
            <div className="flex gap-3">
                {!showEdit ? (
                    <button className="btn btn-primary" onClick={() => setShowEdit(true)}>
                        Edit Specialties
                    </button>
                ) : (
                    <div className="w-full bg-base-200 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <p className="font-semibold">Edit Specialties</p>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setShowEdit(false)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>
                        <p className="text-xs opacity-50">You must keep at least one verified specialty.</p>
                        <div className="flex flex-wrap gap-2">
                            <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowClaim(true)}>
                                <PlusIcon className="size-3" /> Claim Existing
                            </button>
                            <button className="btn btn-outline btn-sm gap-1" onClick={() => setShowSuggest(true)}>
                                <LightbulbIcon className="size-3" /> Suggest New
                            </button>
                        </div>
                        <p className="text-xs opacity-50">To remove a specialty or subspecialty, click the <Trash2Icon className="size-3 inline" /> icon on its card above.</p>
                    </div>
                )}
            </div>

            {showClaim && <ViewAllSpecialtiesPopup onClose={handleClaimClose} />}
            {showSuggest && <SuggestPopup onClose={handleSuggestClose} />}
        </div>
    );
};

export default SpecialtyPage;
