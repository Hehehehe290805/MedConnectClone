import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3Icon, DownloadIcon, PlusIcon, ReceiptIcon, RefreshCwIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { createManualPharmacyTransaction, getPharmacyIncome } from "../lib/api";

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = "Asia/Manila";

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: dayjs().month(index).format("MMMM"),
}));

const statusColors = {
    paid: "badge-success",
    ready_for_shipping: "badge-info",
    ready_for_pickup: "badge-info",
    out_for_delivery: "badge-warning",
    pickup_in_progress: "badge-warning",
    completed: "badge-success",
    cancelled: "badge-error",
};

const ManualTransactionModal = ({ onClose }) => {
    const queryClient = useQueryClient();
    const [form, setForm] = useState({
        transactionDate: dayjs().tz(PH_TZ).format("YYYY-MM-DDTHH:mm"),
        customerName: "",
        itemSummary: "",
        amount: "",
        paymentMethod: "cash",
        note: "",
    });

    const mutation = useMutation({
        mutationFn: () => createManualPharmacyTransaction({
            ...form,
            amount: Number(form.amount),
        }),
        onSuccess: () => {
            toast.success("Manual transaction added");
            queryClient.invalidateQueries({ queryKey: ["pharmacy-income"] });
            onClose();
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not add transaction"),
    });

    const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));
    const canSubmit = form.transactionDate && form.itemSummary.trim() && form.amount !== "";

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl">
                <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                        <h2 className="font-bold text-lg">Add Manual Transaction</h2>
                        <p className="text-sm opacity-60">Use this only for pharmacy sales that happened outside MedConnect.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>

                <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="form-control">
                            <label className="label"><span className="label-text">Date</span></label>
                            <input type="datetime-local" className="input input-bordered" value={form.transactionDate} onChange={(e) => update("transactionDate", e.target.value)} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Payment Method</span></label>
                            <select className="select select-bordered" value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)}>
                                <option value="cash">Cash</option>
                                <option value="gcash">GCash</option>
                                <option value="card">Card</option>
                                <option value="bank_transfer">Bank transfer</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Customer Name</span></label>
                        <input className="input input-bordered" placeholder="Walk-in customer" value={form.customerName} onChange={(e) => update("customerName", e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Items / Description</span></label>
                        <textarea className="textarea textarea-bordered resize-none h-24" value={form.itemSummary} onChange={(e) => update("itemSummary", e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Amount</span></label>
                        <input type="number" min="0" className="input input-bordered" value={form.amount} onChange={(e) => update("amount", e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Note</span></label>
                        <textarea className="textarea textarea-bordered resize-none h-20" value={form.note} onChange={(e) => update("note", e.target.value)} />
                    </div>
                </div>

                <div className="modal-action">
                    <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" disabled={!canSubmit || mutation.isPending} onClick={() => mutation.mutate()}>
                        {mutation.isPending ? <span className="loading loading-spinner loading-sm" /> : null}
                        Add Transaction
                    </button>
                </div>
            </div>
        </div>
    );
};

const PharmacyIncomePage = () => {
    const now = dayjs().tz(PH_TZ);
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [tab, setTab] = useState("transactions");

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["pharmacy-income", year, month],
        queryFn: () => getPharmacyIncome({ year, month }),
    });

    const payload = data?.data ?? {};
    const totals = payload.totals ?? {};
    const orders = payload.orders ?? [];
    const manualTransactions = payload.manualTransactions ?? [];
    const years = payload.years?.length ? payload.years : [now.year()];

    const historyRows = useMemo(() => [
        ...orders.map((order) => ({
            id: order._id,
            source: "app",
            date: order.paidAt || order.createdAt,
            referenceNumber: order.referenceNumber,
            customerName: order.customerName,
            items: (order.items || []).map((item) => `${item.name} x${item.quantity}`),
            status: order.status,
            totalAmount: order.totalAmount,
        })),
        ...manualTransactions.map((transaction) => ({
            id: transaction._id,
            source: "manual",
            date: transaction.transactionDate,
            referenceNumber: transaction.referenceNumber,
            customerName: transaction.customerName,
            items: [transaction.itemSummary],
            status: transaction.paymentMethod,
            totalAmount: transaction.amount,
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)), [orders, manualTransactions]);

    const collectedTotal = historyRows.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const inAppTotal = historyRows.filter((row) => row.source === "app").reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const manualTotal = historyRows.filter((row) => row.source === "manual").reduce((sum, row) => sum + (row.totalAmount || 0), 0);

    const dailyIncome = useMemo(() => {
        const grouped = new Map();
        for (const row of historyRows) {
            const key = dayjs(row.date).tz(PH_TZ).format("MMM D");
            grouped.set(key, (grouped.get(key) || 0) + (row.totalAmount || 0));
        }
        return [...grouped.entries()]
            .map(([label, amount]) => ({ label, amount }))
            .reverse();
    }, [historyRows]);

    const maxDailyAmount = dailyIncome.reduce((max, day) => Math.max(max, day.amount), 0);

    const csvRows = useMemo(() => {
        const header = ["Date", "Source", "Reference", "Customer", "Status", "Items", "Total"];
        const rows = historyRows.map((row) => [
            dayjs(row.date).tz(PH_TZ).format("YYYY-MM-DD HH:mm"),
            row.source,
            row.referenceNumber,
            row.customerName,
            row.status,
            row.items.join("; "),
            row.totalAmount ?? 0,
        ]);
        return [header, ...rows];
    }, [historyRows]);

    const downloadCsv = () => {
        const csv = csvRows
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `pharmacy-transactions-${year}-${String(month).padStart(2, "0")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="p-8 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div className="flex items-center gap-3">
                    <ReceiptIcon className="size-7 text-primary" />
                    <h1 className="text-2xl font-bold">Transactions</h1>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <select className="select select-bordered select-sm" value={year} onChange={(e) => setYear(Number(e.target.value))}>
                        {years.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                    <select className="select select-bordered select-sm" value={month} onChange={(e) => setMonth(Number(e.target.value))}>
                        {monthOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    <button className="btn btn-ghost btn-sm gap-2" onClick={() => refetch()} disabled={isFetching}>
                        {isFetching ? <span className="loading loading-spinner loading-xs" /> : <RefreshCwIcon className="size-4" />}
                        Refresh
                    </button>
                    <button className="btn btn-primary btn-sm gap-2" onClick={downloadCsv} disabled={historyRows.length === 0}>
                        <DownloadIcon className="size-4" />
                        Export
                    </button>
                    <button className="btn btn-primary btn-sm gap-2" onClick={() => setManualModalOpen(true)}>
                        <PlusIcon className="size-4" />
                        Manual Transaction
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            ) : (
                <>
                    <div role="tablist" className="tabs tabs-bordered">
                        <button role="tab" className={`tab gap-2 ${tab === "transactions" ? "tab-active" : ""}`} onClick={() => setTab("transactions")}>
                            <ReceiptIcon className="size-4" />
                            Transactions
                        </button>
                        <button role="tab" className={`tab gap-2 ${tab === "income" ? "tab-active" : ""}`} onClick={() => setTab("income")}>
                            <BarChart3Icon className="size-4" />
                            All Income
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                        <div className="stat bg-base-200 rounded-lg">
                            <div className="stat-title">Collected Total</div>
                            <div className="stat-value text-primary text-2xl">{currency(collectedTotal)}</div>
                            <div className="stat-desc">In-app + manual</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg">
                            <div className="stat-title">In-app Sales</div>
                            <div className="stat-value text-2xl">{currency(inAppTotal)}</div>
                            <div className="stat-desc">MedConnect orders</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg">
                            <div className="stat-title">Manual Sales</div>
                            <div className="stat-value text-info text-2xl">{currency(manualTotal)}</div>
                            <div className="stat-desc">Outside MedConnect</div>
                        </div>
                        <div className="stat bg-base-200 rounded-lg">
                            <div className="stat-title">Transactions</div>
                            <div className="stat-value text-2xl">{historyRows.length}</div>
                            <div className="stat-desc">{totals.itemCount ?? 0} in-app item(s)</div>
                        </div>
                    </div>

                    {tab === "transactions" && (
                        <div className="card bg-base-200 shadow-sm">
                            <div className="card-body">
                                <h2 className="font-semibold">Transaction History</h2>
                                {historyRows.length === 0 ? (
                                    <div className="text-center py-12 opacity-50">
                                        <ReceiptIcon className="size-10 mx-auto mb-3" />
                                        <p className="font-medium">No pharmacy transactions for this month</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="table table-zebra">
                                            <thead>
                                                <tr>
                                                    <th>Date</th>
                                                    <th>Reference</th>
                                                    <th>Customer</th>
                                                    <th>Items</th>
                                                    <th>Status</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyRows.map((row) => (
                                                    <tr key={row.id}>
                                                        <td className="text-xs whitespace-nowrap">
                                                            {dayjs(row.date).tz(PH_TZ).format("MMM D, YYYY")}
                                                            <br />
                                                            <span className="opacity-50">{dayjs(row.date).tz(PH_TZ).format("h:mm A")}</span>
                                                        </td>
                                                        <td>
                                                            <p className="font-mono text-xs text-primary">{row.referenceNumber}</p>
                                                            <span className={`badge badge-xs ${row.source === "manual" ? "badge-info" : "badge-success"}`}>
                                                                {row.source === "manual" ? "Manual" : "In-app"}
                                                            </span>
                                                        </td>
                                                        <td>{row.customerName}</td>
                                                        <td className="text-xs">
                                                            {row.items.map((item) => (
                                                                <p key={`${row.id}-${item}`}>{item}</p>
                                                            ))}
                                                        </td>
                                                        <td>
                                                            <span className={`badge badge-sm ${statusColors[row.status] || "badge-ghost"}`}>
                                                                {row.status?.replace(/_/g, " ")}
                                                            </span>
                                                        </td>
                                                        <td className="font-semibold">{currency(row.totalAmount)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {tab === "income" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="stat bg-base-200 rounded-lg">
                                    <div className="stat-title">Product Sales</div>
                                    <div className="stat-value text-2xl">{currency(totals.productSales)}</div>
                                    <div className="stat-desc">Before delivery fees</div>
                                </div>
                                <div className="stat bg-base-200 rounded-lg">
                                    <div className="stat-title">Delivery Fees</div>
                                    <div className="stat-value text-2xl">{currency(totals.deliveryFees)}</div>
                                    <div className="stat-desc">Delivery orders only</div>
                                </div>
                            </div>

                            <div className="card bg-base-200 shadow-sm">
                                <div className="card-body">
                                    <h2 className="font-semibold">Daily Income</h2>
                                    {dailyIncome.length === 0 ? (
                                        <div className="text-center py-12 opacity-50">
                                            <BarChart3Icon className="size-10 mx-auto mb-3" />
                                            <p className="font-medium">No income to chart</p>
                                        </div>
                                    ) : (
                                        <div className="h-72 flex items-end gap-2 border-b border-base-300 pt-6">
                                            {dailyIncome.map((day) => {
                                                const height = maxDailyAmount ? Math.max(8, (day.amount / maxDailyAmount) * 100) : 0;
                                                return (
                                                    <div key={day.label} className="flex-1 min-w-8 flex flex-col items-center gap-2">
                                                        <div className="text-xs font-medium">{currency(day.amount)}</div>
                                                        <div
                                                            className="w-full rounded-t-md bg-info"
                                                            style={{ height: `${height}%` }}
                                                            title={`${day.label}: ${currency(day.amount)}`}
                                                        />
                                                        <div className="text-xs opacity-60 whitespace-nowrap">{day.label}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
            {manualModalOpen && <ManualTransactionModal onClose={() => setManualModalOpen(false)} />}
        </div>
    );
};

export default PharmacyIncomePage;
