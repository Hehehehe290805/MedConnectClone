import { useEffect, useState } from "react";
import { Link } from "react-router";
import { axiosInstance } from "../lib/axios.js";
import AppointmentCalendar from "../components/AppointmentCalendar.jsx";
import TransactionList from "../components/TransactionList.jsx";
import ViewPendingAppointmentDoctorPopup from "./ViewPendingAppointmentDoctorPopup.jsx";
import { ClockIcon, StethoscopeIcon, ClipboardListIcon, ArrowRightIcon, CalendarIcon, ReceiptIcon, UsersIcon, UserPlusIcon } from "lucide-react";
import useAuthUser from "../hooks/useAuthUser";
import QueuePanel from "../components/QueuePanel";

const HomePageDepartment = () => {
    const { authUser } = useAuthUser();
    const isPending = authUser?.status === "pending";

    const [tab, setTab] = useState("appointments");
    const [services, setServices] = useState([]);
    const [servicesLoaded, setServicesLoaded] = useState(false);
    const [appointments, setAppointments] = useState([]);
    const [selectedAppointment, setSelectedAppointment] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showWalkinForm, setShowWalkinForm] = useState(false);

    useEffect(() => {
        axiosInstance.get("/services/my-services")
            .then(res => { if (res.data.success) setServices(res.data.services || []); })
            .catch(() => setServices([]))
            .finally(() => setServicesLoaded(true));

        fetchAppointments();
        const id = setInterval(fetchAppointments, 30_000);
        return () => clearInterval(id);
    }, []);

    const fetchAppointments = async () => {
        try {
            setLoading(true);
            setError(null);
            const res = await axiosInstance.get("/booking/my-appointments");
            if (res.data.success && Array.isArray(res.data.appointments)) {
                setAppointments(res.data.appointments.sort((a, b) => new Date(a.start) - new Date(b.start)));
            } else {
                setAppointments([]);
            }
        } catch {
            setError("Failed to load appointments.");
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    const hasServices = services.length > 0;
    const verifiedServices = services.filter(s => s.status === "verified");
    const fullName = `${authUser?.technologistFirstName || ""} ${authUser?.technologistLastName || ""}`.trim() || "Department";

    return (
        <div className="p-8 space-y-6">
            {isPending && (
                <div className="alert bg-warning/10 border border-warning/30 text-warning-content">
                    <ClockIcon className="size-5 text-warning" />
                    <div>
                        <p className="font-semibold">Your department account is pending approval</p>
                        <p className="text-sm opacity-70">
                            Our team is reviewing your information. You can browse your dashboard while you wait.
                        </p>
                    </div>
                </div>
            )}

            <div>
                <h1 className="text-2xl font-bold">Welcome, {fullName}</h1>
            </div>

            {/* Tabs */}
            <div role="tablist" className="tabs tabs-bordered">
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "appointments" ? "tab-active" : ""}`}
                    onClick={() => setTab("appointments")}
                >
                    <CalendarIcon className="size-4" /> Appointments
                </button>
                <button
                    role="tab"
                    className={`tab gap-2 ${tab === "transactions" ? "tab-active" : ""}`}
                    onClick={() => setTab("transactions")}
                >
                    <ReceiptIcon className="size-4" /> Transactions
                </button>
            </div>

            {tab === "appointments" && (
                <div className="space-y-6">
                    {/* Services status card */}
                    {servicesLoaded && (
                        !hasServices ? (
                            <div className="card bg-primary/5 border border-primary/20 p-6 rounded-xl">
                                <div className="flex items-start justify-between gap-4 flex-wrap">
                                    <div className="flex items-start gap-3">
                                        <ClipboardListIcon className="size-5 text-primary mt-0.5 shrink-0" />
                                        <div>
                                            <p className="font-semibold">Set up services now</p>
                                            <p className="text-sm opacity-70">
                                                Add the services your department offers so patients can book with you.
                                            </p>
                                        </div>
                                    </div>
                                    <Link to="/services" className="btn btn-primary btn-sm gap-1 shrink-0">
                                        Set Up Services <ArrowRightIcon className="size-3" />
                                    </Link>
                                </div>
                            </div>
                        ) : (
                            <div className="card bg-success/5 border border-success/20 p-4 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <CalendarIcon className="size-5 text-success shrink-0" />
                                    <div>
                                        <p className="font-semibold">{verifiedServices.length} verified service(s) active</p>
                                        <p className="text-sm opacity-70">Patients can book your department below.</p>
                                    </div>
                                </div>
                            </div>
                        )
                    )}

                    {/* Dept info cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="card bg-base-100 shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <StethoscopeIcon className="size-5 text-primary" />
                                <h3 className="font-bold text-lg">Department Info</h3>
                            </div>
                            <p className="text-sm opacity-70">Department ID: <span className="font-medium">{authUser?.departmentId || "—"}</span></p>
                            <p className="text-sm opacity-70">License #: <span className="font-medium">{authUser?.technologistLicenseNumber ? "••••••••" : "Not set"}</span></p>
                            <p className="text-sm opacity-70">License Expires: <span className="font-medium">
                                {authUser?.technologistLicenseExpiration
                                    ? new Date(authUser.technologistLicenseExpiration).toLocaleDateString("en-PH")
                                    : "—"}
                            </span></p>
                        </div>

                        <div className="card bg-base-100 shadow-sm border p-6">
                            <div className="flex items-center gap-3 mb-2">
                                <ClipboardListIcon className="size-5 text-primary" />
                                <h3 className="font-bold text-lg">Services</h3>
                            </div>
                            <p className="text-sm opacity-70 mb-3">Manage the services your department offers.</p>
                            <Link to="/services" className="btn btn-primary btn-sm">View Services</Link>
                        </div>
                    </div>

                    {error && <div className="alert alert-error"><span>{error}</span></div>}

                    {/* Queue section */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <UsersIcon className="size-5 text-primary" />
                                <h3 className="font-semibold">Today's Queue</h3>
                            </div>
                            <button
                                className="btn btn-outline btn-sm gap-1"
                                onClick={() => setShowWalkinForm(v => !v)}
                            >
                                <UserPlusIcon className="size-3.5" /> Add Walk-In
                            </button>
                        </div>
                        <QueuePanel showWalkinForm={showWalkinForm} setShowWalkinForm={setShowWalkinForm} />
                    </div>

                    <AppointmentCalendar
                        appointments={appointments}
                        onViewDetails={setSelectedAppointment}
                        isLoading={loading}
                    />
                </div>
            )}

            {tab === "transactions" && <TransactionList />}

            {selectedAppointment && (
                <ViewPendingAppointmentDoctorPopup
                    appointment={selectedAppointment}
                    onClose={() => setSelectedAppointment(null)}
                    onUpdated={fetchAppointments}
                />
            )}
        </div>
    );
};

export default HomePageDepartment;
