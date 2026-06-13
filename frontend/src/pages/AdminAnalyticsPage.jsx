import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";

const fmtPHP = (amount) =>
    `PHP ${Number(amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (val) => `${Number(val ?? 0).toFixed(2)}%`;

const defaultFrom = () => dayjs().subtract(29, "day").format("YYYY-MM-DD");
const defaultTo = () => dayjs().format("YYYY-MM-DD");

const quickRanges = [
    { label: "Today", getRange: () => ({ from: dayjs().format("YYYY-MM-DD"), to: defaultTo() }) },
    { label: "Last 7 Days", getRange: () => ({ from: dayjs().subtract(6, "day").format("YYYY-MM-DD"), to: defaultTo() }) },
    { label: "Last 3 Months", getRange: () => ({ from: dayjs().subtract(3, "month").format("YYYY-MM-DD"), to: defaultTo() }) },
];

const tabs = [
    { key: "overview", label: "Overview" },
    { key: "transactions", label: "Platform Fee Transactions" },
    { key: "revenue", label: "Revenue" },
    { key: "users", label: "User Analytics" },
];

const triggerDownload = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

const toCSV = (rows, columns) => {
    const header = columns.map((c) => c.label).join(",");
    const body = rows
        .map((row) =>
            columns
                .map((c) => {
                    const val = c.value(row);
                    const str = String(val ?? "");
                    return str.includes(",") || str.includes('"') || str.includes("\n")
                        ? `"${str.replace(/"/g, '""')}"`
                        : str;
                })
                .join(",")
        )
        .join("\n");
    return `${header}\n${body}`;
};

const StatCard = ({ label, value, sub }) => (
    <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_28px_rgba(15,23,42,0.22)]">
        <div className="card-body gap-2">
            <p className="text-xs opacity-50 uppercase tracking-wide">{label}</p>
            <p className="text-3xl font-bold">{value}</p>
            {sub && <p className="text-sm opacity-60">{sub}</p>}
        </div>
    </div>
);

const SectionTitle = ({ children, shaded = false }) => (
    <h2 className={`text-base font-semibold mb-3 ${shaded ? "rounded-lg bg-slate-200 px-4 py-3 border border-base-300" : ""}`}>
        {children}
    </h2>
);

const TableEmpty = ({ label }) => (
    <p className="text-sm opacity-50 py-4 text-center">No {label} data.</p>
);

const DateRangeFilter = ({ from, to, setFrom, setTo, applyQuickRange, refetch, isLoading }) => (
    <div className="card bg-slate-200 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_8px_22px_rgba(15,23,42,0.18)]">
        <div className="card-body gap-4">
            <p className="text-xs font-semibold opacity-50 uppercase tracking-wide">Date Range</p>
            <div className="flex flex-wrap gap-2">
                {quickRanges.map((range) => (
                    <button
                        key={range.label}
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => applyQuickRange(range.getRange)}
                    >
                        {range.label}
                    </button>
                ))}
            </div>
            <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-60">From</label>
                    <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={from}
                        max={to}
                        onChange={(e) => setFrom(e.target.value)}
                    />
                </div>
                <div className="flex flex-col gap-1">
                    <label className="text-xs opacity-60">To</label>
                    <input
                        type="date"
                        className="input input-bordered input-sm"
                        value={to}
                        min={from}
                        max={defaultTo()}
                        onChange={(e) => setTo(e.target.value)}
                    />
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => refetch()} disabled={isLoading}>
                    {isLoading ? <span className="loading loading-spinner loading-xs" /> : "Apply"}
                </button>
            </div>
        </div>
    </div>
);

