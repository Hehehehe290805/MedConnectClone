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

const TYPE_LABEL = { deposit: "Deposit", balance: "Balance", rebook_fee: "Rebook Fee", cashback: "Cashback", refund: "Refund" };

const STATUS_STYLES = {
    pending_payment: "border-amber-200 bg-white text-amber-700",
    deposit_paid: "border-primary/30 bg-white text-primary",
    accepted: "border-primary/30 bg-white text-primary",
    ongoing: "border-primary/30 bg-white text-primary",
    completed: "border-emerald-200 bg-white text-emerald-700",
    awaiting_balance: "border-amber-200 bg-white text-amber-700",
    fully_paid: "border-emerald-200 bg-white text-emerald-700",
    cancelled: "border-rose-200 bg-white text-rose-700",
    rejected: "border-rose-200 bg-white text-rose-700",
    disputed: "border-amber-200 bg-white text-amber-700",
    resolved: "border-base-300 bg-white text-slate-700",
    missed_by_patient: "border-amber-200 bg-white text-amber-700",
    missed_by_provider: "border-primary/30 bg-white text-primary",
    missed_by_both: "border-primary/30 bg-white text-primary",
    refunded: "border-emerald-200 bg-white text-emerald-700",
};

const StatusPill = ({ status }) => (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_3px_10px_rgba(15,23,42,0.12)] ${STATUS_STYLES[status] || "border-base-300 bg-white text-slate-700"}`}>
        {status.replace(/_/g, " ")}
    </span>
);

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

    const transactions = [...(data?.data?.transactions ?? [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const currentUserId = authUser?._id?.toString();
    const isCashOut = (t) => ["cashback", "refund"].includes(t.type) && (t.payerId?._id ?? t.payerId)?.toString() === currentUserId;
    const providerNet = (t) => isCashOut(t) ? -(t.amount ?? 0) : (t.netAmount ?? 0);

    // For institute, all fetched transactions are their departments' — sum everything.
    // For others, filter by matching payee/payer.
    const totalReceived = role === "institute"
        ? transactions.reduce((sum, t) => sum + (isCashOut(t) ? -(t.amount ?? 0) : (t.netAmount ?? 0)), 0)
        : transactions
            .reduce((sum, t) => {
                const payeeId = (t.payeeId?._id ?? t.payeeId)?.toString();
                if (payeeId === authUser?._id?.toString()) return sum + (t.netAmount ?? 0);
                if (isCashOut(t)) return sum - (t.amount ?? 0);
                return sum;
            }, 0);

    const totalPaid = transactions
        .filter(t => (t.payerId?._id ?? t.payerId)?.toString() === authUser?._id?.toString())
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const refundedReceived = transactions
        .filter(t => ["cashback", "refund"].includes(t.type) && (t.payeeId?._id ?? t.payeeId)?.toString() === currentUserId)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const refundsPaid = transactions
        .filter(t => ["cashback", "refund"].includes(t.type) && (t.payerId?._id ?? t.payerId)?.toString() === currentUserId)
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {isProvider ? (
                    <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                        <div className="stat-title">Total Received (net)</div>
                        <div className="stat-value text-success text-2xl">
                            ₱{totalReceived.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-desc">After platform fee</div>
                    </div>
                ) : (
                    <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                        <div className="stat-title">Total Paid</div>
                        <div className="stat-value text-primary text-2xl">
                            ₱{totalPaid.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                        </div>
                        <div className="stat-desc">{transactions.length} transaction(s)</div>
                    </div>
                )}
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                    <div className="stat-title">{isProvider ? "Refunds / Cashback Paid" : "Refunded"}</div>
                    <div className={`stat-value text-2xl ${isProvider ? "text-error" : "text-success"}`}>
                        â‚±{(isProvider ? refundsPaid : refundedReceived).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="stat-desc">{isProvider ? "Provider-shouldered adjustments" : "Money returned to you"}</div>
                </div>
                <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                    <div className="stat-title">Transactions</div>
                    <div className="stat-value text-2xl">{transactions.length}</div>
                    <div className="stat-desc">All time</div>
                </div>
            </div>

            {/* Table */}
            <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)] overflow-x-auto">
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
                                    <td className="text-xs font-semibold">{TYPE_LABEL[t.type] || t.type}</td>
                                    <td className="font-semibold">
                                        ₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                    </td>
                                    {isProvider ? (
                                        <td className={`${providerNet(t) < 0 ? "text-error" : "text-success"} font-semibold`}>
                                            {providerNet(t) < 0 ? "-" : ""}₱{Math.abs(providerNet(t)).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
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
                                        {(t.type === "refund" || appt?.status) && <StatusPill status={t.type === "refund" ? "refunded" : appt.status} />}
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
