import { useEffect, useState } from "react";
import { getAllUsers, adminDeleteUser } from "../lib/api.js";
import useAuthUser from "../hooks/useAuthUser";
import { fmtDate } from "../lib/adminUtils.js";
import toast from "react-hot-toast";
import { XIcon, AlertTriangleIcon } from "lucide-react";

const ROLES = ["all", "patient", "doctor", "pharmacy", "institute", "department", "admin"];

const STATUSES = [
    "all", "onBoarded", "pending", "notOnBoarded",
    "needsRenewal", "pendingRenewal", "pendingRenewalExpired", "suspended", "rejected",
];

const STATUS_LABEL = {
    all: "All", onBoarded: "Active", pending: "Pending", notOnBoarded: "Not Onboarded",
    needsRenewal: "Needs Renewal", pendingRenewal: "Renewal Pending",
    pendingRenewalExpired: "Renewal Expired", suspended: "Suspended", rejected: "Rejected",
};

const STATUS_BADGE = {
    notOnBoarded: "badge-ghost", pending: "badge-warning", onBoarded: "badge-success",
    needsRenewal: "badge-warning", pendingRenewal: "badge-info",
    pendingRenewalExpired: "badge-error", suspended: "badge-error", rejected: "badge-error",
};

// View + delete popup for a single account
const AccountDetailsPopup = ({ user, onClose, onDeleted, isSelf }) => {
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const hasHistory = user.status !== "notOnBoarded";

    const handleDelete = async () => {
        setDeleting(true);
        try {
            await adminDeleteUser(user._id);
            toast.success(`"${user.displayName}" deleted.`);
            onDeleted(user._id);
            onClose();
        } catch (err) {
            toast.error(err?.response?.data?.message || "Deletion failed.");
        } finally {
            setDeleting(false);
            setShowDeleteConfirm(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-base-100 rounded-xl p-6 w-full max-w-md space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold">Account Details</h2>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <div className="space-y-2 text-sm">
                    <p><span className="opacity-50">Name:</span> <span className="font-medium">{user.displayName}</span></p>
                    <p><span className="opacity-50">Email:</span> {user.email}</p>
                    <p><span className="opacity-50">Role:</span> <span className="capitalize">{user.role}</span></p>
                    <p>
                        <span className="opacity-50">Status:</span>{" "}
                        <span className={`badge badge-xs ${STATUS_BADGE[user.status] || "badge-ghost"}`}>
                            {STATUS_LABEL[user.status] || user.status}
                        </span>
                    </p>
                    <p><span className="opacity-50">Joined:</span> {fmtDate(user.createdAt)}</p>
                    {user.pendingDeletion && (
                        <p className="text-error"><span className="opacity-70">Deletion requested:</span> {fmtDate(user.deletionRequestedAt)}</p>
                    )}
                </div>

                {!isSelf && hasHistory && (
                    <div className="pt-2 border-t border-base-300">
                        {!showDeleteConfirm ? (
                            <button
                                className="btn btn-error btn-outline btn-sm w-full"
                                onClick={() => setShowDeleteConfirm(true)}
                            >
                                Force Delete Account
                            </button>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-center gap-2 text-error text-sm">
                                    <AlertTriangleIcon className="size-4 shrink-0" />
                                    <p>Permanently delete "{user.displayName}"? This cannot be undone.</p>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn btn-ghost btn-sm flex-1" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
                                    <button className="btn btn-error btn-sm flex-1" onClick={handleDelete} disabled={deleting}>
                                        {deleting ? <span className="loading loading-spinner loading-xs" /> : "Delete"}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const UserManagementPage = () => {
    const { authUser } = useAuthUser();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeRole, setActiveRole] = useState("all");
    const [activeStatus, setActiveStatus] = useState("all");
    const [search, setSearch] = useState("");
    const [detailUser, setDetailUser] = useState(null);

    useEffect(() => {
        const fetch = async () => {
            try {
                const data = await getAllUsers();
                setUsers(data.data?.users || []);
            } catch {
                toast.error("Failed to load users.");
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const baseFiltered = users
        .filter(u => activeRole === "all" || u.role === activeRole)
        .filter(u => activeStatus === "all" || u.status === activeStatus)
        .filter(u => {
            if (!search.trim()) return true;
            const q = search.toLowerCase();
            return (
                u.displayName?.toLowerCase().includes(q) ||
                u.email?.toLowerCase().includes(q)
            );
        });

    // Pending-deletion accounts always pinned to top with red text
    const filtered = [
        ...baseFiltered.filter(u => u.pendingDeletion),
        ...baseFiltered.filter(u => !u.pendingDeletion),
    ];

    const roleFiltered = users.filter(u => activeRole === "all" || u.role === activeRole);
    const statusCounts = STATUSES.reduce((acc, s) => {
        acc[s] = s === "all" ? roleFiltered.length : roleFiltered.filter(u => u.status === s).length;
        return acc;
    }, {});

    const handleDeleted = (userId) => setUsers(prev => prev.filter(u => u._id !== userId));

    return (
        <div className="p-4 sm:p-8 max-w-6xl mx-auto space-y-6">
            <div>
                <h1 className="text-2xl font-bold">User Management</h1>
                <p className="text-sm opacity-50">{users.length} total accounts</p>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
                <select
                    className="select select-bordered select-sm"
                    value={activeRole}
                    onChange={e => { setActiveRole(e.target.value); setActiveStatus("all"); }}
                >
                    {ROLES.map(r => (
                        <option key={r} value={r}>
                            {r === "all" ? `All Roles (${users.length})` : `${r.charAt(0).toUpperCase() + r.slice(1)} (${users.filter(u => u.role === r).length})`}
                        </option>
                    ))}
                </select>
                <input
                    type="text"
                    className="input input-bordered input-sm flex-1 min-w-[180px] max-w-sm"
                    placeholder="Search by name or email..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            <div className="flex flex-wrap gap-1 border-b border-base-300 pb-1">
                {STATUSES.filter(s => s === "all" || statusCounts[s] > 0).map(s => (
                    <button
                        key={s}
                        className={`btn btn-sm gap-1 ${activeStatus === s ? "btn-primary" : "btn-ghost"}`}
                        onClick={() => setActiveStatus(s)}
                    >
                        {STATUS_LABEL[s]}
                        {statusCounts[s] > 0 && (
                            <span className={`badge badge-xs ${activeStatus === s ? "badge-primary-content" : "badge-ghost"}`}>
                                {statusCounts[s]}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-md text-primary" />
                </div>
            ) : filtered.length === 0 ? (
                <p className="text-sm opacity-50 py-4 text-center">No users found.</p>
            ) : (
                <div className="overflow-x-auto rounded-xl border border-base-300 max-h-[60vh] overflow-y-auto">
                    <table className="table table-sm">
                        <thead className="sticky top-0 bg-base-200 z-10">
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                <th>Role</th>
                                <th>Status</th>
                                <th>Joined</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(u => (
                                <tr key={u._id} className={u.pendingDeletion ? "text-error/70" : ""}>
                                    <td className="font-medium whitespace-nowrap">
                                        {u.displayName}
                                        {u.pendingDeletion && (
                                            <span className="badge badge-xs badge-error ml-1">Deletion Pending</span>
                                        )}
                                    </td>
                                    <td className="text-xs opacity-70">{u.email}</td>
                                    <td>
                                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-primary/10 text-primary capitalize">{u.role}</span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-xs ${STATUS_BADGE[u.status] || "badge-ghost"}`}>
                                            {STATUS_LABEL[u.status] || u.status}
                                        </span>
                                    </td>
                                    <td className="text-xs whitespace-nowrap">{fmtDate(u.createdAt)}</td>
                                    <td>
                                        {String(u._id) === String(authUser?._id) ? (
                                            <span className="text-xs opacity-40 italic">You</span>
                                        ) : (
                                            <button
                                                className="btn btn-xs btn-outline"
                                                onClick={() => setDetailUser(u)}
                                            >
                                                View Details
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {detailUser && (
                <AccountDetailsPopup
                    user={detailUser}
                    onClose={() => setDetailUser(null)}
                    onDeleted={handleDeleted}
                    isSelf={String(detailUser._id) === String(authUser?._id)}
                />
            )}
        </div>
    );
};

export default UserManagementPage;
