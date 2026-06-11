import { Link, useLocation } from "react-router";
import useAuthUser from "../hooks/useAuthUser";
import {
    BriefcaseMedicalIcon, HomeIcon, SearchIcon, SettingsIcon,
    CalendarIcon, PillIcon, BuildingIcon, ClipboardListIcon, StarIcon,
    ReceiptIcon, UsersIcon, BookOpenIcon, FlagIcon, BellIcon, PackageIcon, ActivityIcon
} from "lucide-react";

const Sidebar = () => {
    const { authUser } = useAuthUser();
    const location = useLocation();
    const currentPath = location.pathname;
    const role = authUser?.role;

    const fullName = role === "pharmacy"
        ? authUser?.pharmacyName || "Pharmacy"
        : role === "institute"
            ? authUser?.instituteName || "Institute"
            : role === "department"
                ? `${authUser?.technologistFirstName || ""} ${authUser?.technologistLastName || ""}`.trim() || "Department"
                : `${authUser?.firstName || ""} ${authUser?.lastName || ""}`.trim() || "User";

    const isPending = authUser?.status === "pending";

    const navItem = (to, icon, label, disabled = false, extraActivePaths = []) => {
        const Icon = icon;
        const isActive = currentPath === to || extraActivePaths.includes(currentPath);
        if (disabled) {
            return (
                <div
                    className="btn btn-ghost justify-start w-full gap-3 px-3 normal-case opacity-40 cursor-not-allowed"
                    title="Available after your account is approved"
                >
                    <Icon className="size-5 text-base-content opacity-70" />
                    <span>{label}</span>
                </div>
            );
        }
        return (
            <Link
                to={to}
                className={`btn btn-ghost justify-start w-full gap-3 px-3 normal-case ${isActive ? "btn-active" : ""}`}
            >
                <Icon className="size-5 text-base-content opacity-70" />
                <span>{label}</span>
            </Link>
        );
    };

    const renderNav = () => {
        switch (role) {
            case "patient":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/appointments", CalendarIcon, "Appointments", isPending)}
                        {navItem("/search", SearchIcon, "Search", isPending)}
                        {navItem("/pharmacy", PillIcon, "Pharmacy")}
                        {navItem("/transactions", ReceiptIcon, "Transactions", isPending)}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            case "doctor":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/appointments", CalendarIcon, "Appointments", isPending)}
                        {navItem("/transactions", ReceiptIcon, "Transactions", isPending)}
                        {navItem("/specialty", StarIcon, "Specialties")}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            case "institute":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/manage-departments", BuildingIcon, "Departments", false, ["/setup-departments"])}
                        {navItem("/transactions", ReceiptIcon, "Transactions", isPending)}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            case "department":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/services", ClipboardListIcon, "Services")}
                        {navItem("/transactions", ReceiptIcon, "Transactions", isPending)}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            case "admin":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/notifications", BellIcon, "Notifications")}
                        {navItem("/admin/users", UsersIcon, "User Management")}
                        {navItem("/admin/analytics", ActivityIcon, "Analytics")}
                        {navItem("/admin/specialties", BookOpenIcon, "Specialties & Services")}
                        {navItem("/admin/services", ClipboardListIcon, "Service Claims")}
                        {navItem("/admin/reports", FlagIcon, "Reports")}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            case "pharmacy":
                return (
                    <>
                        {navItem("/", HomeIcon, "Home")}
                        {navItem("/pharmacy-catalogue", PackageIcon, "Catalogue")}
                        {navItem("/pharmacy-income", ReceiptIcon, "Transactions")}
                        {navItem("/settings", SettingsIcon, "Settings")}
                    </>
                );
            default:
                return navItem("/", HomeIcon, "Home");
        }
    };

    return (
        <aside className="w-64 bg-base-200 border-r border-base-300 hidden lg:flex flex-col h-screen sticky top-0">
            <div className="p-5 border-b border-base-300">
                <Link to="/" className="flex items-center gap-2.5">
                    <BriefcaseMedicalIcon
                        className="size-9 text-primary"
                        style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.35))" }}
                    />
                    <span className="text-primary text-3xl font-bold font-mono tracking-wider">MedConnect</span>
                </Link>
            </div>

            <nav className="flex-1 p-4 space-y-1">
                {renderNav()}
            </nav>

            <Link
                to="/profile"
                className="btn btn-ghost w-full justify-start normal-case h-auto min-h-0 p-0 hover:bg-base-200"
            >
                <div className="p-4 border-t border-base-300 w-full">
                    <div className="flex items-center gap-3">
                        <div className="avatar">
                            <div className="w-10 rounded-full">
                                {authUser?.profilePic?.url ? (
                                    <img src={authUser.profilePic.url} alt="User Avatar" />
                                ) : (
                                    <div className="bg-base-300 w-10 h-10 rounded-full flex items-center justify-center">
                                        <span className="text-sm">👤</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">{fullName}</p>
                            <p className="text-xs text-success flex items-center gap-1">
                                <span className="size-2 rounded-full bg-success inline-block" />
                                Online
                            </p>
                        </div>
                    </div>
                </div>
            </Link>
        </aside>
    );
};

export default Sidebar;