import { useEffect, useState, useCallback } from "react";
import { axiosInstance } from "../lib/axios.js";
import toast from "react-hot-toast";
import { OUTCOME_LABELS, fmtDate } from "../lib/adminUtils.js";
import { XIcon } from "lucide-react";

const DISPUTE_STATUS_BADGE = {
    pending: "badge-info",
    resolved: "badge-success",
    cancelled: "badge-ghost",
};

const APP_STATUS_BADGE = {
    pending: "badge-warning",
    viewed: "badge-info",
    resolved: "badge-success",
};

const APP_CATEGORY_LABEL = {
    bug: "Bug",
    ux: "UX Issue",
    feature: "Feature Request",
    other: "Other",
};

// ── Dispute resolve modal ────────────────────────────────────────────────────

const ResolveDisputeModal = ({ complaint, onClose, onResolved }) => {
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
            toast.success("Dispute resolved.");
            onResolved(complaint._id, outcome, adminNote.trim());
        } catch (err) {
            toast.error(err?.response?.data?.message || "Failed to resolve.");
        } finally { setLoading(false); }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <h2 className="text-lg font-bold">Resolve Dispute</h2>
                <p className="text-sm opacity-70 line-clamp-2">{complaint.reason}</p>
                <div>
                    <label className="label label-text text-xs">Outcome</label>
                    <select className="select select-bordered select-sm w-full" value={outcome} onChange={e => setOutcome(e.target.value)}>
                        {Object.entries(OUTCOME_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                </div>
                <div>
                    <label className="label label-text text-xs">Admin Note (optional)</label>
                    <textarea
                        className="textarea textarea-bordered w-full text-sm"
                        rows={3}
                        value={adminNote}
                        onChange={e => setAdminNote(e.target.value)}
                        placeholder="Visible to both parties"
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

// ── main component ───────────────────────────────────────────────────────────

const AdminReportsPage = () => {
    // "disputes" | "app"
    const [mode, setMode] = useState("disputes");
    const [viewReport, setViewReport] = useState(null); // dispute or app report being viewed

    const [disputes, setDisputes] = useState([]);
    const [appReports, setAppReports] = useState([]);
    const [loadingDisputes, setLoadingDisputes] = useState(false);
    const [loadingApp, setLoadingApp] = useState(false);

    const [resolveTarget, setResolveTarget] = useState(null);

    const fetchDisputes = useCallback(async () => {
        setLoadingDisputes(true);
        try {
            const res = await axiosInstance.get("/admin/complaints");
            if (res.data.success) setDisputes(res.data.data?.complaints || []);
        } catch { toast.error("Failed to load disputes."); }
        finally { setLoadingDisputes(false); }
    }, []);

    const fetchAppReports = useCallback(async () => {
        setLoadingApp(true);
        try {
            const res = await axiosInstance.get("/app-reports");
            if (res.data.success) setAppReports(res.data.data?.reports || []);
        } catch { toast.error("Failed to load app reports."); }
        finally { setLoadingApp(false); }
    }, []);

    useEffect(() => {
        fetchDisputes();
        fetchAppReports();
    }, [fetchDisputes, fetchAppReports]);

    const onDisputeResolved = (id, outcome, adminNote) => {
        setDisputes(prev => prev.map(d =>
            d._id === id ? { ...d, status: "resolved", outcome, adminNote } : d
        ));
        setResolveTarget(null);
    };

    const updateAppReportStatus = async (reportId, status) => {
        try {
            await axiosInstance.patch(`/app-reports/${reportId}/status`, { status });
            setAppReports(prev => prev.map(r => r._id === reportId ? { ...r, status } : r));
            toast.success(`Marked as ${status}.`);
        } catch (err) {
            toast.error(err?.response?.data?.message || "Update failed.");
        }
    };

    // ── dispute list ─────────────────────────────────────────────────────────

    const pendingDisputes = disputes.filter(d => d.status === "pending");
    const resolvedDisputes = disputes.filter(d => d.status !== "pending");

    const DisputeCard = ({ d }) => {
        const filerName = d.filedBy?.firstName
            ? `${d.filedBy.firstName} ${d.filedBy.lastName}`
            : d.filedBy?.email || "Unknown";
        const againstName = d.filedAgainst?.firstName
            ? `${d.filedAgainst.firstName} ${d.filedAgainst.lastName}`
            : d.filedAgainst?.email || "Unknown";

        return (
            <div
                className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-300 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setViewReport({ type: "dispute", data: d })}
            >
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-2">{d.reason}</p>
                    <p className="text-xs opacity-60 mt-0.5">{filerName} vs. {againstName}</p>
                    <div className="flex gap-2 flex-wrap mt-1">
                        <span className={`badge badge-xs ${DISPUTE_STATUS_BADGE[d.status] || "badge-ghost"} capitalize`}>{d.status}</span>
                        {d.outcome && <span className="badge badge-xs badge-ghost">{OUTCOME_LABELS[d.outcome] || d.outcome}</span>}
                        <span className="text-xs opacity-40">{fmtDate(d.createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    };

    // ── app report list ───────────────────────────────────────────────────────

    const AppReportCard = ({ r }) => {
        const reporter = r.reporter?.firstName
            ? `${r.reporter.firstName} ${r.reporter.lastName}`
            : r.reporter?.email || "Unknown";

        return (
            <div
                className="flex items-start gap-3 p-3 bg-base-100 rounded-lg border border-base-300 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setViewReport({ type: "app", data: r })}
            >
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{r.subject}</p>
                    <p className="text-xs opacity-60 mt-0.5">{reporter} · {APP_CATEGORY_LABEL[r.category] || r.category}</p>
                    <p className="text-xs opacity-70 mt-1 line-clamp-1">{r.description}</p>
                    <div className="flex gap-2 flex-wrap mt-1">
                        <span className={`badge badge-xs ${APP_STATUS_BADGE[r.status] || "badge-ghost"} capitalize`}>{r.status}</span>
                        <span className="text-xs opacity-40">{fmtDate(r.createdAt)}</span>
                    </div>
                </div>
            </div>
        );
    };

    const pendingApp = appReports.filter(r => r.status === "pending").length;
    const pendingDisputeCount = pendingDisputes.length;

    return (
        <div className="p-4 sm:p-8 max-w-4xl mx-auto space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Reports</h1>
                <p className="text-sm opacity-50">Manage appointment disputes and user-submitted app reports.</p>
            </div>

            {/* Toggle */}
            <div className="flex gap-2">
                <button
                    className={`btn btn-sm gap-1 ${mode === "disputes" ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    onClick={() => setMode("disputes")}
                >
                    User vs. Provider
                    {pendingDisputeCount > 0 && <span className={`badge badge-xs ${mode === "disputes" ? "badge-primary-content" : "badge-info"}`}>{pendingDisputeCount}</span>}
                </button>
                <button
                    className={`btn btn-sm gap-1 ${mode === "app" ? "btn-primary" : "btn-ghost border border-base-300"}`}
                    onClick={() => setMode("app")}
                >
                    App Reports
                    {pendingApp > 0 && <span className={`badge badge-xs ${mode === "app" ? "badge-primary-content" : "badge-info"}`}>{pendingApp}</span>}
                </button>
            </div>

            {/* ── User vs Provider Disputes ── */}
            {mode === "disputes" && (
                <div className="space-y-6">
                    {loadingDisputes ? (
                        <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
                    ) : (
                        <>
                            {pendingDisputes.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Pending ({pendingDisputes.length})</p>
                                    <div className="space-y-2">
                                        {pendingDisputes.map(d => <DisputeCard key={d._id} d={d} />)}
                                    </div>
                                </div>
                            )}
                            {resolvedDisputes.length > 0 && (
                                <div>
                                    <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2">Resolved / Cancelled ({resolvedDisputes.length})</p>
                                    <div className="space-y-2">
                                        {resolvedDisputes.map(d => <DisputeCard key={d._id} d={d} />)}
                                    </div>
                                </div>
                            )}
                            {disputes.length === 0 && <p className="text-sm opacity-50 py-4 text-center">No disputes on record.</p>}
                        </>
                    )}
                </div>
            )}

            {/* ── App Reports ── */}
            {mode === "app" && (
                <div className="space-y-4">
                    {loadingApp ? (
                        <div className="flex justify-center py-8"><span className="loading loading-spinner loading-md text-primary" /></div>
                    ) : appReports.length === 0 ? (
                        <p className="text-sm opacity-50 py-4 text-center">No app reports submitted.</p>
                    ) : (
                        <>
                            {["pending", "viewed", "resolved"].map(status => {
                                const group = appReports.filter(r => r.status === status);
                                if (group.length === 0) return null;
                                return (
                                    <div key={status}>
                                        <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-2 capitalize">{status} ({group.length})</p>
                                        <div className="space-y-2">
                                            {group.map(r => <AppReportCard key={r._id} r={r} />)}
                                        </div>
                                    </div>
                                );
                            })}
                        </>
                    )}
                </div>
            )}

            {resolveTarget && (
                <ResolveDisputeModal
                    complaint={resolveTarget}
                    onClose={() => setResolveTarget(null)}
                    onResolved={onDisputeResolved}
                />
            )}

            {/* Full report detail popup */}
            {viewReport && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-base-100 rounded-xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto space-y-4 shadow-xl">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">
                                {viewReport.type === "dispute" ? "Dispute Details" : "App Report"}
                            </h2>
                            <button className="btn btn-ghost btn-sm btn-circle" onClick={() => setViewReport(null)}>
                                <XIcon className="size-4" />
                            </button>
                        </div>

                        {viewReport.type === "dispute" && (() => {
                            const d = viewReport.data;
                            const filerName = d.filedBy?.firstName ? `${d.filedBy.firstName} ${d.filedBy.lastName}` : d.filedBy?.email || "Unknown";
                            const againstName = d.filedAgainst?.firstName ? `${d.filedAgainst.firstName} ${d.filedAgainst.lastName}` : d.filedAgainst?.email || "Unknown";
                            return (
                                <div className="space-y-3 text-sm">
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`badge badge-sm ${DISPUTE_STATUS_BADGE[d.status] || "badge-ghost"} capitalize`}>{d.status}</span>
                                        {d.outcome && <span className="badge badge-sm badge-ghost">{OUTCOME_LABELS[d.outcome] || d.outcome}</span>}
                                    </div>
                                    <p><span className="opacity-50">Filed by:</span> {filerName}</p>
                                    <p><span className="opacity-50">Against:</span> {againstName}</p>
                                    <p><span className="opacity-50">Date:</span> {fmtDate(d.createdAt)}</p>
                                    <div>
                                        <p className="opacity-50 mb-1">Reason:</p>
                                        <p className="whitespace-pre-wrap">{d.reason}</p>
                                    </div>
                                    {d.adminNote && (
                                        <div>
                                            <p className="opacity-50 mb-1">Admin Note:</p>
                                            <p className="italic">{d.adminNote}</p>
                                        </div>
                                    )}
                                    {d.status === "pending" && (
                                        <button className="btn btn-primary btn-sm w-full mt-2" onClick={() => { setViewReport(null); setResolveTarget(d); }}>
                                            Resolve This Dispute
                                        </button>
                                    )}
                                </div>
                            );
                        })()}

                        {viewReport.type === "app" && (() => {
                            const r = viewReport.data;
                            const reporter = r.reporter?.firstName ? `${r.reporter.firstName} ${r.reporter.lastName}` : r.reporter?.email || "Unknown";
                            return (
                                <div className="space-y-3 text-sm">
                                    <div className="flex gap-2 flex-wrap">
                                        <span className={`badge badge-sm ${APP_STATUS_BADGE[r.status] || "badge-ghost"} capitalize`}>{r.status}</span>
                                        <span className="badge badge-sm badge-ghost">{APP_CATEGORY_LABEL[r.category] || r.category}</span>
                                    </div>
                                    <p><span className="opacity-50">Reporter:</span> {reporter}</p>
                                    <p><span className="opacity-50">Date:</span> {fmtDate(r.createdAt)}</p>
                                    <p><span className="opacity-50">Subject:</span> <strong>{r.subject}</strong></p>
                                    <div>
                                        <p className="opacity-50 mb-1">Description:</p>
                                        <p className="whitespace-pre-wrap">{r.description}</p>
                                    </div>
                                    <div className="flex gap-2 mt-2">
                                        {r.status === "pending" && (
                                            <button className="btn btn-outline btn-sm flex-1" onClick={() => { updateAppReportStatus(r._id, "viewed"); setViewReport(null); }}>
                                                Mark Viewed
                                            </button>
                                        )}
                                        {(r.status === "viewed" || r.status === "pending") && (
                                            <button className="btn btn-success btn-sm flex-1" onClick={() => { updateAppReportStatus(r._id, "resolved"); setViewReport(null); }}>
                                                Resolve
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminReportsPage;