const PlatformFeeRow = ({ row, onClick }) => (
    <button
        type="button"
        className="w-full border-t border-base-300 px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-base-200/70"
        onClick={() => onClick(row)}
    >
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.15fr_minmax(180px,2fr)_0.8fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 lg:items-center">
            <div className="min-w-0">
                <p className="font-mono text-xs text-primary truncate" title={row.referenceNumber || row.orderId}>
                    {row.referenceNumber || row.orderId}
                </p>
                <p className="text-xs font-mono opacity-50">{dayjs(row.paidAt).format("YYYY-MM-DD HH:mm")}</p>
            </div>
            <p className="text-sm font-medium truncate" title={row.customerName}>{row.customerName}</p>
            <p className="text-sm font-medium truncate" title={row.summary}>{row.summary}</p>
            <p className="text-sm capitalize truncate">{row.source}</p>
            <p className="text-sm font-medium truncate" title={row.providerName}>{row.providerName}</p>
            <p className="text-sm font-semibold lg:text-right whitespace-nowrap">{fmtPHP(row.amountPaid)}</p>
            <p className="text-sm font-semibold lg:text-right whitespace-nowrap">{fmtPHP(row.deliveryFee)}</p>
            <p className="text-sm font-bold text-primary lg:text-right whitespace-nowrap">{fmtPHP(row.platformFee)}</p>
        </div>
    </button>
);

const PlatformFeeDetailModal = ({ row, onClose }) => {
    if (!row) return null;

    return (
        <div className="modal modal-open">
            <div className="modal-box max-w-lg p-0 overflow-hidden">
                <div className="bg-primary text-primary-content px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                            <p className="text-xs uppercase tracking-wide opacity-80">Reference ID</p>
                            <h2 className="font-mono text-lg font-bold break-all">{row.referenceNumber || row.orderId}</h2>
                        </div>
                        <button className="btn btn-ghost btn-sm btn-circle text-primary-content" onClick={onClose}>x</button>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs opacity-80">
                        <span>{dayjs(row.paidAt).format("YYYY-MM-DD HH:mm")}</span>
                        <span className="capitalize">{row.source}</span>
                    </div>
                </div>

                <div className="p-5 space-y-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-wide opacity-50">Order Summary</p>
                        <p className="mt-1 text-base font-semibold">{row.summary}</p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-sm">
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Customer</p>
                            <p className="font-semibold">{row.customerName}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Provider</p>
                            <p className="font-semibold">{row.providerName}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Source</p>
                            <p className="font-semibold capitalize">{row.source}</p>
                        </div>
                        <div className="rounded-lg border border-base-300 bg-base-100 p-2.5">
                            <p className="text-xs opacity-50">Order / Transaction ID</p>
                            <p className="font-mono text-xs break-all">{row.orderId}</p>
                        </div>
                    </div>

                    <div className="rounded-xl border-2 border-dashed border-base-300 bg-base-100 p-3">
                        <div className="flex justify-between gap-4 py-1.5 text-sm">
                            <span className="opacity-60">Total paid</span>
                            <span className="font-semibold">{fmtPHP(row.amountPaid)}</span>
                        </div>
                        <div className="flex justify-between gap-4 py-1.5 text-sm">
                            <span className="opacity-60">Delivery fee</span>
                            <span className="font-semibold">{fmtPHP(row.deliveryFee)}</span>
                        </div>
                        <div className="divider my-1" />
                        <div className="flex justify-between gap-4 py-1.5">
                            <span className="font-semibold">MedConnect platform fee</span>
                            <span className="text-xl font-bold text-primary">{fmtPHP(row.platformFee)}</span>
                        </div>
                    </div>

                    <div className="modal-action">
                        <button className="btn btn-primary" onClick={onClose}>Close</button>
                    </div>
                </div>
            </div>
            <div className="modal-backdrop" onClick={onClose} />
        </div>
    );
};

