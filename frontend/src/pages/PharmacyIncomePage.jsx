import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3Icon, DownloadIcon, PlusIcon, ReceiptIcon, RefreshCwIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { createManualPharmacyTransaction, getMyPharmacyProducts, getPharmacyIncome } from "../lib/api";

dayjs.extend(utc);
dayjs.extend(timezone);

const PH_TZ = "Asia/Manila";

const currency = (value) =>
    `PHP ${(value ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const monthOptions = Array.from({ length: 12 }, (_, index) => ({
    value: index + 1,
    label: dayjs().month(index).format("MMMM"),
}));

const IncomeStatCard = ({ label, value, description }) => (
    <div className="stat rounded-xl border-2 border-base-300 bg-base-100 py-4 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_6px_18px_rgba(15,23,42,0.16)]">
        <div className="stat-title">{label}</div>
        <div className="stat-value text-2xl">{value}</div>
        <div className="stat-desc">{description}</div>
    </div>
);

const cleanLabel = (value) => value?.replace(/_/g, " ") || "Recorded";

const ManualTransactionModal = ({ onClose }) => {
    const queryClient = useQueryClient();
    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ["my-pharmacy-products"],
        queryFn: getMyPharmacyProducts,
    });
    const products = productsData?.data?.products ?? [];
    const [form, setForm] = useState({
        transactionDate: dayjs().tz(PH_TZ).format("YYYY-MM-DDTHH:mm"),
        productId: "",
        quantity: 1,
        unitPrice: "",
        itemSummary: "",
        amount: "",
        paymentMethod: "cash",
        note: "",
    });

    const selectedProduct = products.find((product) => product._id === form.productId);

    const mutation = useMutation({
        mutationFn: () => createManualPharmacyTransaction({
            transactionDate: form.transactionDate,
            customerName: "Walk-in Customer",
            itemSummary: form.itemSummary,
            amount: Number(form.amount),
            paymentMethod: form.paymentMethod,
            note: form.note,
        }),
        onSuccess: () => {
            toast.success("Manual transaction added");
            queryClient.invalidateQueries({ queryKey: ["pharmacy-income"] });
            onClose();
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not add transaction"),
    });

    const update = (field, value) => setForm((current) => {
        const next = { ...current, [field]: value };
        const product = field === "productId"
            ? products.find((item) => item._id === value)
            : selectedProduct;
        if (field === "productId" && product) {
            const quantity = Number(next.quantity) || 1;
            next.unitPrice = String(product.price ?? 0);
            next.amount = String((product.price ?? 0) * quantity);
            next.itemSummary = `${product.name} x${quantity}`;
        }
        if ((field === "quantity" || field === "unitPrice") && product) {
            const quantity = Math.max(1, Number(next.quantity) || 1);
            const price = Number(next.unitPrice) || 0;
            next.quantity = quantity;
            next.amount = String(price * quantity);
            next.itemSummary = `${product.name} x${quantity}`;
        }
        return next;
    });
    const canSubmit = form.transactionDate && form.itemSummary.trim() && form.amount !== "";

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-xl p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h2 className="font-bold text-lg">Add Manual Transaction</h2>
                        <p className="text-sm opacity-80">Use this only for pharmacy sales that happened outside MedConnect.</p>
                    </div>
                    <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                        <XIcon className="size-4" />
                    </button>
                </div>
                </div>

                <div className="space-y-3 p-5">
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
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="form-control md:col-span-2">
                            <label className="label"><span className="label-text">Catalogue Product</span></label>
                            <select className="select select-bordered" value={form.productId} onChange={(e) => update("productId", e.target.value)} disabled={productsLoading}>
                                <option value="">{productsLoading ? "Loading products..." : "Select product..."}</option>
                                {products.map((product) => (
                                    <option key={product._id} value={product._id}>{product.name}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Quantity</span></label>
                            <input type="number" min="1" className="input input-bordered" value={form.quantity} onChange={(e) => update("quantity", e.target.value)} />
                        </div>
                        <div className="form-control">
                            <label className="label"><span className="label-text">Unit Price</span></label>
                            <input type="number" min="0" className="input input-bordered" value={form.unitPrice} onChange={(e) => update("unitPrice", e.target.value)} />
                        </div>
                    </div>
                    {selectedProduct && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <div className="rounded-lg bg-base-200 p-3">
                                <p className="text-xs opacity-50">Product Type</p>
                                <p className="font-semibold">{selectedProduct.overTheCounter ? "OTC" : "Prescription"}</p>
                            </div>
                            <div className="rounded-lg bg-base-200 p-3">
                                <p className="text-xs opacity-50">Stock</p>
                                <p className="font-semibold">{selectedProduct.stock}</p>
                            </div>
                            <div className="rounded-lg bg-base-200 p-3">
                                <p className="text-xs opacity-50">Customer</p>
                                <p className="font-semibold">Walk-in Customer</p>
                            </div>
                        </div>
                    )}
                    <div className="form-control">
                        <label className="label"><span className="label-text">Total Amount</span></label>
                        <input type="number" min="0" className="input input-bordered" value={form.amount} onChange={(e) => update("amount", e.target.value)} />
                    </div>
                    <div className="form-control">
                        <label className="label"><span className="label-text">Note</span></label>
                        <textarea className="textarea textarea-bordered resize-none h-20" value={form.note} onChange={(e) => update("note", e.target.value)} />
                    </div>
                </div>

                <div className="modal-action px-5 pb-5">
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

const TransactionDetailModal = ({ row, onClose }) => {
    if (!row) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide opacity-80">Pharmacy Transaction</p>
                            <h2 className="font-mono text-lg font-bold break-all">{row.referenceNumber}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>
                            <XIcon className="size-4" />
                        </button>
                    </div>
                    <p className="mt-2 text-xs opacity-80">{dayjs(row.date).tz(PH_TZ).format("MMM D, YYYY h:mm A")}</p>
                </div>
                <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Customer</p>
                            <p className="font-semibold">{row.customerName}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Type of Order</p>
                            <p className="font-semibold">{row.source === "manual" ? "Walk-in" : "In-app"}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5 sm:col-span-2">
                            <p className="text-xs opacity-50">Items</p>
                            <div className="font-semibold">
                                {row.items.map((item) => <p key={`${row.id}-${item}`}>{item}</p>)}
                            </div>
                        </div>
                    </div>

                    <div className="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3">
                        <div className="flex justify-between py-1.5">
                            <span className="font-semibold">Total</span>
                            <span className="text-xl font-bold text-primary">{currency(row.totalAmount)}</span>
                        </div>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const PharmacyIncomePage = () => {
    const now = dayjs().tz(PH_TZ);
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);
    const [manualModalOpen, setManualModalOpen] = useState(false);
    const [selectedTransaction, setSelectedTransaction] = useState(null);
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

    const allRows = useMemo(() => [
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
            customerName: transaction.customerName || "Walk-in Customer",
            items: [transaction.itemSummary],
            status: transaction.paymentMethod,
            totalAmount: transaction.amount,
        })),
    ].sort((a, b) => new Date(b.date) - new Date(a.date)), [orders, manualTransactions]);

    const historyRows = useMemo(
        () => allRows.filter((row) => (row.source === "app" && row.status === "completed") || row.source === "manual"),
        [allRows]
    );

    const collectedTotal = allRows.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const inAppTotal = allRows.filter((row) => row.source === "app").reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const manualTotal = allRows.filter((row) => row.source === "manual").reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const completedTotal = historyRows.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
    const averageTransaction = allRows.length ? collectedTotal / allRows.length : 0;

    const dailyIncome = useMemo(() => {
        const grouped = new Map();
        for (const row of allRows) {
            const key = dayjs(row.date).tz(PH_TZ).format("MMM D");
            grouped.set(key, (grouped.get(key) || 0) + (row.totalAmount || 0));
        }
        return [...grouped.entries()]
            .map(([label, amount]) => ({ label, amount }))
            .reverse();
    }, [allRows]);

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
                    <h1 className="text-3xl font-bold">Transactions</h1>
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

                    {tab === "transactions" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <IncomeStatCard label="Completed Sales" value={currency(completedTotal)} description="Completed orders only" />
                                <IncomeStatCard label="Completed Orders" value={historyRows.length} description="Shown in transaction history" />
                                <IncomeStatCard label="Average Completed Sale" value={currency(historyRows.length ? completedTotal / historyRows.length : 0)} description="Completed orders only" />
                            </div>

                            <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_6px_18px_rgba(15,23,42,0.16)]">
                            <div className="card-body gap-3">
                                <h2 className="font-semibold">Transaction History</h2>
                                {historyRows.length === 0 ? (
                                    <div className="text-center py-12 opacity-50">
                                        <ReceiptIcon className="size-10 mx-auto mb-3" />
                                        <p className="font-medium">No pharmacy transactions for this month</p>
                                    </div>
                                ) : (
                                    <div className="overflow-hidden rounded-xl border border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.12)]">
                                        <table className="table table-zebra w-full">
                                            <thead>
                                                <tr>
                                                    <th>Date Time</th>
                                                    <th>Reference ID</th>
                                                    <th>Customer</th>
                                                    <th>Type of Order</th>
                                                    <th>Items</th>
                                                    <th>Total</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {historyRows.map((row) => (
                                                    <tr key={row.id} className="cursor-pointer hover:bg-base-200/80" onClick={() => setSelectedTransaction(row)}>
                                                        <td className="text-xs whitespace-nowrap">
                                                            {dayjs(row.date).tz(PH_TZ).format("MMM D, YYYY")}
                                                            <br />
                                                            <span className="opacity-50">{dayjs(row.date).tz(PH_TZ).format("h:mm A")}</span>
                                                        </td>
                                                        <td className="font-mono text-xs text-primary">{row.referenceNumber}</td>
                                                        <td className="text-sm font-medium">{row.customerName}</td>
                                                        <td>
                                                            <span className="inline-flex rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                                                                {row.source === "manual" ? "Walk-in" : "In-app"}
                                                            </span>
                                                        </td>
                                                        <td className="text-xs">
                                                            {row.items.map((item) => (
                                                                <p key={`${row.id}-${item}`}>{item}</p>
                                                            ))}
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
                        </div>
                    )}

                    {tab === "income" && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <IncomeStatCard label="Product Sales" value={currency(totals.productSales)} description="Before delivery fees" />
                                <IncomeStatCard label="Delivery Fees" value={currency(totals.deliveryFees)} description="Delivery orders only" />
                                <IncomeStatCard label="Platform Fees" value={currency(totals.platformFees)} description="MedConnect cut tracked on orders" />
                                <IncomeStatCard label="Collected Total" value={currency(collectedTotal)} description="In-app + manual" />
                                <IncomeStatCard label="Transactions" value={historyRows.length} description={`${totals.orderCount ?? orders.length} in-app order(s)`} />
                                <IncomeStatCard label="Average Sale" value={currency(averageTransaction)} description="Across listed transactions" />
                            </div>

                            <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                                <div className="card-body">
                                    <h2 className="font-semibold">Daily Income</h2>
                                    {dailyIncome.length === 0 ? (
                                        <div className="text-center py-12 opacity-50">
                                            <BarChart3Icon className="size-10 mx-auto mb-3" />
                                            <p className="font-medium">No income to chart</p>
                                        </div>
                                    ) : (
                                        <div className="h-72 grid items-end gap-4 border-b border-base-300 pt-6" style={{ gridTemplateColumns: `repeat(${dailyIncome.length}, minmax(64px, 1fr))` }}>
                                            {dailyIncome.map((day) => {
                                                const height = maxDailyAmount ? Math.max(8, (day.amount / maxDailyAmount) * 100) : 0;
                                                return (
                                                    <div key={day.label} className="h-full flex flex-col items-center justify-end gap-2">
                                                        <div className="text-xs font-medium">{currency(day.amount)}</div>
                                                        <div
                                                            className="w-full max-w-24 rounded-t-lg bg-primary shadow-[0_0_0_1px_rgba(47,112,186,0.18),0_8px_18px_rgba(47,112,186,0.28)] transition-all"
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
            <TransactionDetailModal row={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
        </div>
    );
};

export default PharmacyIncomePage;
