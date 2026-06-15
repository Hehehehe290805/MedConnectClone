import { useMemo, useState } from "react";
import { BarChart3Icon, DownloadIcon } from "lucide-react";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import useAuthUser from "../hooks/useAuthUser";

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

const DoctorAnalyticsTab = ({ transactions }) => {
    const { authUser } = useAuthUser();
    const now = dayjs().tz(PH_TZ);
    const [year, setYear] = useState(now.year());
    const [month, setMonth] = useState(now.month() + 1);

    const currentUserId = authUser?._id?.toString();

    // Extract all unique years from transactions for the year dropdown
    const years = useMemo(() => {
        const uniqueYears = new Set(transactions.map(t => dayjs(t.createdAt).tz(PH_TZ).year()));
        if (!uniqueYears.has(now.year())) uniqueYears.add(now.year());
        return Array.from(uniqueYears).sort((a, b) => b - a);
    }, [transactions, now]);

    // Filter transactions by selected year and month
    const filteredTransactions = useMemo(() => {
        return transactions.filter(t => {
            const date = dayjs(t.createdAt).tz(PH_TZ);
            return date.year() === year && date.month() + 1 === month;
        });
    }, [transactions, year, month]);

    // Calculate stats
    const stats = useMemo(() => {
        let totalReceived = 0;
        let platformFees = 0;
        let refundsPaid = 0;
        let appointmentIncome = 0;

        filteredTransactions.forEach(t => {
            const payeeId = (t.payeeId?._id ?? t.payeeId)?.toString();
            const payerId = (t.payerId?._id ?? t.payerId)?.toString();

            if (payeeId === currentUserId) {
                totalReceived += (t.netAmount ?? 0);
                appointmentIncome += (t.amount ?? 0);
                platformFees += (t.platformFee ?? 0);
            } else if (["cashback", "refund"].includes(t.type) && payerId === currentUserId) {
                totalReceived -= (t.amount ?? 0);
                refundsPaid += (t.amount ?? 0);
            }
        });

        const completedAppointments = filteredTransactions.filter(t => t.type === 'balance' || t.type === 'deposit').length;
        const averageIncome = completedAppointments > 0 ? totalReceived / completedAppointments : 0;

        return {
            totalReceived,
            platformFees,
            refundsPaid,
            appointmentIncome,
            completedAppointments,
            averageIncome
        };
    }, [filteredTransactions, currentUserId]);

    // Daily Income Chart Data
    const dailyIncome = useMemo(() => {
        const grouped = new Map();
        for (const t of filteredTransactions) {
            const payeeId = (t.payeeId?._id ?? t.payeeId)?.toString();
            const payerId = (t.payerId?._id ?? t.payerId)?.toString();
            
            let amount = 0;
            if (payeeId === currentUserId) amount = (t.netAmount ?? 0);
            else if (["cashback", "refund"].includes(t.type) && payerId === currentUserId) amount = -(t.amount ?? 0);

            if (amount !== 0) {
                const key = dayjs(t.createdAt).tz(PH_TZ).format("MMM D");
                grouped.set(key, (grouped.get(key) || 0) + amount);
            }
        }
        
        // Ensure non-negative daily income for visual purposes, though deductions might make it negative
        return [...grouped.entries()]
            .map(([label, amount]) => ({ label, amount }))
            .reverse();
    }, [filteredTransactions, currentUserId]);

    const maxDailyAmount = dailyIncome.reduce((max, day) => Math.max(max, day.amount), 0);
    const minDailyAmount = dailyIncome.reduce((min, day) => Math.min(min, day.amount), 0);

    const downloadCsv = () => {
        const header = ["Date", "Type", "Reference", "Status", "Amount", "Net Received"];
        const rows = filteredTransactions.map((t) => {
            const payeeId = (t.payeeId?._id ?? t.payeeId)?.toString();
            const payerId = (t.payerId?._id ?? t.payerId)?.toString();
            let netReceived = 0;
            if (payeeId === currentUserId) netReceived = (t.netAmount ?? 0);
            else if (["cashback", "refund"].includes(t.type) && payerId === currentUserId) netReceived = -(t.amount ?? 0);

            return [
                dayjs(t.createdAt).tz(PH_TZ).format("YYYY-MM-DD HH:mm"),
                t.type,
                t.referenceNumber,
                t.type === "refund" ? "refunded" : (t.appointmentId?.status || ""),
                t.amount ?? 0,
                netReceived
            ];
        });

        const csv = [header, ...rows]
            .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `doctor-analytics-${year}-${String(month).padStart(2, "0")}.csv`;
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
                <button className="btn btn-primary btn-sm gap-2" onClick={downloadCsv} disabled={filteredTransactions.length === 0}>
                    <DownloadIcon className="size-4" />
                    Export
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <IncomeStatCard label="Appointment Income" value={currency(stats.appointmentIncome)} description="Before platform fees" />
                <IncomeStatCard label="Platform Fees" value={currency(stats.platformFees)} description="10% deduction on appointments" />
                <IncomeStatCard label="Net Received" value={currency(stats.totalReceived)} description="Total earnings after fees & refunds" />
                <IncomeStatCard label="Refunds / Cashback Paid" value={currency(stats.refundsPaid)} description="Provider-shouldered adjustments" />
                <IncomeStatCard label="Appointments" value={stats.completedAppointments} description="Recorded for this period" />
                <IncomeStatCard label="Average Net Income" value={currency(stats.averageIncome)} description="Per appointment" />
            </div>

            <div className="card bg-base-100 border-2 border-base-300 shadow-[0_0_0_1px_rgba(15,23,42,0.10),0_8px_24px_rgba(15,23,42,0.18)]">
                <div className="card-body">
                    <h2 className="font-semibold">Daily Income (Net)</h2>
                    {dailyIncome.length === 0 ? (
                        <div className="text-center py-12 opacity-50">
                            <BarChart3Icon className="size-10 mx-auto mb-3" />
                            <p className="font-medium">No income to chart</p>
                        </div>
                    ) : (
                        <div className="h-72 grid items-end gap-4 border-b border-base-300 pt-6" style={{ gridTemplateColumns: `repeat(${dailyIncome.length}, minmax(64px, 1fr))` }}>
                            {dailyIncome.map((day) => {
                                const height = maxDailyAmount > 0 ? Math.max(0, (day.amount / maxDailyAmount) * 100) : 0;
                                const isNegative = day.amount < 0;
                                
                                return (
                                    <div key={day.label} className="h-full flex flex-col items-center justify-end gap-2 relative">
                                        <div className={`text-xs font-medium ${isNegative ? 'text-error' : ''}`}>{currency(day.amount)}</div>
                                        <div
                                            className={`w-full max-w-24 rounded-t-lg shadow-[0_0_0_1px_rgba(47,112,186,0.18),0_8px_18px_rgba(47,112,186,0.28)] transition-all ${isNegative ? 'bg-error' : 'bg-primary'}`}
                                            style={{ height: `${Math.max(8, height)}%` }}
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
    );
};

export default DoctorAnalyticsTab;
