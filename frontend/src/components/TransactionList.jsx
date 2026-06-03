import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { ReceiptIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const TYPE_LABEL = { deposit: "Deposit", balance: "Balance" };

const STATUS_COLORS = {
    pending_payment:  "badge-warning",
    deposit_paid:     "badge-info",
    accepted:         "badge-info",
    ongoing:          "badge-accent",
    completed:        "badge-success",
    awaiting_balance: "badge-warning",
    fully_paid:       "badge-success",
    cancelled:        "badge-error",
    rejected:         "badge-error",
    disputed:         "badge-warning",
    resolved:         "badge-ghost",
};

// departmentId: optional ObjectId string — only used by institute role to filter by dept
const TransactionList = ({ departmentId }) => {
    const { authUser } = useAuthUser();
    const role = authUser?.role;
    const isProvider = ["doctor", "institute", "department"].includes(role);

    const { data, isLoading } = useQuery({
        queryKey: ["transactions", departmentId ?? "all"],
        queryFn: () => {
            const params = departmentId ? `?departmentId=${departmentId}` : "";
            return axiosInstance.get(`/booking/transaction-history${params}`).then(r => r.data);
        },
    });

    const transactions = data?.data?.transactions ?? [];

    // For institute, all fetched transactions are their departments' — sum everything.
    // For others, filter by matching payee/payer.
    const totalReceived = role === "institute"
        ? transactions.reduce((sum, t) => sum + (t.netAmount ?? 0), 0)
        : transactions
            .filter(t => (t.payeeId?._id ?? t.payeeId)?.toString() === authUser?._id?.toString())
            .reduce((sum, t) => sum + (t.netAmount ?? 0), 0);

    const totalPaid = transactions
        .filter(t => (t.payerId?._id ?? t.payerId)?.toString() === authUser?._id?.toString())
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <span className="loading loading-spinner loading-lg text-primary" />
            </div>
        );
    }

    if (transactions.length === 0) {
        return (
            <div className="text-center py-12 opacity-40">
                <ReceiptIcon className="w-10 h-10 mx-auto mb-3" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm">Payment history will appear here.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {isProvider ? (
                    <div className="stat bg-base-200 rounded-xl">
                        <div className="stat-title">Total Received (net)</div>
                        <div className="stat-value text-success text-2xl">
                            ₱{totalReceived.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-desc">After platform fee</div>
                    </div>
                ) : (
                    <div className="stat bg-base-200 rounded-xl">
                        <div className="stat-title">Total Paid</div>
                        <div className="stat-value text-primary text-2xl">
                            ₱{totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-desc">{transactions.length} transaction(s)</div>
                    </div>
                )}
                <div className="stat bg-base-200 rounded-xl">
                    <div className="stat-title">Transactions</div>
                    <div className="stat-value text-2xl">{transactions.length}</div>
                    <div className="stat-desc">All time</div>
                </div>
            </div>

            {/* Table */}
            <div className="card bg-base-200 shadow overflow-x-auto">
                <table className="table table-zebra w-full">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Amount</th>
                            {isProvider ? <th>Net Received</th> : <th>Platform Fee</th>}
                            <th>Appointment</th>
                            <th>Status</th>
                            <th>Reference</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map((t) => {
                            const appt = t.appointmentId;
                            const providerName = appt?.doctorId
                                ? `Dr. ${appt.doctorId.firstName} ${appt.doctorId.lastName}`
                                : "Institute";
                            const patientName = appt?.patientId
                                ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
                                : "Patient";
                            const counterpart = isProvider ? patientName : providerName;

                            return (
                                <tr key={t._id}>
                                    <td className="text-xs whitespace-nowrap">
                                        {dayjs(t.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                        <br />
                                        <span className="opacity-50">{dayjs(t.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                    </td>
                                    <td>
                                        <span className={`badge badge-sm ${t.type === "deposit" ? "badge-info" : "badge-accent"}`}>
                                            {TYPE_LABEL[t.type] ?? t.type}
                                        </span>
                                    </td>
                                    <td className="font-semibold">
                                        ₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                    </td>
                                    {isProvider ? (
                                        <td className="text-success font-semibold">
                                            ₱{t.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                        </td>
                                    ) : (
                                        <td className="text-error text-sm">
                                            -₱{t.platformFee?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                        </td>
                                    )}
                                    <td className="text-xs">
                                        <p>{counterpart}</p>
                                        {appt?.start && (
                                            <p className="opacity-50">
                                                {dayjs(appt.start).tz(PH_TZ).format("MMM D [at] h:mm A")}
                                            </p>
                                        )}
                                    </td>
                                    <td>
                                        {appt?.status && (
                                            <span className={`badge badge-sm ${STATUS_COLORS[appt.status] || "badge-ghost"} capitalize`}>
                                                {appt.status.replace(/_/g, " ")}
                                            </span>
                                        )}
                                    </td>
                                    <td className="font-mono text-xs text-primary">{t.referenceNumber}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default TransactionList;
