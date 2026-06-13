import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import {
    BuildingIcon, ReceiptIcon, TrendingUpIcon, TrendingDownIcon,
    UsersIcon, ChevronRightIcon, ArrowLeftIcon, XIcon, AlertCircleIcon
} from "lucide-react";

dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const currency = (v) => `PHP ${(v ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const STATUS_STYLES = {
    pending_payment:  "bg-amber-100 text-amber-800 border-amber-200",
    deposit_paid:     "bg-blue-100 text-blue-800 border-blue-200",
    accepted:         "bg-blue-100 text-blue-800 border-blue-200",
    ongoing:          "bg-blue-100 text-blue-800 border-blue-200",
    completed:        "bg-emerald-100 text-emerald-800 border-emerald-200",
    awaiting_balance: "bg-amber-100 text-amber-800 border-amber-200",
    fully_paid:       "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled:        "bg-rose-100 text-rose-800 border-rose-200",
    rejected:         "bg-rose-100 text-rose-800 border-rose-200",
    disputed:         "bg-amber-100 text-amber-800 border-amber-200",
    resolved:         "bg-slate-100 text-slate-700 border-slate-200",
};

const TYPE_LABEL = {
    deposit:    "Deposit",
    balance:    "Balance",
    rebook_fee: "Rebook Fee",
    cashback:   "Cashback",
    refund:     "Refund",
};

const StatusPill = ({ status }) => (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
        {status?.replace(/_/g, " ")}
    </span>
);

// Transaction detail modal
const TransactionModal = ({ transaction, onClose }) => {
    if (!transaction) return null;
    const appt = transaction.appointmentId;
    const patientName = appt?.patientId
        ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
        : "Patient";
    const status = appt?.status ?? "—";

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide opacity-80">
                                {TYPE_LABEL[transaction.type] || "Transaction"}
                            </p>
                            <h2 className="font-mono text-lg font-bold break-all">{transaction.referenceNumber}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">
                        {dayjs(transaction.createdAt).tz(PH_TZ).format("MMM D, YYYY h:mm A")}
                    </p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Patient</p>
                            <p className="font-semibold">{patientName}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Status</p>
                            <div className="mt-1"><StatusPill status={status} /></div>
                        </div>
                        {appt?.start && (
                            <div className="rounded-lg border border-base-300 bg-base-100 p-2.5 col-span-2">
                                <p className="text-xs opacity-50">Appointment</p>
                                <p className="font-semibold">{dayjs(appt.start).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")}</p>
                            </div>
                        )}
                    </div>
                    <div className="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="opacity-60">{TYPE_LABEL[transaction.type] || "Amount"}</span>
                            <span className="font-semibold">{currency(transaction.amount)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="opacity-60">Platform Fee (10%)</span>
                            <span className="font-semibold text-error">-{currency(transaction.platformFee)}</span>
                        </div>
                        <div className="border-t border-base-300 pt-2 flex justify-between">
                            <span className="font-semibold">Net Received</span>
                            <span className="font-bold text-primary text-base">{currency(transaction.netAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

// Per-department transactions drawer
const DepartmentTransactionDrawer = ({ dept, onClose }) => {
    const [selectedTxn, setSelectedTxn] = useState(null);
    const txns = dept.transactions ?? [];

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-3">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1.5 text-primary font-semibold hover:underline text-sm"
                >
                    <ArrowLeftIcon className="size-4" /> Back to Departments
                </button>
            </div>

            {/* Department header */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 px-5 py-4">
                <div className="flex items-center gap-3">
                    {dept.profilePic ? (
                        <img src={dept.profilePic} alt={dept.name} className="w-11 h-11 rounded-full object-cover" />
                    ) : (
                        <div className="w-11 h-11 rounded-full bg-primary/20 flex items-center justify-center">
                            <BuildingIcon className="size-5 text-primary" />
                        </div>
                    )}
                    <div>
                        <h2 className="font-bold text-lg">{dept.name}</h2>
                        <p className="text-xs opacity-50 font-mono">{dept.departmentId}</p>
                    </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mt-4 text-center">
                    <div>
                        <p className="text-xs opacity-50">Gross Total</p>
                        <p className="font-bold text-sm text-primary">{currency(dept.grossTotal)}</p>
                    </div>
                    <div>
                        <p className="text-xs opacity-50">Platform Fees</p>
                        <p className="font-bold text-sm text-error">{currency(dept.platformFees)}</p>
                    </div>
                    <div>
                        <p className="text-xs opacity-50">Net Received</p>
                        <p className="font-bold text-sm text-emerald-600">{currency(dept.netTotal)}</p>
                    </div>
                </div>
            </div>

            {/* Transactions list */}
            {txns.length === 0 ? (
                <div className="text-center py-12 opacity-50">
                    <ReceiptIcon className="size-12 mx-auto mb-3" />
                    <p>No transactions yet</p>
                </div>
            ) : (
                <div className="card bg-base-100 border-2 border-base-300 shadow overflow-x-auto">
                    <table className="table table-zebra w-full">
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Type</th>
                                <th>Patient</th>
                                <th>Amount</th>
                                <th>Net Received</th>
                                <th>Status</th>
                                <th>Reference</th>
                            </tr>
                        </thead>
                        <tbody>
                            {txns.map(t => {
                                const appt = t.appointmentId;
                                const patientName = appt?.patientId
                                    ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
                                    : "—";
                                return (
                                    <tr
                                        key={t._id}
                                        className="cursor-pointer hover:bg-base-200/80"
                                        onClick={() => setSelectedTxn(t)}
                                    >
                                        <td className="text-xs whitespace-nowrap">
                                            {dayjs(t.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                            <br />
                                            <span className="opacity-50">{dayjs(t.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                        </td>
                                        <td className="text-xs">{TYPE_LABEL[t.type] || t.type}</td>
                                        <td className="text-xs">{patientName}</td>
                                        <td className="font-semibold text-sm">{currency(t.amount)}</td>
                                        <td className="font-semibold text-sm text-emerald-600">{currency(t.netAmount)}</td>
                                        <td>{appt?.status ? <StatusPill status={appt.status} /> : "—"}</td>
                                        <td className="font-mono text-xs text-primary">{t.referenceNumber}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedTxn && (
                <TransactionModal transaction={selectedTxn} onClose={() => setSelectedTxn(null)} />
            )}
        </div>
    );
};

// Main institute analytics tab
const InstituteAnalyticsTab = () => {
    const [selectedDept, setSelectedDept] = useState(null);

    const { data, isLoading, isError } = useQuery({
        queryKey: ["institute-analytics"],
        queryFn: () => axiosInstance.get("/booking/institute-analytics").then(r => r.data),
    });

    const analytics = data?.data;

    if (isLoading) {
        return (
            <div className="flex justify-center py-16">
                <span className="loading loading-spinner loading-lg text-primary" />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="flex flex-col items-center gap-3 py-16 opacity-60">
                <AlertCircleIcon className="size-12 text-error" />
                <p className="text-lg font-medium">Failed to load analytics</p>
                <p className="text-sm">Please try refreshing the page.</p>
            </div>
        );
    }

    if (selectedDept) {
        return (
            <DepartmentTransactionDrawer
                dept={selectedDept}
                onClose={() => setSelectedDept(null)}
            />
        );
    }

    const departments = analytics?.departments ?? [];

    return (
        <div className="space-y-6">
            {/* Summary stat cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow">
                    <div className="stat-figure text-primary">
                        <TrendingUpIcon className="size-8" />
                    </div>
                    <div className="stat-title text-xs">Grand Total (Gross)</div>
                    <div className="stat-value text-primary text-xl">{currency(analytics?.grandTotal)}</div>
                    <div className="stat-desc">All departments combined</div>
                </div>
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow">
                    <div className="stat-figure text-error">
                        <TrendingDownIcon className="size-8" />
                    </div>
                    <div className="stat-title text-xs">Total Platform Fees (10%)</div>
                    <div className="stat-value text-error text-xl">{currency(analytics?.grandPlatformFees)}</div>
                    <div className="stat-desc">Deducted by MedConnect</div>
                </div>
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow">
                    <div className="stat-figure text-emerald-600">
                        <ReceiptIcon className="size-8" />
                    </div>
                    <div className="stat-title text-xs">Net Received (After Fee)</div>
                    <div className="stat-value text-emerald-600 text-xl">{currency(analytics?.grandNetTotal)}</div>
                    <div className="stat-desc">Actual institute earnings</div>
                </div>
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow">
                    <div className="stat-figure opacity-50">
                        <UsersIcon className="size-8" />
                    </div>
                    <div className="stat-title text-xs">Total Transactions</div>
                    <div className="stat-value text-2xl">{analytics?.totalTransactions ?? 0}</div>
                    <div className="stat-desc">Across {departments.length} department(s)</div>
                </div>
            </div>

            {/* Department clickable cards */}
            <div>
                <h2 className="text-sm font-semibold uppercase tracking-wide opacity-50 mb-3">
                    Departments — click to view transactions
                </h2>
                {departments.length === 0 ? (
                    <div className="text-center py-16 opacity-50 space-y-2">
                        <BuildingIcon className="size-12 mx-auto" />
                        <p className="text-lg font-medium">No departments connected yet</p>
                        <p className="text-sm">Add department accounts from your settings.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {departments.map(dept => (
                            <button
                                key={dept._id}
                                onClick={() => setSelectedDept(dept)}
                                className="group text-left rounded-xl border-2 border-base-300 bg-base-100 p-5 shadow hover:border-primary/50 hover:shadow-[0_0_0_2px_rgba(47,112,186,0.15),0_8px_24px_rgba(15,23,42,0.18)] transition-all"
                            >
                                {/* Header */}
                                <div className="flex items-center justify-between gap-3 mb-4">
                                    <div className="flex items-center gap-3 min-w-0">
                                        {dept.profilePic ? (
                                            <img src={dept.profilePic} alt={dept.name} className="w-10 h-10 rounded-full object-cover shrink-0" />
                                        ) : (
                                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <BuildingIcon className="size-5 text-primary" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="font-bold truncate">{dept.name}</p>
                                            <p className="text-xs opacity-50 font-mono">{dept.departmentId}</p>
                                        </div>
                                    </div>
                                    <ChevronRightIcon className="size-5 opacity-30 group-hover:opacity-70 group-hover:translate-x-0.5 transition-all shrink-0" />
                                </div>

                                {/* Stats row */}
                                <div className="grid grid-cols-3 gap-2 text-center">
                                    <div className="rounded-lg bg-primary/5 border border-primary/10 p-2">
                                        <p className="text-[10px] uppercase tracking-wide opacity-50">Total Received</p>
                                        <p className="font-bold text-primary text-sm mt-0.5">{currency(dept.grossTotal)}</p>
                                    </div>
                                    <div className="rounded-lg bg-error/5 border border-error/10 p-2">
                                        <p className="text-[10px] uppercase tracking-wide opacity-50">Platform Fee</p>
                                        <p className="font-bold text-error text-sm mt-0.5">{currency(dept.platformFees)}</p>
                                    </div>
                                    <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-2">
                                        <p className="text-[10px] uppercase tracking-wide opacity-50">Net Received</p>
                                        <p className="font-bold text-emerald-600 text-sm mt-0.5">{currency(dept.netTotal)}</p>
                                    </div>
                                </div>

                                {/* Transaction count badge */}
                                <div className="mt-3 flex items-center gap-1.5">
                                    <ReceiptIcon className="size-3.5 opacity-40" />
                                    <span className="text-xs opacity-50">
                                        {dept.transactionCount} transaction{dept.transactionCount !== 1 ? "s" : ""}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default InstituteAnalyticsTab;
