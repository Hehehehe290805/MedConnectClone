import { useEffect, useState, useCallback } from "react";
import { axiosInstance } from "../lib/axios.js";
import {
    rejectRole, approveRoleWithItems, editSuggestion, rejectSuggestion, rejectClaim,
    bulkApprove, bulkReject, getPendingRenewals, approveRenewal, rejectRenewal,
} from "../lib/api.js";
import ViewPendingUserPopup from "./ViewPendingUserPopup.jsx";
import ViewPendingClaimPopup from "./ViewPendingClaimPopup.jsx";
import ImagePreviewModal from "../components/ImagePreviewModal.jsx";
import { XIcon, CheckIcon, ClipboardListIcon, RefreshCwIcon } from "lucide-react";
import toast from "react-hot-toast";

// Generic confirm modal — replaces all window.confirm calls
const ConfirmModal = ({ message, onConfirm, onCancel, confirmLabel = "Confirm", danger = false }) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
            <p className="text-sm">{message}</p>
            <div className="flex gap-2 justify-end">
                <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
                <button className={`btn btn-sm ${danger ? "btn-error" : "btn-primary"}`} onClick={onConfirm}>{confirmLabel}</button>
            </div>
        </div>
    </div>
);

import { OUTCOME_LABELS, fmtDate } from "../lib/adminUtils.js";

// ── helpers ────────────────────────────────────────────────────────────────
const TYPE_LABELS = {
    specialty: "Specialty",
    subspecialty: "Subspecialty",
    service: "Service",
    departmenttype: "Dept. Type",
};

const RENEWAL_LABELS = {
    doctor_license: "Doctor License",
    pharmacist_license: "Pharmacist License",
    pharmacy_business_permit: "Pharmacy Business Permit",
    pharmacy_fda_license: "Pharmacy FDA License",
    technologist_license: "Technologist License",
    institute_business_permit: "Institute Business Permit",
    institute_construction_permit: "Institute Construction Permit",
};

// ── sub-components ─────────────────────────────────────────────────────────

const SectionEmpty = ({ label }) => (
    <p className="text-sm opacity-50 py-4 text-center">No {label}.</p>
);

const LoadingRows = () => (
    <div className="flex justify-center py-8">
        <span className="loading loading-spinner loading-md text-primary" />
    </div>
);

// Inline editable suggestion row
const SuggestionRow = ({ s, checked, onCheck, onApproveSingle, onRejectSingle }) => {
    const [editing, setEditing] = useState(false);
    const [name, setName] = useState(s.name);
    const [saving, setSaving] = useState(false);

    const saveName = async () => {
        if (!name.trim() || name.trim() === s.name) { setEditing(false); return; }
        setSaving(true);
        try {
            await editSuggestion({ id: s._id, name: name.trim() });
            s.name = name.trim(); // mutate local ref so parent list reflects it
        } catch { setName(s.name); }
        finally { setSaving(false); setEditing(false); }
    };

    return (
        <div className="flex items-center gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
            <input type="checkbox" className="checkbox checkbox-sm checkbox-primary" checked={checked} onChange={onCheck} />
            <div className="flex-1 min-w-0">
                {editing ? (
                    <input
                        className="input input-xs input-bordered w-full max-w-xs"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        onBlur={saveName}
                        onKeyDown={(e) => { if (e.key === "Enter") saveName(); if (e.key === "Escape") { setName(s.name); setEditing(false); } }}
                        autoFocus
                        disabled={saving}
                    />
                ) : (
                    <p
                        className="font-medium text-sm truncate cursor-pointer hover:text-primary"
                        title="Click to edit name"
                        onClick={() => setEditing(true)}
                    >
                        {name}
                    </p>
                )}
                <div className="flex gap-2 mt-0.5">
                    <span className="badge badge-sm badge-info rounded-md capitalize">{TYPE_LABELS[s.type] || s.type}</span>
                    {s.suggestedBy && (
                        <span className="text-xs opacity-50">
                            by {s.suggestedBy.firstName} {s.suggestedBy.lastName}
                        </span>
                    )}
                </div>
            </div>
            <div className="flex gap-1 shrink-0">
                <button className="btn btn-xs btn-success" onClick={() => onApproveSingle(s)}>✓</button>
                <button className="btn btn-xs btn-error btn-outline" onClick={() => onRejectSingle(s)}>✕</button>
            </div>
        </div>
    );
};

// Claim row (for All Requests tab)
const ClaimRow = ({ claim, onView }) => {
    const who = claim.doctorId
        ? `Dr. ${claim.doctorId.firstName} ${claim.doctorId.lastName}`
        : claim.instituteId?.instituteName || claim.instituteId?.facilityName || "Unknown";
    const what = claim.specialtyId?.name || claim.subspecialtyId?.name || claim.serviceId?.name || "—";
    return (
        <div className="flex items-center gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{what}</p>
                <p className="text-xs opacity-50">{claim.claimType} claim · {who}</p>
            </div>
            <button className="btn btn-xs btn-outline" onClick={() => onView(claim)}>Review</button>
        </div>
    );
};

