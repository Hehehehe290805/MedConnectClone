import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import { ArrowLeftIcon, PackageIcon, ReceiptIcon, XIcon, BarChart3Icon } from "lucide-react";
import { useNavigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import { getMyPharmacyOrders } from "../lib/api";
import DepartmentIncomeTab from "../components/DepartmentIncomeTab.jsx";
import InstituteAnalyticsTab from "../components/InstituteAnalyticsTab.jsx";
import DoctorAnalyticsTab from "../components/DoctorAnalyticsTab.jsx";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = "Asia/Manila";

const STATUS_STYLES = {
    pending_payment: "bg-amber-100 text-amber-800 border-amber-200",
    deposit_paid: "bg-primary/10 text-primary border-primary/20",
    accepted: "bg-primary/10 text-primary border-primary/20",
    ongoing: "bg-primary/10 text-primary border-primary/20",
    completed: "bg-emerald-100 text-emerald-800 border-emerald-200",
    awaiting_balance: "bg-amber-100 text-amber-800 border-amber-200",
    fully_paid: "bg-emerald-100 text-emerald-800 border-emerald-200",
    cancelled: "bg-rose-100 text-rose-800 border-rose-200",
    rejected: "bg-rose-100 text-rose-800 border-rose-200",
    disputed: "bg-amber-100 text-amber-800 border-amber-200",
    resolved: "bg-slate-200 text-slate-700 border-slate-300",
    missed_by_patient: "bg-amber-100 text-amber-800 border-amber-200",
    missed_by_provider: "bg-primary/10 text-primary border-primary/20",
    missed_by_both: "bg-primary/10 text-primary border-primary/20",
    paid: "bg-primary/10 text-primary border-primary/20",
    ready_for_shipping: "bg-primary/10 text-primary border-primary/20",
    ready_for_pickup: "bg-primary/10 text-primary border-primary/20",
    out_for_delivery: "bg-yellow-100 text-yellow-900 border-yellow-200",
    pickup_in_progress: "bg-yellow-100 text-yellow-900 border-yellow-200",
    refunded: "bg-emerald-100 text-emerald-800 border-emerald-200",
};

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const TYPE_LABEL = {
    deposit: "Deposit",
    balance: "Balance",
    rebook_fee: "Rebook Fee",
    cashback: "Cashback",
    refund: "Refund",
};
const REBOOKABLE_STATUSES = ["missed_by_patient", "missed_by_provider", "missed_by_both"];
const rebookOutcomeLabel = (appt) => {
    if (!appt?.rebooked && appt?.missedBy) return "Rebooking available";
    if (appt?.status === "cancelled") {
        const reason = (appt.rejectionReason || "").toLowerCase();
        if (reason.includes("missed")) return "Missed and cancelled";
        if (reason.includes("rejected")) return "Rejected and cancelled";
        if (reason.includes("passed")) return "Expired and cancelled";
        return "Cancelled";
    }
    if (appt?.status === "deposit_paid") return "Rebooked - pending provider approval";
    if (["accepted", "ongoing", "awaiting_balance", "completed", "fully_paid"].includes(appt?.status)) return "Rebooked successfully";
    if (appt?.rebooked && REBOOKABLE_STATUSES.includes(appt.status)) return "Rebooked";
    return null;
};
const adjustmentReason = (transaction, appt, isCashOut) => {
    if (!["cashback", "refund"].includes(transaction.type)) return null;
    const ref = transaction.referenceNumber || "";
    if (transaction.type === "refund") {
        return isCashOut
            ? "You refunded the patient's deposit because you rejected this paid booking request. MedConnect's platform fee stays with the platform."
            : "You received your deposit back because the provider rejected this paid booking request.";
    }
    if (ref.startsWith("RB-BOTH-REJ")) {
        return isCashOut
            ? "You paid a 10% refund because you rejected a free rebook after both parties missed the original virtual appointment. MedConnect's platform fee stays with the platform."
            : "You received a 10% refund because the provider rejected the free rebook after both parties missed the original virtual appointment. MedConnect's platform fee was not reversed.";
    }
    if (ref.startsWith("RB-PROV-REJ")) {
        return isCashOut
            ? "You paid the deposit refund because you rejected the rebook after missing the original virtual appointment. MedConnect's platform fee stays with the platform."
            : "You received a provider-shouldered deposit refund because the provider rejected the rebook after missing the original virtual appointment. MedConnect's platform fee was not reversed.";
    }
    if (ref.startsWith("RB-PAT-REJ")) {
        return isCashOut
            ? "You returned the paid rebooking fee because you rejected the patient's rebook request."
            : "You received your rebooking fee back because the provider rejected your paid rebook request.";
    }
    if (ref.startsWith("CB-") || appt?.missedBy === "provider") {
        return isCashOut
            ? "You paid mock cashback because you were not able to complete the virtual appointment. MedConnect's platform fee stays with the platform."
            : "You received provider-shouldered mock cashback because the provider was not able to complete the virtual appointment. MedConnect's platform fee was not reversed.";
    }
    return isCashOut
        ? "Cashback was paid for this appointment adjustment."
        : "Cashback was received for this appointment adjustment.";
};

const statusPill = (status) => (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[status] || "bg-slate-100 text-slate-700 border-slate-200"}`}>
        {status?.replace(/_/g, " ")}
    </span>
);

const PharmacyOrderModal = ({ order, onClose }) => {
    if (!order) return null;
    const paidAt = order.paidAt || order.createdAt;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide opacity-80">Pharmacy Order</p>
                            <h2 className="font-mono text-lg font-bold break-all">{order.referenceNumber}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{dayjs(paidAt).tz(PH_TZ).format("MMM D, YYYY h:mm A")}</p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Fulfillment</p>
                            <p className="font-semibold capitalize">{order.fulfillmentMethod}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Status</p>
                            <div className="mt-1">{statusPill(order.status)}</div>
                        </div>
                    </div>

                    <div className="rounded-xl border border-base-300 bg-base-100 p-3">
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-50 mb-2">Items</p>
                        <div className="space-y-2">
                            {(order.items || []).map((item, index) => (
                                <div key={`${item.name}-${index}`} className="flex justify-between gap-3 text-sm">
                                    <span>{item.name} x{item.quantity}</span>
                                    <span className="font-semibold">{currency(item.unitPrice * item.quantity)}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3">
                        <div className="flex justify-between py-1.5 text-sm">
                            <span className="opacity-60">Subtotal</span>
                            <span className="font-semibold">{currency(order.subtotal)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 text-sm">
                            <span className="opacity-60">Delivery fee</span>
                            <span className="font-semibold">{currency(order.deliveryFee)}</span>
                        </div>
                        <div className="flex justify-between py-1.5 text-sm">
                            <span className="opacity-60">Platform fee</span>
                            <span className="font-semibold">{currency(order.platformFee)}</span>
                        </div>
                        <div className="divider my-1" />
                        <div className="flex justify-between py-1.5">
                            <span className="font-semibold">Total paid</span>
                            <span className="text-xl font-bold text-primary">{currency(order.totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const AppointmentTransactionModal = ({ transaction, isDoctor, currentUserId, onClose }) => {
    if (!transaction) return null;
    const appt = transaction.appointmentId;
    const providerName = appt?.doctorId
        ? `Dr. ${appt.doctorId.firstName} ${appt.doctorId.lastName}`
        : "Institute";
    const patientName = appt?.walkInDetails?.firstName
        ? `${appt.walkInDetails.firstName} ${appt.walkInDetails.lastName || ""}`.trim() + " (Walk-in)"
        : appt?.patientId
        ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
        : "Patient";
    const counterpart = isDoctor ? patientName : providerName;
    const isCashOut = (t) => ["cashback", "refund"].includes(t.type) && (t.payerId?._id ?? t.payerId)?.toString() === currentUserId;
    const providerNet = (t) => isCashOut(t) ? -(t.amount ?? 0) : (t.netAmount ?? 0);
    const isAdjustment = ["cashback", "refund"].includes(transaction.type);
    const reason = adjustmentReason(transaction, appt, isCashOut(transaction));
    const status = transaction.type === "refund" ? "refunded" : appt?.status;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg p-0 overflow-hidden">
                <div className={`${isAdjustment ? "bg-emerald-600" : "bg-primary"} text-primary-content px-5 py-4`}>
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide opacity-80">{isAdjustment ? `${TYPE_LABEL[transaction.type]} Receipt` : "Appointment Transaction"}</p>
                            <h2 className="font-mono text-lg font-bold break-all">{transaction.referenceNumber}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{dayjs(transaction.createdAt).tz(PH_TZ).format("MMM D, YYYY h:mm A")}</p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">{isDoctor ? "Patient" : "Provider"}</p>
                            <p className="font-semibold">{counterpart}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Status</p>
                            <div className="mt-1">{status ? statusPill(status) : "Recorded"}</div>
                        </div>
                        {appt?.start && (
                            <div className="rounded-lg border border-base-300 bg-base-100 p-2.5 sm:col-span-2">
                                <p className="text-xs opacity-50">Appointment Schedule</p>
                                <p className="font-semibold">{dayjs(appt.start).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")}</p>
                            </div>
                        )}
                    </div>

                    <div className="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3">
                        <div className="flex justify-between py-1.5 text-sm">
                            <span className="opacity-60">{TYPE_LABEL[transaction.type] || "Amount paid"}</span>
                            <span className="font-semibold">{currency(transaction.amount)}</span>
                        </div>
                        {!isDoctor && (
                            <div className="flex justify-between py-1.5 text-sm">
                                <span className="opacity-60">Platform fee</span>
                                <span className="font-semibold text-error">-{currency(transaction.platformFee)}</span>
                            </div>
                        )}
                        {isDoctor && (
                            <div className="flex justify-between py-1.5 text-sm">
                                <span className="opacity-60">{isCashOut(transaction) ? `${TYPE_LABEL[transaction.type]} paid` : "Net received"}</span>
                                <span className={`font-semibold ${isCashOut(transaction) ? "text-error" : ""}`}>
                                    {isCashOut(transaction) ? "-" : ""}{currency(Math.abs(providerNet(transaction)))}
                                </span>
                            </div>
                        )}
                        {isAdjustment && (
                            <>
                                <div className="divider my-1" />
                                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
                                    <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
                                        {isCashOut(transaction) ? "Money sent" : "Money received"}
                                    </p>
                                    <p className="mt-1 text-2xl font-bold text-emerald-700">{currency(transaction.amount)}</p>
                                    <p className="mt-2 text-xs leading-relaxed text-emerald-900">{reason}</p>
                                </div>
                            </>
                        )}
                        {(appt?.rebooked || appt?.missedBy) && (
                            <div className="mt-2 border-t border-base-300 pt-2 text-sm space-y-1">
                                <div className="flex justify-between gap-3">
                                    <span className="font-semibold text-primary">Rebook Details</span>
                                    <span className="font-semibold text-right">{rebookOutcomeLabel(appt)}</span>
                                </div>
                                {appt.rebookedAt && (
                                    <div className="flex justify-between gap-3 text-xs opacity-70">
                                        <span>Requested</span>
                                        <span className="text-right">{dayjs(appt.rebookedAt).tz(PH_TZ).format("MMM D, YYYY [at] h:mm A")}</span>
                                    </div>
                                )}
                                {appt.rebookFeeRef && (
                                    <p className="text-xs opacity-60">Rebooking fee ref: <span className="font-mono">{appt.rebookFeeRef}</span></p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const TransactionPage = () => {
    const navigate = useNavigate();
    const { authUser } = useAuthUser();
    const [tab, setTab] = useState("appointments");
    const [selectedPharmacyOrder, setSelectedPharmacyOrder] = useState(null);
    const [selectedAppointmentTransaction, setSelectedAppointmentTransaction] = useState(null);

    const { data, isLoading } = useQuery({
        queryKey: ["transactions"],
        queryFn: () => axiosInstance.get("/booking/transaction-history").then(r => r.data),
    });

    const { data: pharmacyOrdersData, isLoading: pharmacyLoading } = useQuery({
        queryKey: ["my-pharmacy-orders"],
        queryFn: getMyPharmacyOrders,
        enabled: authUser?.role === "patient",
    });

    const transactions = [...(data?.data?.transactions ?? [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const pharmacyOrders = [...(pharmacyOrdersData?.data?.orders ?? [])]
        .filter((order) => order.paymentStatus === "paid")
        .sort((a, b) => new Date(b.paidAt || b.createdAt) - new Date(a.paidAt || a.createdAt));
    const isDoctor = authUser?.role === "doctor" || authUser?.role === "institute" || authUser?.role === "department";
    const canShowPharmacyTab = authUser?.role === "patient";
    const canShowDepartmentIncomeTab = authUser?.role === "department";
    const canShowInstituteTab = authUser?.role === "institute";
    const canShowDoctorAnalyticsTab = authUser?.role === "doctor";

    const totalReceived = transactions.reduce((sum, t) => {
        const payeeId = (t.payeeId?._id ?? t.payeeId)?.toString();
        const payerId = (t.payerId?._id ?? t.payerId)?.toString();
        if (payeeId === authUser?._id) return sum + (t.netAmount ?? 0);
        if (["cashback", "refund"].includes(t.type) && payerId === authUser?._id) return sum - (t.amount ?? 0);
        return sum;
    }, 0);

    const appointmentPaid = transactions
        .filter(t => t.payerId?._id === authUser?._id || t.payerId === authUser?._id)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);

    const pharmacyPaid = pharmacyOrders.reduce((sum, order) => sum + (order.totalAmount ?? 0), 0);
    const totalPaid = appointmentPaid + pharmacyPaid;
    const transactionCount = transactions.length + pharmacyOrders.length;
    const currentUserId = authUser?._id?.toString();
    const isCashOut = (t) => ["cashback", "refund"].includes(t.type) && (t.payerId?._id ?? t.payerId)?.toString() === currentUserId;
    const providerNet = (t) => isCashOut(t) ? -(t.amount ?? 0) : (t.netAmount ?? 0);
    const refundedReceived = transactions
        .filter(t => ["cashback", "refund"].includes(t.type) && (t.payeeId?._id ?? t.payeeId)?.toString() === currentUserId)
        .reduce((sum, t) => sum + (t.amount ?? 0), 0);
    const refundsPaid = transactions
        .filter(t => ["cashback", "refund"].includes(t.type) && (t.payerId?._id ?? t.payerId)?.toString() === currentUserId)
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

                {(canShowPharmacyTab || canShowDepartmentIncomeTab || canShowInstituteTab || canShowDoctorAnalyticsTab) && (
                    <div role="tablist" className="tabs tabs-bordered">
                        <button role="tab" className={`tab gap-2 ${tab === "appointments" ? "tab-active" : ""}`} onClick={() => setTab("appointments")}>
                            <ReceiptIcon className="size-4" />
                            {canShowPharmacyTab ? "Appointments" : "Transactions"}
                        </button>
                        {canShowPharmacyTab && (
                            <button role="tab" className={`tab gap-2 ${tab === "pharmacy" ? "tab-active" : ""}`} onClick={() => setTab("pharmacy")}>
                                <PackageIcon className="size-4" />
                                Pharmacy Orders
                            </button>
                        )}
                        {canShowDepartmentIncomeTab && (
                            <button role="tab" className={`tab gap-2 ${tab === "income" ? "tab-active" : ""}`} onClick={() => setTab("income")}>
                                <BarChart3Icon className="size-4" />
                                All Income
                            </button>
                        )}
                        {canShowInstituteTab && (
                            <button role="tab" className={`tab gap-2 ${tab === "institute-analytics" ? "tab-active" : ""}`} onClick={() => setTab("institute-analytics")}>
                                <BarChart3Icon className="size-4" />
                                Department Analytics
                            </button>
                        )}
                        {canShowDoctorAnalyticsTab && (
                            <button role="tab" className={`tab gap-2 ${tab === "doctor-analytics" ? "tab-active" : ""}`} onClick={() => setTab("doctor-analytics")}>
                                <BarChart3Icon className="size-4" />
                                Analytics
                            </button>
                        )}
                    </div>
                )}

                {tab === "institute-analytics" && <InstituteAnalyticsTab />}
                {tab === "doctor-analytics" && <DoctorAnalyticsTab transactions={transactions} />}

                {tab !== "income" && tab !== "institute-analytics" && tab !== "doctor-analytics" && (
                    <>
                        {transactionCount > 0 && (
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {isDoctor ? (
                            <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                                <div className="stat-title">Total Received (net)</div>
                                <div className="stat-value text-primary text-2xl">{currency(totalReceived)}</div>
                                <div className="stat-desc">After platform fee</div>
                            </div>
                        ) : (
                            <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                                <div className="stat-title">Total Paid</div>
                                <div className="stat-value text-primary text-2xl">{currency(totalPaid)}</div>
                                <div className="stat-desc">{transactionCount} transaction(s)</div>
                            </div>
                        )}
                        <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                            <div className="stat-title">{isDoctor ? "Refunds / Cashback Paid" : "Refunded"}</div>
                            <div className={`stat-value text-2xl ${isDoctor ? "text-error" : "text-success"}`}>
                                {currency(isDoctor ? refundsPaid : refundedReceived)}
                            </div>
                            <div className="stat-desc">{isDoctor ? "Provider-shouldered adjustments" : "Money returned to you"}</div>
                        </div>
                        <div className="stat bg-base-100 border-2 border-base-300 rounded-xl shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
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
                    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)] overflow-x-auto">
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
                                    const patientName = appt?.walkInDetails?.firstName
                                        ? `${appt.walkInDetails.firstName} ${appt.walkInDetails.lastName || ""}`.trim() + " (Walk-in)"
                                        : appt?.patientId
                                        ? `${appt.patientId.firstName} ${appt.patientId.lastName}`
                                        : "Patient";
                                    const counterpart = isDoctor ? patientName : providerName;

                                    return (
                                        <tr key={t._id} className="cursor-pointer hover:bg-base-200/80" onClick={() => setSelectedAppointmentTransaction(t)}>
                                            <td className="text-xs whitespace-nowrap">
                                                {dayjs(t.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                                <br />
                                                <span className="opacity-50">{dayjs(t.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                            </td>
                                            <td className="text-xs font-semibold">{TYPE_LABEL[t.type] || t.type}</td>
                                            <td className="font-semibold">{currency(t.amount)}</td>
                                            {!isDoctor && <td className="text-error text-sm">-{currency(t.platformFee)}</td>}
                                            {isDoctor && (
                                                <td className={`${providerNet(t) < 0 ? "text-error" : "text-success"} font-semibold`}>
                                                    {providerNet(t) < 0 ? "-" : ""}{currency(Math.abs(providerNet(t)))}
                                                </td>
                                            )}
                                            <td className="text-xs">
                                                <p>{counterpart}</p>
                                                {appt?.start && <p className="opacity-50">{dayjs(appt.start).tz(PH_TZ).format("MMM D [at] h:mm A")}</p>}
                                            </td>
                                            <td>
                                                {(t.type === "refund" || appt?.status) && statusPill(t.type === "refund" ? "refunded" : appt.status)}
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
                    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)] overflow-hidden">
                        <table className="table table-zebra w-full">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Items</th>
                                    <th>Fulfillment</th>
                                    <th>Status</th>
                                    <th>Total</th>
                                    <th>Reference</th>
                                </tr>
                            </thead>
                            <tbody>
                                {pharmacyOrders.map((order) => (
                                    <tr key={order._id} className="cursor-pointer hover:bg-base-200/80" onClick={() => setSelectedPharmacyOrder(order)}>
                                        <td className="text-xs whitespace-nowrap">
                                            {dayjs(order.paidAt || order.createdAt).tz(PH_TZ).format("MMM D, YYYY")}
                                            <br />
                                            <span className="opacity-50">{dayjs(order.paidAt || order.createdAt).tz(PH_TZ).format("h:mm A")}</span>
                                        </td>
                                        <td className="text-xs">
                                            {(order.items || []).map((item) => (
                                                <p key={`${order._id}-${item.name}`}>
                                                    {item.name} x{item.quantity} - {currency(item.unitPrice * item.quantity)}
                                                </p>
                                            ))}
                                        </td>
                                        <td className="capitalize">{order.fulfillmentMethod}</td>
                                        <td>
                                            {statusPill(order.status)}
                                        </td>
                                        <td className="font-semibold">{currency(order.totalAmount)}</td>
                                        <td className="font-mono text-xs text-primary">{order.referenceNumber}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
                    </>
                )}

                {tab === "income" && <DepartmentIncomeTab />}

                <AppointmentTransactionModal
                    transaction={selectedAppointmentTransaction}
                    isDoctor={isDoctor}
                    currentUserId={currentUserId}
                    onClose={() => setSelectedAppointmentTransaction(null)}
                />
                <PharmacyOrderModal order={selectedPharmacyOrder} onClose={() => setSelectedPharmacyOrder(null)} />
            </div>
        </div>
    );
};

export default TransactionPage;
