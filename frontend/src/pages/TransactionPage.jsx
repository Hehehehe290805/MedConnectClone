import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { ArrowLeftIcon, PackageIcon, ReceiptIcon } from "lucide-react";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { getMyPharmacyOrders } from "../lib/api";
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
    paid: "badge-success",
    ready_for_shipping: "badge-info",
    ready_for_pickup: "badge-info",
    out_for_delivery: "badge-warning",
    pickup_in_progress: "badge-warning",
};

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const TransactionPage = () => {
    const navigate = useNavigate();
    const { authUser } = useAuthUser();
    const [tab, setTab] = useState("appointments");

    const { data, isLoading } = useQuery({
        queryKey: ["transactions"],
        queryFn: () => axiosInstance.get("/booking/transaction-history").then(r => r.data),
    });

    const { data: pharmacyOrdersData, isLoading: pharmacyLoading } = useQuery({
        queryKey: ["my-pharmacy-orders"],
        queryFn: getMyPharmacyOrders,
        enabled: authUser?.role === "patient",
    });

    const transactions = data?.data?.transactions ?? [];
    const pharmacyOrders = (pharmacyOrdersData?.data?.orders ?? []).filter((order) => order.paymentStatus === "paid");
    const isDoctor = authUser?.role === "doctor" || authUser?.role === "institute" || authUser?.role === "department";
    const canShowPharmacyTab = authUser?.role === "patient";

    const totalReceived = transactions
        .filter(t => t.payeeId?._id === authUser?._id || t.payeeId === authUser?._id)
        .reduce((sum, t) => sum + (t.netAmount ?? 0), 0);

    const appointmentPaid = transactions
        .filter(t => t.payerId?._id === authUser?._id || t.payerId === authUser?._id)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    const pharmacyPaid = pharmacyOrders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
    const totalPaid = appointmentPaid + pharmacyPaid;
    const transactionCount = transactions.length + pharmacyOrders.length;

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

                {canShowPharmacyTab && (
                    <div role="tablist" className="tabs tabs-bordered">
                        <button role="tab" className={`tab gap-2 ${tab === "appointments" ? "tab-active" : ""}`} onClick={() => setTab("appointments")}>
                            <ReceiptIcon className="size-4" />
                            Appointments
                        </button>
                        <button role="tab" className={`tab gap-2 ${tab === "pharmacy" ? "tab-active" : ""}`} onClick={() => setTab("pharmacy")}>
                            <PackageIcon className="size-4" />
                            Pharmacy Orders
                        </button>
                    </div>
                )}

                {transactionCount > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {isDoctor ? (
                            <div className="stat bg-base-200 rounded-xl">
                                <div className="stat-title">Total Received (net)</div>
                                <div className="stat-value text-success text-2xl">{currency(totalReceived)}</div>
                                <div className="stat-desc">After platform fee</div>
                            </div>
                        ) : (
                            <div className="stat bg-base-200 rounded-xl">
                                <div className="stat-title">Total Paid</div>
                                <div className="stat-value text-primary text-2xl">{currency(totalPaid)}</div>
                                <div className="stat-desc">{transactionCount} transaction(s)</div>
                            </div>
                        )}
                        <div className="stat bg-base-200 rounded-xl">
                            <div className="stat-title">Transactions</div>
                            <div className="stat-value text-2xl">{transactionCount}</div>
                            <div className="stat-desc">All time</div>
                        </div>
                    </div>
                )}

                {isLoading || (tab === "pharmacy" && pharmacyLoading) ? (
                    <div className="flex justify-center py-16">
                        <span className="loading loading-spinner loading-lg text-primary" />
                    </div>
                ) : tab === "appointments" && transactions.length === 0 ? (
                    <div className="text-center py-16 opacity-50">
                        <ReceiptIcon className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-lg font-medium">No transactions yet</p>
                        <p className="text-sm">Your payment history will appear here.</p>
                    </div>
                ) : tab === "appointments" ? (
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
                                    const providerName = appt?.doctorId
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
                                            <td className="font-semibold">{currency(t.amount)}</td>
                                            {!isDoctor && <td className="text-error text-sm">-{currency(t.platformFee)}</td>}
                                            {isDoctor && <td className="text-success font-semibold">{currency(t.netAmount)}</td>}
                                            <td className="text-xs">
                                                <p>{counterpart}</p>
                                                {appt?.start && <p className="opacity-50">{dayjs(appt.start).tz(PH_TZ).format("MMM D [at] h:mm A")}</p>}
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
                ) : pharmacyOrders.length === 0 ? (
                    <div className="text-center py-16 opacity-50">
                        <PackageIcon className="w-12 h-12 mx-auto mb-3" />
                        <p className="text-lg font-medium">No pharmacy orders yet</p>
                        <p className="text-sm">Paid pharmacy orders will appear here.</p>
                    </div>
                ) : (
                    <div className="card bg-base-200 shadow-xl overflow-x-auto">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Type</th>
                                    <th>Items</th>
                                    <th>Fulfillment</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pharmacyOrders.map((order) => (
                                    <tr key={order._id}>
                                        <td className="text-xs whitespace-nowrap">
                                            {dayjs(order.paidAt || order.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                            <br />
                                            <span className="opacity-50">{dayjs(order.paidAt || order.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                        </td>
                                        <td><span className="badge badge-sm badge-info">Pharmacy order</span></td>
                                        <td className="text-xs">
                                            {(order.items || []).map((item) => (
                                                <p key={`${order._id}-${item.name}`}>
                                                    {item.name} x{item.quantity} - {currency(item.unitPrice * item.quantity)}
                                                </p>
                                            ))}
                                        </td>
                                        <td className="capitalize">{order.fulfillmentMethod}</td>
                                        <td>
                                            <span className={`badge badge-sm ${STATUS_COLORS[order.status] || "badge-ghost"} capitalize`}>
                                                {order.status?.replace(/_/g, " ")}
                                            </span>
                                        </td>
                                        <td className="font-semibold">{currency(order.totalAmount)}</td>
                                        <td className="font-mono text-xs text-primary">{order.referenceNumber}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TransactionPage;
