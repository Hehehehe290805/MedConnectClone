import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { ArrowLeftIcon, ReceiptIcon } from "lucide-react";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
dayjs.extend(utc);
dayjs.extend(timezone);
const PH_TZ = "Asia/Manila";

const TYPE_LABEL = { deposit: "Deposit", balance: "Balance" };

const STATUS_COLORS = {
    pending_payment: "badge-warning",
    deposit_paid: "badge-info",
    accepted: "badge-info",
    ongoing: "badge-accent",
    completed: "badge-success",
    awaiting_balance: "badge-warning",
    fully_paid: "badge-success",
    cancelled: "badge-error",
    rejected: "badge-error",
    disputed: "badge-warning",
    resolved: "badge-ghost",
};

const TransactionPage = () => {
    const navigate = useNavigate();
    const { authUser } = useAuthUser();

    const { data, isLoading } = useQuery({
        queryKey: ["transactions"],
        queryFn: () => axiosInstance.get("/booking/transaction-history").then(r => r.data),
    });

    const transactions = data?.data?.transactions ?? [];
    const isDoctor = authUser?.role === "doctor" || authUser?.role === "institute" || authUser?.role === "department";

    const totalReceived = transactions
        .filter(t => t.payeeId?._id === authUser?._id || t.payeeId === authUser?._id)
        .reduce((sum, t) => sum + (t.netAmount ?? 0), 0);

    const totalPaid = transactions
        .filter(t => t.payerId?._id === authUser?._id || t.payerId === authUser?._id)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    return (
        <div className="min-h-screen bg-base-100 p-4 py-8">
            <div className="max-w-4xl mx-auto space-y-6">
                <button onClick={() => navigate("/")} className="flex items-center gap-2 text-primary font-semibold hover:underline">
                    <ArrowLeftIcon className="w-5 h-5" />Back to Home
                </button>

                <div className="flex items-center gap-3">
                    <ReceiptIcon className="w-7 h-7 text-primary" />
                    <h1 className="text-3xl font-bold">Transaction History</h1>
                </div>

                {/* Summary cards */}
                {transactions.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isDoctor ? (
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
                )}

                {isLoading ? (
                    <div className="flex justify-center py-16">
                        <span className="loading loading-spinner loading-lg text-primary" />
                    </div>
                ) : transactions.length === 0 ? (
                    <div className="text-center py-16 opacity-50">
                        <ReceiptIcon className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-lg font-medium">No transactions yet</p>
                        <p className="text-sm">Your payment history will appear here.</p>
                    </div>
                ) : (
                    <div className="card bg-base-200 shadow-xl overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Amount</th>
                                    {!isDoctor && <th>Platform Fee</th>}
                                    {isDoctor && <th>Net Received</th>}
                                    <th>Appointment</th>
                                    <th>Status</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {transactions.map((t) => {
                                    const appt = t.appointmentId;
                                    const providerName =
                                        appt?.doctorId
                                            ? `Dr. ${appt.doctorId.firstName} ${appt.doctorId.lastName}`
                                            : "Institute";
                                    const patientName = appt?.patientId
                                        ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
                                        : "Patient";
                                    const counterpart = isDoctor ? patientName : providerName;

                                    return (
                                        <tr key={t._id}>
                                            <td className="text-xs whitespace-nowrap">
                                                {dayjs(t.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                                <br />
                                                <span className="opacity-50">{dayjs(t.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                            </td>
                                            <td>
                                                <span className={`badge badge-sm ${t.type === "deposit" ? "badge-info" : "badge-accent"}`}>
                                                    {TYPE_LABEL[t.type]}
                                                </span>
                                            </td>
                                            <td className="font-semibold">
                                                ₱{t.amount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                            </td>
                                            {!isDoctor && (
                                                <td className="text-error text-sm">
                                                    -₱{t.platformFee?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                                </td>
                                            )}
                                            {isDoctor && (
                                                <td className="text-success font-semibold">
                                                    ₱{t.netAmount?.toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                                                </td>
                                            )}
                                            <td className="text-xs">
                                                <p>{counterpart}</p>
                                                {appt?.start && (
                                                    <p className="opacity-50">{dayjs(appt.start).tz(PH_TZ).format("MMM D [at] h:mm A")}</p>
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
                )}
            </div>
        </div>
    );
};

export default TransactionPage;