// Renewal row
const RenewalRow = ({ r, onApprove, onReject, loading }) => {
    const userName =
        r.userId?.firstName
            ? `${r.userId.firstName} ${r.userId.lastName}`
            : r.userId?.instituteName || r.userId?.pharmacyName
                ? (r.userId.instituteName || r.userId.pharmacyName)
                : r.userId?.technologistFirstName
                    ? `${r.userId.technologistFirstName} ${r.userId.technologistLastName}`
                    : "Unknown";

    return (
        <div className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{RENEWAL_LABELS[r.type] || r.type}</p>
                <p className="text-xs opacity-60">{userName} · {r.userId?.email}</p>
                <p className="text-xs opacity-50">New expiry: {fmtDate(r.newExpiration)}</p>
                {r.newLicenseNumber && <p className="text-xs opacity-50">New #: {r.newLicenseNumber}</p>}
                {r.newImage?.key && (
                    <div className="mt-1">
                        <ImagePreviewModal s3Key={r.newImage.key} label="View Submitted Image" />
                    </div>
                )}
            </div>
            <div className="flex gap-1 shrink-0">
                <button className="btn btn-xs btn-success" disabled={loading} onClick={() => onApprove(r._id)}>✓</button>
                <button className="btn btn-xs btn-error btn-outline" disabled={loading} onClick={() => onReject(r._id)}>✕</button>
            </div>
        </div>
    );
};

// Complaint row for the Reports tab
const ComplaintRow = ({ c, onResolveClick }) => {
    const filerName = c.filedBy?.firstName
        ? `${c.filedBy.firstName} ${c.filedBy.lastName}`
        : c.filedBy?.email || "Unknown";
    const againstName = c.filedAgainst?.firstName
        ? `${c.filedAgainst.firstName} ${c.filedAgainst.lastName}`
        : c.filedAgainst?.email || "Unknown";
    return (
        <div className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
            <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{c.reason}</p>
                <p className="text-xs opacity-60">{filerName} filed against {againstName}</p>
                <div className="flex gap-2 mt-0.5 flex-wrap">
                    <span className={`badge badge-xs ${c.status === "resolved" ? "badge-success" : "badge-info"} capitalize`}>{c.status}</span>
                    {c.outcome && <span className="badge badge-xs badge-ghost">{OUTCOME_LABELS[c.outcome] || c.outcome}</span>}
                    <span className="text-xs opacity-40">{fmtDate(c.createdAt)}</span>
                </div>
                {c.adminNote && <p className="text-xs mt-1 opacity-60">Note: {c.adminNote}</p>}
            </div>
            {c.status === "pending" && (
                <button className="btn btn-xs btn-outline shrink-0" onClick={() => onResolveClick(c)}>Resolve</button>
            )}
        </div>
    );
};

// Inline resolve modal
const ResolveModal = ({ complaint, onClose, onResolved }) => {
    const [outcome, setOutcome] = useState("provider_right");
    const [adminNote, setAdminNote] = useState("");
    const [issueRefund, setIssueRefund] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        setLoading(true);
        try {
            await axiosInstance.patch("/admin/resolve", {
                complaintId: complaint._id,
                outcome,
                adminNote: adminNote.trim(),
                issueRefund: outcome === "patient_right" && issueRefund,
            });
            toast.success("Complaint resolved.");
            onResolved(complaint._id, outcome, adminNote.trim());
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to resolve.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <h2 className="text-lg font-bold">Resolve Complaint</h2>
                <p className="text-sm opacity-70 line-clamp-2">{complaint.reason}</p>
                <div>
                    <label className="label label-text text-xs">Outcome</label>
                    <select className="select select-bordered select-sm w-full" value={outcome} onChange={e => setOutcome(e.target.value)}>
                        {Object.entries(OUTCOME_LABELS).map(([k, v]) => (
                                <option key={k} value={k}>{v}</option>
                        ))}
                    </select>
                </div>
                <div>
                    <label className="label label-text text-xs">Admin Note (optional)</label>
                    <textarea
                        className="textarea textarea-bordered w-full text-sm"
                        rows={3}
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="Optional note visible to both parties"
                    />
                </div>
                {outcome === "patient_right" && (
                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                            type="checkbox"
                            className="checkbox checkbox-sm checkbox-primary"
                            checked={issueRefund}
                            onChange={e => setIssueRefund(e.target.checked)}
                        />
                        Issue full refund to patient
                    </label>
                )}
                <div className="flex gap-2 justify-end">
                    <button className="btn btn-ghost btn-sm" onClick={onClose} disabled={loading}>Cancel</button>
                    <button className="btn btn-primary btn-sm" onClick={handleSubmit} disabled={loading}>
                        {loading ? <span className="loading loading-spinner loading-xs" /> : "Confirm"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── main component ─────────────────────────────────────────────────────────
const HomePageAdmin = () => {
    // "all" | "accounts" | "specialties" | "subspecialties" | "claims" | "renewals" | "reports"
    const [activeTab, setActiveTab] = useState("all");
    const [viewMode, setViewMode] = useState("type"); // "type" | "account"

    // data
    const [pendingUsers, setPendingUsers] = useState([]);
    const [pendingSuggestions, setPendingSuggestions] = useState([]);
    const [pendingClaims, setPendingClaims] = useState([]);
    const [pendingRenewals, setPendingRenewals] = useState([]);
    const [complaints, setComplaints] = useState([]);

    const [loading, setLoading] = useState({ users: false, suggestions: false, claims: false, renewals: false, complaints: false });

    // resolve modal
    const [resolveTarget, setResolveTarget] = useState(null);

    // accounts tab selection
    const [selectedUserIds, setSelectedUserIds] = useState(new Set());

    // expanded user row (accordion)
    const [expandedUserId, setExpandedUserId] = useState(null);

    // suggestion selection (requests tab)
    const [selectedSuggestionIds, setSelectedSuggestionIds] = useState(new Set());

    // popups
    const [userPopup, setUserPopup] = useState(null); // user object
    const [claimPopup, setClaimPopup] = useState(null);

    const [bulkLoading, setBulkLoading] = useState(false);
    const [renewalLoading, setRenewalLoading] = useState(false);

    // Confirmation modal state
    const [confirm, setConfirm] = useState(null); // { message, onConfirm, danger, label }
    const openConfirm = (message, onConfirm, danger = true, label = "Confirm") =>
        setConfirm({ message, onConfirm, danger, label });
    const closeConfirm = () => setConfirm(null);

    // Suggestion reject with reason modal
    const [rejectSuggModal, setRejectSuggModal] = useState(null); // { items: [s], isBulk, reason }

    // ── fetch ────────────────────────────────────────────────────────────
    const fetchUsers = useCallback(async () => {
        setLoading((p) => ({ ...p, users: true }));
        try {
            const res = await axiosInstance.get("/admin/pending-users");
            setPendingUsers(res.data.data?.users || []);
        } catch { } finally { setLoading((p) => ({ ...p, users: false })); }
    }, []);

    const fetchSuggestions = useCallback(async () => {
        setLoading((p) => ({ ...p, suggestions: true }));
        try {
            const res = await axiosInstance.get("/admin/pending-suggestions");
            if (res.data.success) setPendingSuggestions(res.data.data?.pendingSuggestions || []);
        } catch { } finally { setLoading((p) => ({ ...p, suggestions: false })); }
    }, []);

    const fetchClaims = useCallback(async () => {
        setLoading((p) => ({ ...p, claims: true }));
        try {
            const res = await axiosInstance.get("/admin/pending-claims");
            const claims = res.data.data?.claims;
            if (res.data.success && claims) {
                const all = [
                    ...(claims.specialties || []),
                    ...(claims.subspecialties || []),
                    ...(claims.services || []),
                ];
                setPendingClaims(all);
            }
        } catch { } finally { setLoading((p) => ({ ...p, claims: false })); }
    }, []);

    const fetchRenewals = useCallback(async () => {
        setLoading((p) => ({ ...p, renewals: true }));
        try {
            const data = await getPendingRenewals();
            setPendingRenewals(data?.data?.renewals || []);
        } catch { } finally { setLoading((p) => ({ ...p, renewals: false })); }
    }, []);

    const fetchComplaints = useCallback(async () => {
        setLoading((p) => ({ ...p, complaints: true }));
        try {
            const res = await axiosInstance.get("/admin/complaints");
            if (res.data.success) setComplaints(res.data.data?.complaints || []);
        } catch { } finally { setLoading((p) => ({ ...p, complaints: false })); }
    }, []);

    useEffect(() => {
        fetchUsers();
        fetchSuggestions();
        fetchClaims();
        fetchRenewals();
        fetchComplaints();
    }, [fetchUsers, fetchSuggestions, fetchClaims, fetchRenewals, fetchComplaints]);

    // ── accounts tab helpers ──────────────────────────────────────────────
    const toggleUserCheck = (id) =>
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const allUsersChecked = pendingUsers.length > 0 && selectedUserIds.size === pendingUsers.length;

    const toggleAllUsers = () =>
        setSelectedUserIds(allUsersChecked ? new Set() : new Set(pendingUsers.map((u) => u._id)));

    const handleBulkApproveUsers = async () => {
        if (!selectedUserIds.size) return;
        setBulkLoading(true);
        try {
            await bulkApprove({ items: [...selectedUserIds].map((id) => ({ id, type: "user" })) });
            toast.success(`${selectedUserIds.size} account(s) approved.`);
            setPendingUsers((prev) => prev.filter((u) => !selectedUserIds.has(u._id)));
            setSelectedUserIds(new Set());
        } catch (err) {
            toast.error(err?.response?.data?.message || "Bulk approve failed.");
        } finally { setBulkLoading(false); }
    };

    const handleBulkRejectUsers = () => {
        if (!selectedUserIds.size) return;
        openConfirm(`Reject ${selectedUserIds.size} account(s)?`, async () => {
            closeConfirm();
            setBulkLoading(true);
            try {
                await bulkReject({ items: [...selectedUserIds].map((id) => ({ id, type: "user" })) });
                toast.success(`${selectedUserIds.size} account(s) rejected.`);
                setPendingUsers((prev) => prev.filter((u) => !selectedUserIds.has(u._id)));
                setSelectedUserIds(new Set());
            } catch (err) {
                toast.error(err?.response?.data?.message || "Bulk reject failed.");
            } finally { setBulkLoading(false); }
        });
    };

    const handleApproveAll = () => {
        if (!pendingUsers.length) return;
        openConfirm(`Approve all ${pendingUsers.length} pending accounts?`, async () => {
            closeConfirm();
            setBulkLoading(true);
            try {
                await bulkApprove({ items: pendingUsers.map((u) => ({ id: u._id, type: "user" })) });
                toast.success("All accounts approved.");
                setPendingUsers([]);
                setSelectedUserIds(new Set());
            } catch (err) {
                toast.error(err?.response?.data?.message || "Approve all failed.");
            } finally { setBulkLoading(false); }
        }, false, "Approve All");
    };

    // userSuggestionsFor returns pending suggestions that belong to a specific userId
    const userSuggestionsFor = (userId) =>
        pendingSuggestions.filter(
            (s) => (s.suggestedBy?._id || s.suggestedBy)?.toString() === userId?.toString()
        );

    // ── suggestions tab helpers ───────────────────────────────────────────
    const toggleSuggestionCheck = (id) =>
        setSelectedSuggestionIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });

    const allSuggestionsChecked =
        pendingSuggestions.length > 0 && selectedSuggestionIds.size === pendingSuggestions.length;

    const toggleAllSuggestions = () =>
        setSelectedSuggestionIds(allSuggestionsChecked ? new Set() : new Set(pendingSuggestions.map((s) => s._id)));

    const approveSingleSuggestion = async (s) => {
        try {
            await axiosInstance.patch("/admin/approve", { id: s._id });
            toast.success(`"${s.name}" approved.`);
            setPendingSuggestions((prev) => prev.filter((x) => x._id !== s._id));
            setSelectedSuggestionIds((prev) => { const n = new Set(prev); n.delete(s._id); return n; });
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
    };

    const rejectSingleSuggestion = (s) => {
        setRejectSuggModal({ items: [s], isBulk: false, reason: "" });
    };

    const bulkApproveSuggestions = async () => {
        if (!selectedSuggestionIds.size) return;
        setBulkLoading(true);
        try {
            await bulkApprove({ items: [...selectedSuggestionIds].map((id) => ({ id, type: "suggestion" })) });
            toast.success(`${selectedSuggestionIds.size} suggestion(s) approved.`);
            setPendingSuggestions((prev) => prev.filter((s) => !selectedSuggestionIds.has(s._id)));
            setSelectedSuggestionIds(new Set());
        } catch (err) { toast.error(err?.response?.data?.message || "Bulk approve failed."); }
        finally { setBulkLoading(false); }
    };

    const bulkRejectSuggestions = () => {
        if (!selectedSuggestionIds.size) return;
        const items = pendingSuggestions.filter(s => selectedSuggestionIds.has(s._id));
        setRejectSuggModal({ items, isBulk: true, reason: "" });
    };

    // ── renewals ──────────────────────────────────────────────────────────
    const handleApproveRenewal = async (renewalId) => {
        setRenewalLoading(true);
        try {
            await approveRenewal({ renewalId });
            toast.success("Renewal approved.");
            setPendingRenewals((prev) => prev.filter((r) => r._id !== renewalId));
        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
        finally { setRenewalLoading(false); }
    };

    const handleRejectRenewal = (renewalId) => {
        openConfirm("Reject this renewal?", async () => {
            closeConfirm();
            setRenewalLoading(true);
            try {
                await rejectRenewal({ renewalId });
                toast.success("Renewal rejected.");
                setPendingRenewals((prev) => prev.filter((r) => r._id !== renewalId));
            } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
            finally { setRenewalLoading(false); }
        });
    };

    // ── popup callbacks ───────────────────────────────────────────────────
    const onUserApproved = (userId) => {
        setPendingUsers((prev) => prev.filter((u) => u._id !== userId));
        setSelectedUserIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
        // suggestions tied to this user are now resolved
        fetchSuggestions();
    };

    const onUserRejected = (userId) => {
        setPendingUsers((prev) => prev.filter((u) => u._id !== userId));
        setSelectedUserIds((prev) => { const n = new Set(prev); n.delete(userId); return n; });
        fetchSuggestions();
    };

    const onClaimApproved = (claimId) => {
        setPendingClaims((prev) => prev.filter((c) => c._id !== claimId));
        setClaimPopup(null);
    };

    const onClaimRejected = (claimId) => {
        setPendingClaims((prev) => prev.filter((c) => c._id !== claimId));
        setClaimPopup(null);
    };

    const onComplaintResolved = (complaintId, outcome, adminNote) => {
        setComplaints((prev) => prev.map((c) =>
            c._id === complaintId ? { ...c, status: "resolved", outcome, adminNote } : c
        ));
        setResolveTarget(null);
    };

    // ── render ────────────────────────────────────────────────────────────
    const pendingComplaints = complaints.filter(c => c.status === "pending");
    const totalPending =
        pendingUsers.length + pendingSuggestions.length + pendingClaims.length + pendingRenewals.length + pendingComplaints.length;

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
            </div>

            <div
                className="card bg-primary/5 border border-primary/20 p-4 rounded-xl cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => setActiveTab("all")}
            >
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <ClipboardListIcon className="size-5 text-primary shrink-0" />
                        <div>
                            <p className="font-semibold">Check pending requests here</p>
                            <p className="text-sm opacity-60">
                                {totalPending > 0
                                    ? `${totalPending} item(s) awaiting review`
                                    : "No pending requests right now"}
                            </p>
                        </div>
                    </div>
                    <span className="text-primary text-sm font-medium shrink-0">Review →</span>
                </div>
            </div>

            {/* View mode toggle — above tabs */}
            <div className="flex items-center gap-2">
                <span className="text-xs opacity-50">View by:</span>
                {[["type", "Request Type"], ["account", "Account"]].map(([mode, label]) => (
                    <button
                        key={mode}
                        className={`btn btn-xs ${viewMode === mode ? "btn-primary" : "btn-ghost border border-base-300"}`}
                        onClick={() => setViewMode(mode)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* Tabs — left: Renewals | Reports | Claims | Subspecialties | Specialties | Pending Accounts | All Requests (default) */}
            <div className="flex flex-wrap gap-1">
                {[
                    { key: "renewals", label: "Renewals", count: pendingRenewals.length, cls: "badge-info", refresh: fetchRenewals },
                    { key: "reports", label: "Reports", count: pendingComplaints.length, cls: "badge-info", refresh: fetchComplaints },
                    { key: "claims", label: "Claims", count: pendingClaims.length, cls: "badge-info", refresh: fetchClaims },
                    { key: "subspecialties", label: "Subspecialties", count: pendingSuggestions.filter(s => s.type === "subspecialty").length, cls: "badge-info", refresh: fetchSuggestions },
                    { key: "specialties", label: "Specialties", count: pendingSuggestions.filter(s => s.type === "specialty").length, cls: "badge-info", refresh: fetchSuggestions },
                    { key: "accounts", label: "Pending Accounts", count: pendingUsers.length, cls: "badge-info", refresh: fetchUsers },
                    { key: "all", label: "All Requests", count: totalPending, cls: "badge-info", refresh: () => { fetchUsers(); fetchSuggestions(); fetchClaims(); fetchRenewals(); fetchComplaints(); } },
                ].map(({ key, label, count, cls, refresh }) => (
                    <div key={key} className="flex items-center gap-0.5">
                        <button
                            className={`btn btn-sm gap-1 ${activeTab === key ? "btn-primary" : "btn-ghost border border-base-300"}`}
                            onClick={() => setActiveTab(key)}
                        >
                            {label}
                            {count > 0 && <span className={`badge badge-xs ${activeTab === key ? "badge-primary-content" : cls}`}>{count}</span>}
                        </button>
                        {activeTab === key && (
                            <button
                                className="btn btn-ghost btn-xs btn-circle"
                                title="Refresh"
                                onClick={() => refresh?.()}
                            >
                                <RefreshCwIcon className="size-3" />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* ── ACCOUNTS TAB ────────────────────────────────────────── */}
            {activeTab === "accounts" && (
                <div className="space-y-3">
                    {/* bulk toolbar */}
                    {pendingUsers.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2">
                            <label className="flex items-center gap-2 cursor-pointer text-sm">
                                <input
                                    type="checkbox"
                                    className="checkbox checkbox-sm checkbox-primary"
                                    checked={allUsersChecked}
                                    onChange={toggleAllUsers}
                                />
                                Select all ({pendingUsers.length})
                            </label>
                            {selectedUserIds.size > 0 && (
                                <>
                                    <button
                                        className="btn btn-xs btn-success gap-1"
                                        disabled={bulkLoading}
                                        onClick={handleBulkApproveUsers}
                                    >
                                        <CheckIcon className="size-3" />Approve ({selectedUserIds.size})
                                    </button>
                                    <button
                                        className="btn btn-xs btn-error btn-outline gap-1"
                                        disabled={bulkLoading}
                                        onClick={handleBulkRejectUsers}
                                    >
                                        <XIcon className="size-3" />Reject ({selectedUserIds.size})
                                    </button>
                                </>
                            )}
                            <button
                                className="btn btn-xs btn-primary ml-auto"
                                disabled={bulkLoading || !pendingUsers.length}
                                onClick={handleApproveAll}
                            >
                                Approve All
                            </button>
                        </div>
                    )}

                    {loading.users ? (
                        <LoadingRows />
                    ) : pendingUsers.length === 0 ? (
                        <SectionEmpty label="pending accounts" />
                    ) : (
                        <div className="space-y-2">
                            {pendingUsers.map((user) => {
                                const suggestions = userSuggestionsFor(user._id);
                                const isExpanded = expandedUserId === user._id;
                                return (
                                    <div key={user._id} className="card bg-base-200 shadow-sm">
                                        <div className="card-body p-4">
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    className="checkbox checkbox-sm checkbox-primary shrink-0"
                                                    checked={selectedUserIds.has(user._id)}
                                                    onChange={() => toggleUserCheck(user._id)}
                                                />
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-sm">
                                                        {user.firstName && user.lastName
                                                            ? `${user.firstName} ${user.lastName}`
                                                            : user.instituteName || user.facilityName || user.pharmacyName || user.email}
                                                    </p>
                                                    <div className="flex gap-2 flex-wrap mt-0.5">
                                                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/15 text-primary capitalize">{user.role}</span>
                                                    </div>
                                                </div>
                                                <div className="flex gap-1 shrink-0">
                                                    <button
                                                        className="btn btn-xs btn-primary"
                                                        onClick={() => setUserPopup(user)}
                                                    >
                                                        Review
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* ── SPECIALTIES TAB ─────────────────────────────────────── */}
            {(activeTab === "specialties" || activeTab === "subspecialties") && (
                <div className="space-y-3">
                    {(() => {
                        const filtered = pendingSuggestions.filter(s =>
                            activeTab === "specialties" ? s.type === "specialty" : s.type === "subspecialty"
                        );
                        if (loading.suggestions) return <LoadingRows />;
                        if (filtered.length === 0) return <SectionEmpty label={`pending ${activeTab}`} />;
                        return (
                            <>
                                <div className="flex flex-wrap items-center gap-2">
                                    <label className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input type="checkbox" className="checkbox checkbox-sm checkbox-primary"
                                            checked={filtered.every(s => selectedSuggestionIds.has(s._id))}
                                            onChange={() => {
                                                const ids = filtered.map(s => s._id);
                                                const allChecked = ids.every(id => selectedSuggestionIds.has(id));
                                                setSelectedSuggestionIds(prev => {
                                                    const n = new Set(prev);
                                                    ids.forEach(id => allChecked ? n.delete(id) : n.add(id));
                                                    return n;
                                                });
                                            }}
                                        />
                                        Select all ({filtered.length})
                                    </label>
                                    {selectedSuggestionIds.size > 0 && (
                                        <>
                                            <button className="btn btn-xs btn-success gap-1" disabled={bulkLoading} onClick={bulkApproveSuggestions}>
                                                <CheckIcon className="size-3" />Approve ({selectedSuggestionIds.size})
                                            </button>
                                            <button className="btn btn-xs btn-error btn-outline gap-1" disabled={bulkLoading} onClick={bulkRejectSuggestions}>
                                                <XIcon className="size-3" />Reject ({selectedSuggestionIds.size})
                                            </button>
                                        </>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    {filtered.map(s => (
                                        <SuggestionRow key={s._id} s={s}
                                            checked={selectedSuggestionIds.has(s._id)}
                                            onCheck={() => toggleSuggestionCheck(s._id)}
                                            onApproveSingle={approveSingleSuggestion}
                                            onRejectSingle={rejectSingleSuggestion}
                                        />
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ── CLAIMS TAB ──────────────────────────────────────────── */}
            {activeTab === "claims" && (
                <div className="space-y-2">
                    {loading.claims ? <LoadingRows /> : pendingClaims.length === 0 ? <SectionEmpty label="pending claims" /> : (
                        pendingClaims.map(c => <ClaimRow key={c._id} claim={c} onView={setClaimPopup} />)
                    )}
                </div>
            )}

            {/* ── RENEWALS TAB ────────────────────────────────────────── */}
            {activeTab === "renewals" && (
                <div className="space-y-2">
                    {loading.renewals ? <LoadingRows /> : pendingRenewals.length === 0 ? <SectionEmpty label="pending renewals" /> : (
                        pendingRenewals.map(r => (
                            <RenewalRow key={r._id} r={r} loading={renewalLoading} onApprove={handleApproveRenewal} onReject={handleRejectRenewal} />
                        ))
                    )}
                </div>
            )}

            {/* ── REPORTS TAB ─────────────────────────────────────────── */}
            {activeTab === "reports" && (
                <div className="space-y-2">
                    {loading.complaints ? <LoadingRows /> : complaints.length === 0 ? <SectionEmpty label="complaints" /> : (
                        complaints.map(c => (
                            <ComplaintRow key={c._id} c={c} onResolveClick={setResolveTarget} />
                        ))
                    )}
                </div>
            )}

            {/* ── ALL REQUESTS (default) ──────────────────────────────── */}
            {activeTab === "all" && viewMode === "type" && (
                <div className="space-y-6">
                    {/* Pending Accounts */}
                    {pendingUsers.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Pending Accounts</p>
                            <div className="space-y-2">
                                {pendingUsers.map((user) => (
                                    <div key={user._id} className="flex items-center gap-3 p-3 bg-base-100 rounded-lg border border-base-300">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium text-sm">
                                                {user.firstName && user.lastName
                                                    ? `${user.firstName} ${user.lastName}`
                                                    : user.instituteName || user.facilityName || user.pharmacyName || user.email}
                                            </p>
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/15 text-primary capitalize">{user.role}</span>
                                        </div>
                                        <button className="btn btn-xs btn-outline shrink-0" onClick={() => { setActiveTab("accounts"); setUserPopup(user); }}>Review</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Specialties */}
                    {pendingSuggestions.filter(s => s.type === "specialty").length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Specialties</p>
                            <div className="space-y-2">
                                {pendingSuggestions.filter(s => s.type === "specialty").map(s => (
                                    <SuggestionRow key={s._id} s={s} checked={selectedSuggestionIds.has(s._id)}
                                        onCheck={() => toggleSuggestionCheck(s._id)}
                                        onApproveSingle={approveSingleSuggestion}
                                        onRejectSingle={rejectSingleSuggestion}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Subspecialties */}
                    {pendingSuggestions.filter(s => s.type === "subspecialty").length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Subspecialties</p>
                            <div className="space-y-2">
                                {pendingSuggestions.filter(s => s.type === "subspecialty").map(s => (
                                    <SuggestionRow key={s._id} s={s} checked={selectedSuggestionIds.has(s._id)}
                                        onCheck={() => toggleSuggestionCheck(s._id)}
                                        onApproveSingle={approveSingleSuggestion}
                                        onRejectSingle={rejectSingleSuggestion}
                                    />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Claims */}
                    {pendingClaims.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Claims</p>
                            <div className="space-y-2">
                                {pendingClaims.map(c => <ClaimRow key={c._id} claim={c} onView={setClaimPopup} />)}
                            </div>
                        </div>
                    )}
                    {/* Reports */}
                    {pendingComplaints.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Reports</p>
                            <div className="space-y-2">
                                {pendingComplaints.map(c => (
                                    <ComplaintRow key={c._id} c={c} onResolveClick={setResolveTarget} />
                                ))}
                            </div>
                        </div>
                    )}
                    {/* Renewals */}
                    {pendingRenewals.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Renewals</p>
                            <div className="space-y-2">
                                {pendingRenewals.map(r => (
                                    <RenewalRow key={r._id} r={r} loading={renewalLoading} onApprove={handleApproveRenewal} onReject={handleRejectRenewal} />
                                ))}
                            </div>
                        </div>
                    )}
                    {totalPending === 0 && (
                        <SectionEmpty label="pending requests" />
                    )}
                </div>
            )}

            {/* ── ALL REQUESTS — view by account ─────────────────────────── */}
            {activeTab === "all" && viewMode === "account" && (
                <div className="space-y-4">
                    {totalPending === 0 && <SectionEmpty label="pending requests" />}
                    {pendingUsers.map(user => {
                        const suggestions = userSuggestionsFor(user._id);
                        const claims = pendingClaims.filter(c =>
                            c.doctorId?._id?.toString() === user._id?.toString() ||
                            c.doctorId?.toString() === user._id?.toString() ||
                            c.instituteId?._id?.toString() === user._id?.toString() ||
                            c.instituteId?.toString() === user._id?.toString()
                        );
                        const displayName = user.firstName && user.lastName
                            ? `${user.firstName} ${user.lastName}`
                            : user.instituteName || user.facilityName || user.pharmacyName || user.email;
                        return (
                            <div key={user._id} className="card bg-base-100 border border-base-300 rounded-xl">
                                <div className="card-body p-4 space-y-3">
                                    {/* Account header */}
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-semibold text-sm">{displayName}</p>
                                            <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/15 text-primary capitalize">{user.role}</span>
                                            <span className="badge badge-xs badge-info">Pending approval</span>
                                        </div>
                                        <button className="btn btn-xs btn-primary shrink-0" onClick={() => setUserPopup(user)}>Review</button>
                                    </div>
                                    {/* Pending suggestions for this user */}
                                    {suggestions.length > 0 && (
                                        <div className="pl-3 border-l-2 border-info/30 space-y-1.5">
                                            <p className="text-xs opacity-50 font-semibold uppercase tracking-wide">New items ({suggestions.length})</p>
                                            {suggestions.map(s => (
                                                <SuggestionRow key={s._id} s={s}
                                                    checked={selectedSuggestionIds.has(s._id)}
                                                    onCheck={() => toggleSuggestionCheck(s._id)}
                                                    onApproveSingle={approveSingleSuggestion}
                                                    onRejectSingle={rejectSingleSuggestion}
                                                />
                                            ))}
                                        </div>
                                    )}
                                    {/* Pending claims for this user */}
                                    {claims.length > 0 && (
                                        <div className="pl-3 border-l-2 border-info/30 space-y-1.5">
                                            <p className="text-xs opacity-50 font-semibold uppercase tracking-wide">Claims ({claims.length})</p>
                                            {claims.map(c => <ClaimRow key={c._id} claim={c} onView={setClaimPopup} />)}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {/* Standalone renewals and reports (not tied to pending accounts) */}
                    {pendingRenewals.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Renewals</p>
                            <div className="space-y-2">
                                {pendingRenewals.map(r => (
                                    <RenewalRow key={r._id} r={r} loading={renewalLoading} onApprove={handleApproveRenewal} onReject={handleRejectRenewal} />
                                ))}
                            </div>
                        </div>
                    )}
                    {pendingComplaints.length > 0 && (
                        <div>
                            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Open Reports</p>
                            <div className="space-y-2">
                                {pendingComplaints.map(c => <ComplaintRow key={c._id} c={c} onResolveClick={setResolveTarget} />)}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ── POPUPS ──────────────────────────────────────────────── */}
            {userPopup && (
                <ViewPendingUserPopup
                    user={userPopup}
                    pendingSuggestions={pendingSuggestions}
                    pendingClaims={pendingClaims.filter(c =>
                        (c.doctorId?._id ?? c.doctorId)?.toString() === userPopup?._id?.toString()
                    )}
                    onClose={() => setUserPopup(null)}
                    onUserApproved={(id) => { onUserApproved(id); setUserPopup(null); }}
                    onUserRejected={(id) => { onUserRejected(id); setUserPopup(null); }}
                />
            )}

            {claimPopup && (
                <ViewPendingClaimPopup
                    claim={claimPopup}
                    otherPendingClaims={pendingClaims.filter(c =>
                        c._id !== claimPopup._id &&
                        (c.doctorId?._id ?? c.doctorId)?.toString() === (claimPopup.doctorId?._id ?? claimPopup.doctorId)?.toString()
                    )}
                    onClose={() => setClaimPopup(null)}
                    onClaimApproved={onClaimApproved}
                    onClaimRejected={onClaimRejected}
                />
            )}

            {resolveTarget && (
                <ResolveModal
                    complaint={resolveTarget}
                    onClose={() => setResolveTarget(null)}
                    onResolved={onComplaintResolved}
                />
            )}

            {confirm && (
                <ConfirmModal
                    message={confirm.message}
                    onConfirm={confirm.onConfirm}
                    onCancel={closeConfirm}
                    confirmLabel={confirm.label}
                    danger={confirm.danger}
                />
            )}

            {rejectSuggModal && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-xl">
                        <h3 className="font-bold text-base">
                            {rejectSuggModal.isBulk
                                ? `Reject ${rejectSuggModal.items.length} suggestion(s)?`
                                : `Reject "${rejectSuggModal.items[0]?.name}"?`}
                        </h3>
                        <div>
                            <label className="label label-text text-xs">Reason (optional — sent to the submitter)</label>
                            <textarea
                                className="textarea textarea-bordered w-full text-sm"
                                rows={2}
                                placeholder="e.g. Already exists under a different name"
                                value={rejectSuggModal.reason}
                                onChange={e => setRejectSuggModal(p => ({ ...p, reason: e.target.value }))}
                            />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <button className="btn btn-ghost btn-sm" onClick={() => setRejectSuggModal(null)}>Cancel</button>
                            <button
                                className="btn btn-error btn-sm"
                                onClick={async () => {
                                    const { items, isBulk, reason } = rejectSuggModal;
                                    setRejectSuggModal(null);
                                    if (isBulk) {
                                        setBulkLoading(true);
                                        try {
                                            for (const s of items) {
                                                await rejectSuggestion({ id: s._id, reason });
                                            }
                                            toast.success(`${items.length} suggestion(s) rejected.`);
                                            setPendingSuggestions(prev => prev.filter(s => !items.some(i => i._id === s._id)));
                                            setSelectedSuggestionIds(new Set());
                                        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
                                        finally { setBulkLoading(false); }
                                    } else {
                                        try {
                                            await rejectSuggestion({ id: items[0]._id, reason });
                                            toast.success(`"${items[0].name}" rejected.`);
                                            setPendingSuggestions(prev => prev.filter(x => x._id !== items[0]._id));
                                            setSelectedSuggestionIds(prev => { const n = new Set(prev); n.delete(items[0]._id); return n; });
                                        } catch (err) { toast.error(err?.response?.data?.message || "Failed."); }
                                    }
                                }}
                            >
                                Reject
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HomePageAdmin;
