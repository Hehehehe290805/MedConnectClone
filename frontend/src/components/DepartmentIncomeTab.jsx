import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3Icon, DownloadIcon, PlusIcon, ReceiptIcon, RefreshCwIcon, XIcon } from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { createDepartmentManualTransaction, getDepartmentIncome } from "../lib/api";
import { axiosInstance } from "../lib/axios";

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

const ManualTransactionModal = ({ onClose }) => {
    const queryClient = useQueryClient();
    const { data: servicesData, isLoading: servicesLoading } = useQuery({
        queryKey: ["department-services"],
        queryFn: () => axiosInstance.get("/services/my-services").then(r => r.data),
    });
    // Filter to only verified services
    const services = (servicesData?.data?.services ?? []).filter(c => c.status === "verified").map(c => c.serviceId);

    const [form, setForm] = useState({
        transactionDate: dayjs().tz(PH_TZ).format("YYYY-MM-DDTHH:mm"),
        serviceId: "",
        quantity: 1,
        unitPrice: "",
        itemSummary: "",
        amount: "",
        paymentMethod: "cash",
        note: "",
    });

    const selectedService = services.find((service) => service._id === form.serviceId);

    const mutation = useMutation({
        mutationFn: () => createDepartmentManualTransaction({
            transactionDate: form.transactionDate,
            customerName: "Walk-in Patient",
            itemSummary: form.itemSummary,
            amount: Number(form.amount),
            paymentMethod: form.paymentMethod,
            note: form.note,
        }),
        onSuccess: () => {
            toast.success("Manual transaction added");
            queryClient.invalidateQueries({ queryKey: ["department-income"] });
            onClose();
        },
        onError: (error) => toast.error(error?.response?.data?.message || "Could not add transaction"),
    });

    const update = (field, value) => setForm((current) => {
        const next = { ...current, [field]: value };
        const service = field === "serviceId"
            ? services.find((item) => item._id === value)
            : selectedService;
        if (field === "serviceId" && service) {
            const quantity = Number(next.quantity) || 1;
            // Since departments don't have strict pricing per service in the DB linked here (pricing usually tied to appointments), 
            // the user inputs the price manually or it could be predefined. We'll leave it empty for manual input if not available.
            next.itemSummary = `${service.name} x${quantity}`;
        }
        if ((field === "quantity" || field === "unitPrice")) {
            const quantity = Math.max(1, Number(next.quantity) || 1);
            const price = Number(next.unitPrice) || 0;
            next.quantity = quantity;
            next.amount = String(price * quantity);
            if (service) {
                next.itemSummary = `${service.name} x${quantity}`;
            } else {
                next.itemSummary = `Service x${quantity}`;
            }
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
                            <p className="text-sm opacity-80">Use this to record walk-in services and payments.</p>
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
                            <label className="label"><span className="label-text">Service</span></label>
                            <select className="select select-bordered" value={form.serviceId} onChange={(e) => update("serviceId", e.target.value)} disabled={servicesLoading}>
                                <option value="">{servicesLoading ? "Loading services..." : "Select service..."}</option>
                                {services.map((service) => (
                                    <option key={service._id} value={service._id}>{service.name}</option>
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

const DepartmentIncomeTab = () => {
    const now = dayjs().tz(PH_TZ);
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);
    const [manualModalOpen, setManualModalOpen] = useState(false);

    const { data, isLoading, isFetching, refetch } = useQuery({
        queryKey: ["department-income", year, month],
        queryFn: () => getDepartmentIncome({ year, month }),
    });

    const payload = data?.data ?? {};
    const totals = payload.totals ?? {};
    const transactions = payload.transactions ?? [];
    const manualTransactions = payload.manualTransactions ?? [];
    const years = payload.years?.length ? payload.years : [now.year()];

    const allRows = useMemo(() => [
        ...transactions.map((t) => ({
            id: t._id,
            source: "app",
            date: t.createdAt,
            referenceNumber: t.referenceNumber,
            customerName: t.payerId?.firstName ? `${t.payerId.firstName} ${t.payerId.lastName}` : "Patient",
            items: [`Service (Appt: ${t.appointmentId?._id?.toString().slice(-6)})`],
            status: t.type,
            totalAmount: t.amount,
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
    ].sort((a, b) => new Date(b.date) - new Date(a.date)), [transactions, manualTransactions]);

    const collectedTotal = allRows.reduce((sum, row) => sum + (row.totalAmount || 0), 0);
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
        const rows = allRows.map((row) => [
            dayjs(row.date).tz(PH_TZ).format("YYYY-MM-DD HH:mm"),
            row.source,
            row.referenceNumber,
            row.customerName,
            row.status,
            row.items.join("; "),
            row.totalAmount ?? 0,
        ]);
        return [header, ...rows];
    }, [allRows]);

    const downloadCsv = () => {
        const csv = csvRows
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `department-transactions-${year}-${String(month).padStart(2, "0")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-6 mt-6">
            <div className="flex flex-col sm:flex-row gap-2 justify-end">
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
                <button className="btn btn-primary btn-sm gap-2" onClick={downloadCsv} disabled={allRows.length === 0}>
                    <DownloadIcon className="size-4" />
                    Export
                </button>
                <button className="btn btn-primary btn-sm gap-2" onClick={() => setManualModalOpen(true)}>
                    <PlusIcon className="size-4" />
                    Manual Transaction
                </button>
            </div>

            {isLoading ? (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <IncomeStatCard label="Service Sales" value={currency(totals.productSales)} description="Before platform fees" />
                        <IncomeStatCard label="Platform Fees" value={currency(totals.platformFees)} description="10% deduction on in-app appts" />
                        <IncomeStatCard label="Collected Total" value={currency(totals.collectedTotal)} description="In-app net + manual cash" />
                        <IncomeStatCard label="Transactions" value={allRows.length} description={`${totals.orderCount ?? transactions.length} in-app order(s)`} />
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
                </>
            )}

            {manualModalOpen && <ManualTransactionModal onClose={() => setManualModalOpen(false)} />}
        </div>
    );
};

export default DepartmentIncomeTab;
