import { useState, useCallback, useEffect } from "react";
import { axiosInstance } from "../lib/axios.js";
import ViewPendingClaimPopup from "./ViewPendingClaimPopup.jsx";
import { ClockIcon, UsersIcon, RefreshCwIcon } from "lucide-react";
import toast from "react-hot-toast";

const STATUS_STYLES = {
    pending: "border-amber-200 bg-white text-amber-700",
    verified: "border-emerald-200 bg-white text-emerald-700",
    rejected: "border-rose-200 bg-white text-rose-700",
};

const ClaimCard = ({ claim, onView }) => {
    const dept = claim.departmentId;
    const deptName = dept?.technologistFirstName
        ? `${dept.technologistFirstName} ${dept.technologistLastName || ""}`.trim()
        : dept?.email || "Department";
    const instituteName = dept?.rootInstitute?.instituteName || "";
    const serviceName = claim.serviceId?.name || "—";

    return (
        <div className="bg-base-100 rounded-xl border-2 border-base-300 p-4 flex items-start justify-between gap-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)] hover:border-primary/30 hover:shadow-[0_0_0_2px_rgba(47,112,186,0.14),0_12px_30px_rgba(15,23,42,0.22)] transition-all">
            <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{serviceName}</p>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_3px_10px_rgba(15,23,42,0.12)] ${STATUS_STYLES[claim.status] || "border-base-300 bg-white text-slate-700"}`}>
                        {claim.status}
                    </span>
                </div>
                <p className="text-xs opacity-60 truncate">{deptName}{instituteName && ` · ${instituteName}`}</p>
                <div className="flex flex-wrap gap-3 text-xs opacity-50 mt-1">
                    {claim.durationMinutes && (
                        <span className="flex items-center gap-1">
                            <ClockIcon className="size-3" /> {claim.durationMinutes} min
                        </span>
                    )}
                    {claim.maxPatientsPerDay && (
                        <span className="flex items-center gap-1">
                            <UsersIcon className="size-3" /> Max {claim.maxPatientsPerDay}/day
                        </span>
                    )}
                    {claim.price != null && (
                        <span className="text-primary font-medium">₱{Number(claim.price).toLocaleString("en-PH")}</span>
                    )}
                </div>
                <p className="text-xs opacity-30">
                    {new Date(claim.createdAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                </p>
            </div>
            {claim.status === "pending" && (
                <button className="btn btn-xs btn-outline shrink-0" onClick={() => onView(claim)}>
                    Review
                </button>
            )}
        </div>
    );
};

const AdminServiceClaimsPage = () => {
    const [claims, setClaims] = useState([]);
    const [loading, setLoading] = useState(true);
    const [claimPopup, setClaimPopup] = useState(null);
    const [filter, setFilter] = useState("pending");

    const fetchClaims = useCallback(async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get("/admin/service-claims");
            setClaims(res.data.data?.claims?.services || []);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to load service claims.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchClaims(); }, [fetchClaims]);

    const onClaimApproved = (claimId) => {
        setClaims(prev => prev.map(c => c._id === claimId ? { ...c, status: "verified" } : c));
        setClaimPopup(null);
    };

    const onClaimRejected = (claimId) => {
        setClaims(prev => prev.map(c => c._id === claimId ? { ...c, status: "rejected" } : c));
        setClaimPopup(null);
    };

    const filtered = claims.filter(c => filter === "all" || c.status === filter);
    const counts = {
        pending: claims.filter(c => c.status === "pending").length,
        verified: claims.filter(c => c.status === "verified").length,
        rejected: claims.filter(c => c.status === "rejected").length,
    };

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h1 className="text-3xl font-bold">Service Claims</h1>
                    <p className="text-sm opacity-60 mt-0.5">Review service claims submitted by department accounts.</p>
                </div>
                <button
                    className="btn btn-ghost btn-sm gap-1"
                    onClick={fetchClaims}
                    disabled={loading}
                >
                    <RefreshCwIcon className="size-4" /> Refresh
                </button>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
                {[
                    { label: "Pending", key: "pending", cls: "text-warning" },
                    { label: "Approved", key: "verified", cls: "text-success" },
                    { label: "Rejected", key: "rejected", cls: "text-error" },
                ].map(({ label, key, cls }) => (
                    <div key={key} className="bg-base-200 border-2 border-base-300 rounded-xl p-4 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_6px_18px_rgba(15,23,42,0.16)]">
                        <p className={`text-2xl font-bold ${cls}`}>{counts[key]}</p>
                        <p className="text-xs opacity-50 mt-0.5">{label}</p>
                    </div>
                ))}
            </div>

            {/* Filter tabs */}
            <div className="flex gap-1 flex-wrap">
                {[
                    { key: "pending", label: "Pending" },
                    { key: "verified", label: "Approved" },
                    { key: "rejected", label: "Rejected" },
                    { key: "all", label: "All" },
                ].map(({ key, label }) => (
                    <button
                        key={key}
                        className={`btn btn-sm ${filter === key ? "btn-primary" : "btn-ghost border border-base-300"}`}
                        onClick={() => setFilter(key)}
                    >
                        {label}
                        {key !== "all" && counts[key] > 0 && (
                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${filter === key ? "border-white/70 bg-white text-primary" : "border-primary/30 bg-white text-primary"}`}>
                                {counts[key]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* Claims list */}
            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-12 opacity-40">
                    <p className="text-sm">No {filter === "all" ? "" : filter} service claims.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(claim => (
                        <ClaimCard key={claim._id} claim={claim} onView={setClaimPopup} />
                    ))}
                </div>
            )}

            {claimPopup && (
                <ViewPendingClaimPopup
                    claim={claimPopup}
                    onClose={() => setClaimPopup(null)}
                    onClaimApproved={onClaimApproved}
                    onClaimRejected={onClaimRejected}
                />
            )}
        </div>
    );
};

export default AdminServiceClaimsPage;
