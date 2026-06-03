import { useState } from "react";
import { Link } from "react-router";
import { BuildingIcon, UsersIcon, ClockIcon, ArrowRightIcon, ReceiptIcon, HomeIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import TransactionList from "../components/TransactionList";

const HomePageInstitute = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";
    const deptIds = authUser?.departmentAccounts || [];
    const deptCount = deptIds.length;
    const hasDepartments = deptCount > 0;

    const [tab, setTab] = useState("overview");
    const [selectedDeptId, setSelectedDeptId] = useState("");

    return (
        <div className="p-8 space-y-6">
            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30 text-warning-content">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your account is pending approval</p>
                        <p className="text-sm opacity-70">
                            Our team is reviewing your information. While you wait, you can set up your department sub-accounts.{" "}
                            <Link to="/setup-departments" className="underline font-medium">
                                Set up Department Sub-Accounts →
                            </Link>
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold">Welcome, {authUser?.instituteName || "Institute"}</h1>
            </div>

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-bordered">
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "overview" ? "tab-active" : ""}`}
                    onClick={() => setTab("overview")}
                >
                    <HomeIcon className="size-4" /> Overview
                </button>
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "transactions" ? "tab-active" : ""}`}
                    onClick={() => setTab("transactions")}
                >
                    <ReceiptIcon className="size-4" /> Transactions
                </button>
            </div>

            {tab === "overview" && (
                <div className="space-y-6">
                    {!hasDepartments ? (
                        <div className="card bg-primary/5 border border-primary/20 p-6 rounded-xl">
                            <div className="flex items-start justify-between gap-4 flex-wrap">
                                <div className="flex items-start gap-3">
                                    <UsersIcon className="size-5 text-primary mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-semibold">Set up sub-accounts now</p>
                                        <p className="text-sm opacity-70">
                                            Configure your department sub-accounts so your facility can start accepting bookings.
                                        </p>
                                    </div>
                                </div>
                                <Link to="/setup-departments" className="btn btn-primary btn-sm gap-1 shrink-0">
                                    Set Up Now <ArrowRightIcon className="size-3" />
                                </Link>
                            </div>
                        </div>
                    ) : (
                        <div className="card bg-base-100 shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <UsersIcon className="size-5 text-primary" />
                                <h3 className="font-bold text-lg">Department Sub-Accounts</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">{deptCount} department(s) active</p>
                            <Link to="/setup-departments" className="btn btn-primary btn-sm">Manage Departments</Link>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card bg-base-100 shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <BuildingIcon className="size-5 text-primary" />
                                <h3 className="font-bold text-lg">Institute Info</h3>
                            </div>
                            <p className="text-sm opacity-70">Type: <span className="capitalize font-medium">{authUser?.instituteType}</span></p>
                            <p className="text-sm opacity-70">Contact: {authUser?.contactFirstName} {authUser?.contactLastName}</p>
                            <p className="text-sm opacity-70">Agency: {authUser?.licensingAgency}</p>
                        </div>

                        <div className="card bg-base-100 shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <UsersIcon className="size-5 text-primary" />
                                <h3 className="font-bold text-lg">Department Sub-Accounts</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">{deptCount} department(s) set up</p>
                            <Link to="/setup-departments" className="btn btn-primary btn-sm">Manage Departments</Link>
                        </div>
                    </div>
                </div>
            )}

            {tab === "transactions" && (
                <div className="space-y-4">
                    {hasDepartments && (
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium opacity-70">Filter by Department:</label>
                            <select
                                className="select select-bordered select-sm"
                                value={selectedDeptId}
                                onChange={e => setSelectedDeptId(e.target.value)}
                            >
                                <option value="">All Departments</option>
                                {deptIds.map((id, i) => (
                                    <option key={id?.toString() ?? i} value={id?.toString() ?? ""}>
                                        Department {i + 1}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                    <TransactionList departmentId={selectedDeptId || undefined} />
                </div>
            )}
        </div>
    );
};

export default HomePageInstitute;
