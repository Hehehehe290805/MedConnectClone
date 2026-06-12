import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router";
import { useQuery } from "@tanstack/react-query";
import useAuthUser from "../hooks/useAuthUser";
import { axiosInstance } from "../lib/axios";
import {
    BriefcaseMedicalIcon, HomeIcon, SearchIcon, SettingsIcon,
    CalendarIcon, PillIcon, BuildingIcon, ClipboardListIcon, StarIcon,
    ReceiptIcon, UsersIcon, BookOpenIcon, FlagIcon, BellIcon, PackageIcon, ActivityIcon
} from "lucide-react";

const Sidebar = () => {
    const { authUser } = useAuthUser();
    const [profileImageFailed, setProfileImageFailed] = useState(false);
    const location = useLocation();
    const currentPath = location.pathname;
    const role = authUser?.role;
    const profilePicUrl = authUser?.profilePic?.url;

    useEffect(() => {
        setProfileImageFailed(false);
    }, [profilePicUrl]);

    const fullName = role === "pharmacy"
        ? authUser?.pharmacyName || "Pharmacy"
        : role === "institute"
            ? authUser?.instituteName || "Institute"
            : role === "department"
                ? `${authUser?.technologistFirstName || ""} ${authUser?.technologistLastName || ""}`.trim() || "Department"
                : `${authUser?.firstName || ""} ${authUser?.lastName || ""}`.trim() || "User";

    const isPending = authUser?.status === "pending";
    const isOnline = Boolean(authUser?.isOnline);
    const { data: doctorAppointmentsData } = useQuery({
        queryKey: ["sidebar-doctor-approval-requests"],
        queryFn: () => axiosInstance.get("/booking/my-appointments").then(r => r.data.data?.appointments || []),
        enabled: role === "doctor" && !isPending,
        refetchInterval: 30_000,
        retry: false,
    });

    const rebookableStatuses = ["missed_by_patient", "missed_by_provider", "missed_by_both"];
    const approvalRequestCount = (doctorAppointmentsData || []).filter((appt) =>
        appt.status === "deposit_paid" || Boolean(appt.rebooked && rebookableStatuses.includes(appt.status))
    ).length;

    const navItem = (to, icon, label, disabled = false, countOrExtraActivePaths = 0, extraActivePaths = []) => {
        const Icon = icon;
        const count = Array.isArray(countOrExtraActivePaths) ? 0 : countOrExtraActivePaths;
        const activePaths = Array.isArray(countOrExtraActivePaths) ? countOrExtraActivePaths : extraActivePaths;
        const isActive = currentPath === to || activePaths.includes(currentPath);
        if (disabled) {
            return (
                <div
                    className="btn btn-ghost justify-start w-full gap-3 px-3 normal-case opacity-40 cursor-not-allowed"
                    title="Available after your account is approved"
                >
                    <Icon className="size-5 text-base-content opacity-70" />
                    <span>{label}</span>
                    {count > 0 && <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">{count}</span>}
                </div>
            );
        }
        return (
            <Link
                to={to}
                className={`btn justify-start w-full gap-3 px-3 normal-case border-none ${
                    isActive
                        ? "bg-primary text-primary-content hover:bg-primary"
                        : "btn-ghost hover:bg-base-200"
                }`}
            >
                <Icon className={`size-5 ${isActive ? "text-primary-content" : "text-base-content opacity-70"}`} />
                <span>{label}</span>
                {count > 0 && (
                    <span className="ml-auto rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
                        {count}
                    </span>
                )}
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
                        {navItem("/appointments", CalendarIcon, "Appointments", isPending, approvalRequestCount)}
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
                        {navItem("/admin/services", ClipboardListIcon, "Service Claims")}
                        {navItem("/admin/analytics", ActivityIcon, "Analytics")}
                        {navItem("/admin/specialties", BookOpenIcon, "Specialties & Services")}
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
        <aside className="w-64 bg-base-100 border-r border-base-300 hidden lg:flex flex-col h-screen sticky top-0">
            <div className="p-5 border-b border-base-300 bg-base-100">
                <Link to="/" className="flex items-center gap-2.5">
                    <BriefcaseMedicalIcon
                        className="size-9 text-primary"
                        style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.35))" }}
                    />
                    <span className="text-primary text-3xl font-bold font-mono tracking-wider">MedConnect</span>
                </Link>
            </div>

            <nav className="flex-1 p-4 space-y-1 bg-slate-200">
                {renderNav()}
            </nav>

            <Link
                to="/profile"
                className="btn btn-ghost w-full justify-start normal-case h-auto min-h-0 p-0 hover:bg-base-100"
            >
                <div className="p-4 border-t border-base-300 w-full bg-slate-300 shadow-[0_-2px_10px_rgba(15,23,42,0.10)]">
                    <div className="flex items-center gap-3">
                        <div className="avatar">
                            <div className="w-10 rounded-full">
                                {profilePicUrl && !profileImageFailed ? (
                                    <img src={profilePicUrl} alt="User Avatar" onError={() => setProfileImageFailed(true)} />
                                ) : (
                                    <div className="bg-base-300 w-10 h-10 rounded-full flex items-center justify-center">
                                        <span className="text-sm">👤</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 text-left">
                            <p className="font-semibold text-sm">{fullName}</p>
                            <p className={`text-xs flex items-center gap-1 ${isOnline ? "text-success" : "text-base-content/50"}`}>
                                <span className={`size-2 rounded-full inline-block ${isOnline ? "bg-success" : "bg-base-content/30"}`} />
                                {isOnline ? "Online" : "Offline"}
                            </p>
                        </div>
                    </div>
                </div>
            </Link>
        </aside>
    );
};

export default Sidebar;