const AdminAnalyticsPage = () => {
    const [activeTab, setActiveTab] = useState("overview");
    const [from, setFrom] = useState(defaultFrom());
    const [to, setTo] = useState(defaultTo());
    const [selectedPlatformTransaction, setSelectedPlatformTransaction] = useState(null);

    const applyQuickRange = (getRange) => {
        const range = getRange();
        setFrom(range.from);
        setTo(range.to);
    };

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["adminAnalytics", from, to],
        queryFn: async () => {
            const res = await axiosInstance.get(`/admin/analytics?from=${from}&to=${to}`);
            return res.data.data;
        },
        staleTime: 60_000,
    });

    const buildExportContent = () => {
        if (!data) return "";
        const summaryRows = [
            { label: "Total Sales", value: data.totalRevenue ?? 0 },
            { label: "Total MedConnect Sales", value: data.platformRevenue ?? 0 },
            { label: "Appointment Platform Fees", value: data.salesBreakdown?.appointmentPlatformFees ?? 0 },
            { label: "Pharmacy Cut", value: data.salesBreakdown?.pharmacyPlatformFees ?? 0 },
            { label: "Pharmacy Delivery Fees", value: data.salesBreakdown?.pharmacyDeliveryFees ?? 0 },
            { label: "Pharmacy Sales", value: data.salesBreakdown?.pharmacyRevenue ?? 0 },
        ];
        const sections = [];
        sections.push("SUMMARY");
        sections.push(toCSV(summaryRows, [
            { label: "Metric", value: (r) => r.label },
            { label: "Value", value: (r) => r.value },
        ]));
        sections.push("\nPLATFORM FEE TRANSACTIONS");
        sections.push(toCSV(data.platformFeeTransactions ?? [], [
            { label: "Date", value: (r) => dayjs(r.paidAt).format("YYYY-MM-DD HH:mm") },
            { label: "Source", value: (r) => r.source },
            { label: "Order/Transaction ID", value: (r) => r.orderId },
            { label: "Reference", value: (r) => r.referenceNumber },
            { label: "Customer", value: (r) => r.customerName },
            { label: "Provider", value: (r) => r.providerName },
            { label: "Summary", value: (r) => r.summary },
            { label: "Total Paid (PHP)", value: (r) => r.amountPaid },
            { label: "Platform Fee (PHP)", value: (r) => r.platformFee },
            { label: "Delivery Fee (PHP)", value: (r) => r.deliveryFee },
        ]));
        sections.push("\nREVENUE BY DAY");
        sections.push(toCSV(data.revenueByDay ?? [], [
            { label: "Date", value: (r) => r.date },
            { label: "Total Revenue (PHP)", value: (r) => r.revenue },
            { label: "Platform Revenue (PHP)", value: (r) => r.platformRevenue },
        ]));
        return sections.join("\n");
    };

    const exportCSV = () => {
        if (!data) return;
        triggerDownload(buildExportContent(), `medconnect-analytics-${from}-to-${to}.csv`, "text/csv");
    };

    const exportExcel = () => {
        if (!data) return;
        triggerDownload(buildExportContent(), `medconnect-analytics-${from}-to-${to}.xlsx`, "text/csv");
    };

    const vol = data?.appointmentVolume ?? {};
    const platformTransactions = data?.platformFeeTransactions ?? [];

    return (
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Analytics</h1>
                    <p className="text-sm opacity-60 mt-0.5">MedConnect sales, fee transactions, revenue, and provider activity</p>
                </div>
                <div className="flex gap-2">
                    <button className="btn btn-sm btn-outline gap-1" onClick={exportCSV} disabled={!data}>
                        Export CSV
                    </button>
                    <button className="btn btn-sm btn-outline gap-1" onClick={exportExcel} disabled={!data}>
                        Export Excel
                    </button>
                </div>
            </div>

            <div className="tabs tabs-boxed bg-base-200 w-fit">
                {tabs.map((tab) => (
                    <button
                        key={tab.key}
                        className={`tab ${activeTab === tab.key ? "tab-active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {isLoading && (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            )}

            {isError && !isLoading && (
                <div className="alert alert-error text-sm">Failed to load analytics. Try again.</div>
            )}

            {data && !isLoading && (
                <>
                    {activeTab === "overview" && (
                        <div className="space-y-5">
                            <div className="card bg-primary text-primary-content shadow-[0_0_0_1px_rgba(15,23,42,0.12),0_14px_36px_rgba(15,23,42,0.30)]">
                                <div className="card-body gap-2">
                                    <p className="text-xs uppercase tracking-wide opacity-70">Total MedConnect Sales</p>
                                    <p className="text-5xl font-bold">{fmtPHP(data.platformRevenue)}</p>
                                    <p className="text-sm opacity-80">
                                        Appointment platform fees, pharmacy cuts, delivery fees, and other platform-owned sales.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <StatCard label="Total Sales" value={fmtPHP(data.totalRevenue)} sub="Gross sales across appointments and pharmacy orders" />
                                <StatCard label="Appointment Fees" value={fmtPHP(data.salesBreakdown?.appointmentPlatformFees)} sub="Platform fees from appointment transactions" />
                                <StatCard label="Pharmacy Cut" value={fmtPHP(data.salesBreakdown?.pharmacyPlatformFees)} sub={`${data.salesBreakdown?.pharmacyOrderCount ?? 0} pharmacy order(s)`} />
                                <StatCard label="Delivery Fees" value={fmtPHP(data.salesBreakdown?.pharmacyDeliveryFees)} sub="Delivery income from pharmacy orders" />
                                <StatCard label="Pharmacy Sales" value={fmtPHP(data.salesBreakdown?.pharmacyRevenue)} sub="Complete pharmacy order sales" />
                                <StatCard label="Total Appointments" value={vol.total?.toLocaleString() ?? "0"} sub="All appointment statuses" />
                            </div>
                        </div>
                    )}

                    {activeTab === "transactions" && (
                        <div className="space-y-5">
                            <DateRangeFilter
                                from={from}
                                to={to}
                                setFrom={setFrom}
                                setTo={setTo}
                                applyQuickRange={applyQuickRange}
                                refetch={refetch}
                                isLoading={isLoading}
                            />
                            <div>
                                <SectionTitle>Platform Fee Transactions</SectionTitle>
                                {platformTransactions.length === 0 ? (
                                    <TableEmpty label="platform fee transaction" />
                                ) : (
                                    <div className="overflow-hidden rounded-xl border-2 border-base-300 bg-base-100 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_8px_22px_rgba(15,23,42,0.16)]">
                                        <div className="hidden lg:grid grid-cols-[1fr_1.15fr_minmax(180px,2fr)_0.8fr_1fr_0.8fr_0.8fr_0.8fr] gap-3 bg-base-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide opacity-60">
                                            <span>Reference</span>
                                            <span>Customer</span>
                                            <span>Summary</span>
                                            <span>Source</span>
                                            <span>Provider</span>
                                            <span className="text-right">Total</span>
                                            <span className="text-right">Delivery</span>
                                            <span className="text-right">Platform</span>
                                        </div>
                                        {platformTransactions.map((row) => (
                                            <PlatformFeeRow key={`${row.source}-${row.id}`} row={row} onClick={setSelectedPlatformTransaction} />
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "revenue" && (
                        <div className="space-y-5">
                            <DateRangeFilter
                                from={from}
                                to={to}
                                setFrom={setFrom}
                                setTo={setTo}
                                applyQuickRange={applyQuickRange}
                                refetch={refetch}
                                isLoading={isLoading}
                            />
                            <div>
                                <SectionTitle>Revenue by Day ({from} to {to})</SectionTitle>
                                {data.revenueByDay.length === 0 ? (
                                    <TableEmpty label="daily revenue" />
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.08),0_8px_22px_rgba(15,23,42,0.14)]">
                                        <table className="table table-sm w-full">
                                            <thead>
                                                <tr className="bg-base-200">
                                                    <th>Date</th>
                                                    <th className="text-right">Total Revenue</th>
                                                    <th className="text-right">Platform Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.revenueByDay.map((row) => (
                                                    <tr key={row.date} className="hover:bg-base-100">
                                                        <td className="font-mono text-sm">{row.date}</td>
                                                        <td className="text-right text-sm">{fmtPHP(row.revenue)}</td>
                                                        <td className="text-right text-sm">{fmtPHP(row.platformRevenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                            <tfoot>
                                                <tr className="bg-base-200 font-semibold">
                                                    <td>Total</td>
                                                    <td className="text-right">{fmtPHP(data.revenueByDay.reduce((a, r) => a + r.revenue, 0))}</td>
                                                    <td className="text-right">{fmtPHP(data.revenueByDay.reduce((a, r) => a + r.platformRevenue, 0))}</td>
                                                </tr>
                                            </tfoot>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {activeTab === "users" && (
                        <div className="space-y-6">
                            <div className="rounded-xl border-2 border-base-300 bg-base-100 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
                                <SectionTitle shaded>Appointment Volume Breakdown</SectionTitle>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                    {[
                                        { label: "Accepted", val: vol.accepted },
                                        { label: "Completed", val: vol.completed },
                                        { label: "Fully Paid", val: vol.fullyPaid },
                                        { label: "Cancelled", val: vol.cancelled },
                                        { label: "Rejected", val: vol.rejected },
                                        { label: "Disputed", val: vol.disputed },
                                        { label: "Resolved", val: vol.resolved },
                                    ].map(({ label, val }) => (
                                        <div key={label} className="flex items-center justify-between p-3 bg-base-100 border border-base-300 rounded-lg shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.12)]">
                                            <span className="text-sm">{label}</span>
                                            <span className="text-sm font-semibold">{val ?? 0}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="rounded-xl border-2 border-base-300 bg-base-100 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
                                <SectionTitle shaded>Top Doctors by Revenue (All Time, Top 20)</SectionTitle>
                                {data.revenueByDoctor.length === 0 ? (
                                    <TableEmpty label="doctor revenue" />
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.12)]">
                                        <table className="table table-sm w-full">
                                            <thead>
                                                <tr className="bg-base-200">
                                                    <th>#</th>
                                                    <th>Doctor</th>
                                                    <th className="text-right">Appointments</th>
                                                    <th className="text-right">Total Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.revenueByDoctor.map((row, idx) => (
                                                    <tr key={row.doctorId} className="hover:bg-base-100">
                                                        <td className="text-sm opacity-50">{idx + 1}</td>
                                                        <td className="text-sm font-medium">{row.name}</td>
                                                        <td className="text-right text-sm">{row.appointmentCount}</td>
                                                        <td className="text-right text-sm">{fmtPHP(row.totalRevenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-xl border-2 border-base-300 bg-base-100 p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_26px_rgba(15,23,42,0.20)]">
                                <SectionTitle shaded>Top Providers by Volume (All Time, Top 10)</SectionTitle>
                                {data.topProviders.length === 0 ? (
                                    <TableEmpty label="provider volume" />
                                ) : (
                                    <div className="overflow-x-auto rounded-xl border border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.12)]">
                                        <table className="table table-sm w-full">
                                            <thead>
                                                <tr className="bg-base-200">
                                                    <th>#</th>
                                                    <th>Provider</th>
                                                    <th>Role</th>
                                                    <th className="text-right">Appointments</th>
                                                    <th className="text-right">Total Revenue</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.topProviders.map((row, idx) => (
                                                    <tr key={row.providerId} className="hover:bg-base-100">
                                                        <td className="text-sm opacity-50">{idx + 1}</td>
                                                        <td className="text-sm font-medium">{row.name}</td>
                                                        <td className="text-sm capitalize">{row.role}</td>
                                                        <td className="text-right text-sm">{row.appointmentCount}</td>
                                                        <td className="text-right text-sm">{fmtPHP(row.totalRevenue)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}
            <PlatformFeeDetailModal
                row={selectedPlatformTransaction}
                onClose={() => setSelectedPlatformTransaction(null)}
            />
        </div>
    );
};

export default AdminAnalyticsPage;
