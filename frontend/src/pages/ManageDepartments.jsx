import { Link } from "react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { BuildingIcon, PlusIcon, ArrowLeftIcon, UserIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import useAuthUser from "../hooks/useAuthUser";
import { getUserById, deleteDepartmentAccount } from "../lib/api";

const DepartmentCard = ({ deptId, onDelete }) => {
    const { data, isLoading } = useQuery({
        queryKey: ["user", deptId],
        queryFn: () => getUserById(deptId),
        enabled: !!deptId,
    });

    if (isLoading) {
        return (
            <div className="card bg-base-100 shadow-sm border p-5 animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="size-10 rounded-full bg-base-300 shrink-0" />
                    <div className="flex-1 space-y-2">
                        <div className="h-4 bg-base-300 rounded w-1/2" />
                        <div className="h-3 bg-base-300 rounded w-1/3" />
                        <div className="h-3 bg-base-300 rounded w-1/4" />
                    </div>
                </div>
            </div>
        );
    }

    // sendSuccess wraps data at response.data.data — getUserById returns response.data
    // so the user object is at data.data
    const user = data?.data || data;
    if (!user) return null;

    const name = user.technologistFirstName && user.technologistLastName
        ? `${user.technologistFirstName} ${user.technologistLastName}`
        : "Unnamed Technologist";

    // departmentType is populated: { _id, name }
    const deptTypeName = user.departmentType?.name || "Unknown Type";

    const status = user.status || "unknown";
    const statusBadge = {
        onBoarded: "badge-success",
        pending: "badge-warning",
        suspended: "badge-error",
        needsRenewal: "badge-warning",
        rejected: "badge-error",
    };
    const statusLabel = status === "onBoarded" ? "Active" : status;

    return (
        <div className="card bg-base-100 shadow-sm border p-5">
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                    {user.profilePic?.url ? (
                        <img
                            src={user.profilePic.url}
                            alt={name}
                            className="size-10 rounded-full object-cover shrink-0"
                        />
                    ) : (
                        <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <UserIcon className="size-5 text-primary" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <p className="font-semibold truncate">{name}</p>
                        <p className="text-sm opacity-70">{deptTypeName}</p>
                        <span className={`badge badge-sm mt-1 capitalize ${statusBadge[status] || "badge-ghost"}`}>
                            {statusLabel}
                        </span>
                    </div>
                </div>

                <div className="flex gap-2 shrink-0">
                    <Link to={`/profile/${deptId}`} className="btn btn-outline btn-sm">
                        View Profile
                    </Link>
                    <button
                        className="btn btn-error btn-sm btn-outline"
                        onClick={() => onDelete(deptId, name)}
                    >
                        <Trash2Icon className="size-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

const ManageDepartments = () => {
    const { authUser } = useAuthUser();
    const queryClient = useQueryClient();
    const deptAccounts = authUser?.departmentAccounts || [];
    const isClinic = authUser?.instituteType === "clinic";

    const [confirmTarget, setConfirmTarget] = useState(null); // { id, name }

    const { mutate: doDelete, isPending: isDeleting } = useMutation({
        mutationFn: (deptId) => deleteDepartmentAccount(deptId),
        onSuccess: () => {
            toast.success("Department account deleted.");
            queryClient.invalidateQueries({ queryKey: ["authUser"] });
            setConfirmTarget(null);
        },
        onError: (err) => {
            toast.error(err?.response?.data?.message || "Failed to delete department.");
            setConfirmTarget(null);
        },
    });

    return (
        <div className="p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <Link to="/" className="btn btn-ghost btn-sm btn-circle">
                        <ArrowLeftIcon className="size-4" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <BuildingIcon className="size-6 text-primary" />
                            Manage Departments
                        </h1>
                        <p className="text-sm opacity-70 mt-1">
                            {deptAccounts.length} department(s) set up
                            {isClinic && " · Clinics are limited to 1 department"}
                        </p>
                    </div>
                </div>

                {(!isClinic || deptAccounts.length === 0) && (
                    <Link to="/setup-departments" className="btn btn-primary btn-sm gap-2">
                        <PlusIcon className="size-4" />
                        Add Department
                    </Link>
                )}
            </div>

            {/* Department List */}
            {deptAccounts.length === 0 ? (
                <div className="card bg-base-200 p-10 text-center space-y-4">
                    <BuildingIcon className="size-12 text-base-content/30 mx-auto" />
                    <h2 className="text-lg font-semibold">No Departments Yet</h2>
                    <p className="text-sm opacity-70 max-w-md mx-auto">
                        Set up your first department sub-account so your facility can start accepting bookings.
                    </p>
                    <Link to="/setup-departments" className="btn btn-primary gap-2 mx-auto">
                        <PlusIcon className="size-4" />
                        Add Your First Department
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {deptAccounts.map((deptId) => (
                        <DepartmentCard
                            key={deptId?.toString()}
                            deptId={deptId?.toString()}
                            onDelete={(id, name) => setConfirmTarget({ id, name })}
                        />
                    ))}
                </div>
            )}

            {/* Delete Confirm Modal */}
            {confirmTarget && (
                <dialog className="modal modal-open">
                    <div className="modal-box">
                        <h3 className="font-bold text-lg text-error">Delete Department Account</h3>
                        <p className="py-4 text-sm">
                            Are you sure you want to delete{" "}
                            <span className="font-semibold">{confirmTarget.name}</span>?
                            This action cannot be undone. All associated files will be permanently removed.
                        </p>
                        <div className="modal-action">
                            <button
                                className="btn btn-ghost"
                                onClick={() => setConfirmTarget(null)}
                                disabled={isDeleting}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn btn-error"
                                onClick={() => doDelete(confirmTarget.id)}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <span className="loading loading-spinner loading-xs" /> : <Trash2Icon className="size-4" />}
                                {isDeleting ? "Deleting..." : "Delete"}
                            </button>
                        </div>
                    </div>
                    <form method="dialog" className="modal-backdrop">
                        <button onClick={() => setConfirmTarget(null)}>close</button>
                    </form>
                </dialog>
            )}
        </div>
    );
};

export default ManageDepartments;
