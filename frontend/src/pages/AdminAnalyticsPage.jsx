import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { axiosInstance } from "../lib/axios";
import dayjs from "dayjs";

// ── helpers ────────────────────────────────────────────────────────────────

const fmtPHP = (amount) =>
    `₱${Number(amount ?? 0).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPct = (val) => `${Number(val ?? 0).toFixed(2)}%`;

const defaultFrom = () => dayjs().subtract(29, "day").format("YYYY-MM-DD");
const defaultTo = () => dayjs().format("YYYY-MM-DD");

// Build and trigger a browser download of a text blob
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

// Convert an array of objects to CSV string
const toCSV = (rows, columns) => {
    const header = columns.map((c) => c.label).join(",");
    const body = rows
        .map((row) =>
            columns
                .map((c) => {
                    const val = c.value(row);
                    // Wrap in quotes if the value contains commas or quotes
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

// ── sub-components ─────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub }) => (
    <div className="card bg-base-200 border border-base-300 rounded-xl p-5 flex flex-col gap-1">
        <p className="text-xs opacity-50 uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold">{value}</p>
        {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
);

const SectionTitle = ({ children }) => (
    <h2 className="text-base font-semibold mt-6 mb-2">{children}</h2>
);

const TableEmpty = ({ label }) => (
    <p className="text-sm opacity-50 py-4 text-center">No {label} data.</p>
);

// ── main component ─────────────────────────────────────────────────────────

const AdminAnalyticsPage = () => {
    const [from, setFrom] = useState(defaultFrom());
    const [to, setTo] = useState(defaultTo());

    const { data, isLoading, isError, refetch } = useQuery({
        queryKey: ["adminAnalytics", from, to],
        queryFn: async () => {
            const res = await axiosInstance.get(`/admin/analytics?from=${from}&to=${to}`);
            return res.data.data;
        },
        staleTime: 60_000,
    });

    // ── export handlers ────────────────────────────────────────────────────

    const buildExportContent = () => {
        if (!data) return "";
        const summaryRows = [
            { label: "Total Revenue", value: data.totalRevenue ?? 0 },
            { label: "Platform Revenue", value: data.platformRevenue ?? 0 },
            { label: "Total Appointments", value: data.appointmentVolume?.total ?? 0 },
            { label: "Cancellation Rate (%)", value: data.cancellationRate ?? 0 },
            { label: "Dispute Rate (%)", value: data.disputeRate ?? 0 },
        ];
        const sections = [];
        sections.push("SUMMARY");
        sections.push(toCSV(summaryRows, [
            { label: "Metric", value: (r) => r.label },
            { label: "Value", value: (r) => r.value },
        ]));
        sections.push("\nREVENUE BY DAY");
        sections.push(toCSV(data.revenueByDay ?? [], [
            { label: "Date", value: (r) => r.date },
            { label: "Total Revenue (PHP)", value: (r) => r.revenue },
            { label: "Platform Revenue (PHP)", value: (r) => r.platformRevenue },
        ]));
        sections.push("\nTOP DOCTORS BY REVENUE");
        sections.push(toCSV(data.revenueByDoctor ?? [], [
            { label: "Name", value: (r) => r.name },
            { label: "Appointments", value: (r) => r.appointmentCount },
            { label: "Total Revenue (PHP)", value: (r) => r.totalRevenue },
        ]));
        sections.push("\nTOP PROVIDERS BY VOLUME");
        sections.push(toCSV(data.topProviders ?? [], [
            { label: "Name", value: (r) => r.name },
            { label: "Role", value: (r) => r.role },
            { label: "Appointments", value: (r) => r.appointmentCount },
            { label: "Total Revenue (PHP)", value: (r) => r.totalRevenue },
        ]));
        return sections.join("\n");
    };

    const exportCSV = () => {
        if (!data) return;
        triggerDownload(
            buildExportContent(),
            `medconnect-analytics-${from}-to-${to}.csv`,
            "text/csv"
        );
    };

    // xlsx package not installed — exports CSV-formatted content as .xlsx, which Excel opens correctly.
    // Install the xlsx npm package and replace this with a proper workbook if native .xlsx is needed.
    const exportExcel = () => {
        if (!data) return;
        triggerDownload(
            buildExportContent(),
            `medconnect-analytics-${from}-to-${to}.xlsx`,
            "text/csv"
        );
    };

    // ── render ─────────────────────────────────────────────────────────────

    const vol = data?.appointmentVolume ?? {};

    return (
        <div className="p-4 sm:p-8 max-w-5xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold">Analytics</h1>
                    <p className="text-sm opacity-60 mt-0.5">Platform revenue and appointment insights</p>
                </div>
                <div className="flex gap-2">
                    <button
                        className="btn btn-sm btn-outline gap-1"
                        onClick={exportCSV}
                        disabled={!data}
                    >
                        Export CSV
                    </button>
                    <button
                        className="btn btn-sm btn-outline gap-1"
                        onClick={exportExcel}
                        disabled={!data}
                    >
                        Export Excel
                    </button>
                </div>
            </div>

            {/* Date range filter */}
            <div className="card bg-base-200 border border-base-300 rounded-xl p-4">
                <p className="text-xs font-semibold opacity-50 uppercase tracking-wide mb-3">Date Range</p>
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
                    <button
                        className="btn btn-primary btn-sm"
                        onClick={() => refetch()}
                        disabled={isLoading}
                    >
                        {isLoading ? <span className="loading loading-spinner loading-xs" /> : "Apply"}
                    </button>
                </div>
            </div>

            {/* Loading / error states */}
            {isLoading && (
                <div className="flex justify-center py-12">
                    <span className="loading loading-spinner loading-lg text-primary" />
                </div>
            )}

            {isError && !isLoading && (
                <div className="alert alert-error text-sm">Failed to load analytics. Try again.</div>
            )}

            {/* Content */}
            {data && !isLoading && (
                <>
                    {/* Summary stat cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                        <StatCard
                            label="Total Revenue"
                            value={fmtPHP(data.totalRevenue)}
                            sub="All transactions"
                        />
                        <StatCard
                            label="Platform Revenue"
                            value={fmtPHP(data.platformRevenue)}
                            sub="Platform fees (10%)"
                        />
                        <StatCard
                            label="Total Appointments"
                            value={vol.total?.toLocaleString() ?? "0"}
                            sub="All time"
                        />
                        <StatCard
                            label="Cancellation Rate"
                            value={fmtPct(data.cancellationRate)}
                            sub={`${vol.cancelled ?? 0} cancelled`}
                        />
                        <StatCard
                            label="Dispute Rate"
                            value={fmtPct(data.disputeRate)}
                            sub={`${(vol.disputed ?? 0) + (vol.resolved ?? 0)} disputes`}
                        />
                    </div>

                    {/* Appointment volume breakdown */}
                    <div>
                        <SectionTitle>Appointment Volume Breakdown</SectionTitle>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {[
                                { label: "Accepted", val: vol.accepted, cls: "badge-info" },
                                { label: "Completed", val: vol.completed, cls: "badge-success" },
                                { label: "Fully Paid", val: vol.fullyPaid, cls: "badge-success" },
                                { label: "Cancelled", val: vol.cancelled, cls: "badge-warning" },
                                { label: "Rejected", val: vol.rejected, cls: "badge-error" },
                                { label: "Disputed", val: vol.disputed, cls: "badge-error" },
                                { label: "Resolved", val: vol.resolved, cls: "badge-ghost" },
                            ].map(({ label, val, cls }) => (
                                <div
                                    key={label}
                                    className="flex items-center justify-between p-3 bg-base-200 border border-base-300 rounded-lg"
                                >
                                    <span className="text-sm">{label}</span>
                                    <span className={`badge badge-sm ${cls}`}>{val ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Revenue by day */}
                    <div>
                        <SectionTitle>Revenue by Day ({from} to {to})</SectionTitle>
                        {data.revenueByDay.length === 0 ? (
                            <TableEmpty label="daily revenue" />
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-base-300">
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
                                                <td className="text-right text-sm opacity-70">{fmtPHP(row.platformRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="bg-base-200 font-semibold">
                                            <td>Total</td>
                                            <td className="text-right">
                                                {fmtPHP(data.revenueByDay.reduce((a, r) => a + r.revenue, 0))}
                                            </td>
                                            <td className="text-right opacity-70">
                                                {fmtPHP(data.revenueByDay.reduce((a, r) => a + r.platformRevenue, 0))}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Top doctors by revenue */}
                    <div>
                        <SectionTitle>Top Doctors by Revenue (All Time, Top 20)</SectionTitle>
                        {data.revenueByDoctor.length === 0 ? (
                            <TableEmpty label="doctor revenue" />
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-base-300">
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

                    {/* Top providers by volume */}
                    <div>
                        <SectionTitle>Top Providers by Volume (All Time, Top 10)</SectionTitle>
                        {data.topProviders.length === 0 ? (
                            <TableEmpty label="provider volume" />
                        ) : (
                            <div className="overflow-x-auto rounded-xl border border-base-300">
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
                                                <td>
                                                    <span className="badge badge-xs badge-info capitalize">{row.role}</span>
                                                </td>
                                                <td className="text-right text-sm">{row.appointmentCount}</td>
                                                <td className="text-right text-sm">{fmtPHP(row.totalRevenue)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default AdminAnalyticsPage;
