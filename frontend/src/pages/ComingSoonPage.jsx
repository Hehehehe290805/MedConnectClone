import { LayoutDashboardIcon, BookOpenIcon, ClipboardListIcon, SettingsIcon, HistoryIcon } from "lucide-react";

const navCards = [
    { label: "Dashboard", icon: LayoutDashboardIcon, active: true },
    { label: "Catalogue", icon: BookOpenIcon },
    { label: "Order Request", icon: ClipboardListIcon },
    { label: "Settings", icon: SettingsIcon },
];

const ComingSoonPage = () => {
    return (
        <div className="min-h-screen bg-base-100 p-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                    <span className="text-primary font-bold tracking-wider">PHARMACY</span>
                </div>
                <div className="flex items-center gap-2 text-base-content/60">
                    <div className="size-8 rounded-full border border-base-300 flex items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    </div>
                    <span className="text-sm">user</span>
                </div>
            </div>

            {/* Page Title */}
            <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

            {/* Nav Cards Row */}
            <div className="flex gap-4 mb-4 flex-wrap">
                {navCards.map(({ label, icon: Icon, active }) => (
                    <div
                        key={label}
                        className={`card bg-base-100 shadow p-5 flex flex-col items-start gap-4 flex-1 min-w-32 ${active ? "border-2 border-primary" : ""}`}
                    >
                        <span className={`text-sm font-semibold ${active ? "text-primary" : ""}`}>{label}</span>
                        <div className="flex flex-col gap-1 opacity-30">
                            <div className="flex items-center gap-1"><div className="size-1 rounded-full bg-base-content" /><div className="h-1 w-16 rounded bg-base-content" /></div>
                            <div className="flex items-center gap-1"><div className="size-1 rounded-full bg-base-content" /><div className="h-1 w-16 rounded bg-base-content" /></div>
                            <div className="flex items-center gap-1"><div className="size-1 rounded-full bg-base-content" /><div className="h-1 w-16 rounded bg-base-content" /></div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Order History Card */}
            <div className="card bg-base-100 shadow p-5 flex items-center gap-3 w-full">
                <HistoryIcon className="size-5 text-base-content/40" />
                <span className="text-sm font-semibold">Order History</span>
            </div>
        </div>
    );
};

export default ComingSoonPage;