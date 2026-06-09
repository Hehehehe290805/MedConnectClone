import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "react-hot-toast";
import toast from "react-hot-toast";

// Dismiss any existing toast before showing a new one so toasts never stack.
// ES modules are cached, so this patch applies to every file that imports toast.
const _err = toast.error.bind(toast);
const _ok  = toast.success.bind(toast);
const _info = toast.bind(toast);
toast.error   = (msg, opts) => { toast.dismiss(); return _err(msg, opts); };
toast.success = (msg, opts) => { toast.dismiss(); return _ok(msg, opts); };
// leave toast() (loading/custom) as-is — callers manage those manually

// Pages
import HomePageUser from "./pages/HomePageUser.jsx";
import HomePageDoctor from "./pages/HomePageDoctor.jsx";
import HomePageAdmin from "./pages/HomePageAdmin.jsx";
import HomePagePharmacy from "./pages/HomePagePharmacy.jsx";
import PharmacyCataloguePage from "./pages/PharmacyCataloguePage.jsx";
import PharmacyIncomePage from "./pages/PharmacyIncomePage.jsx";
import CustomerPharmacyPage from "./pages/CustomerPharmacyPage.jsx";
import HomePageInstitute from "./pages/HomePageInstitute.jsx";
import HomePageDepartment from "./pages/HomePageDepartment.jsx";
import ServicesPage from "./pages/ServicesPage.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CallPage from "./pages/CallPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SpecialtyPage from "./pages/SpecialtyPage.jsx";
import DoctorAppointmentsPage from "./pages/DoctorAppointmentsPage.jsx";
import QueueManagementPage from "./pages/QueueManagementPage.jsx";
import PatientAppointmentsPage from "./pages/PatientAppointmentsPage.jsx";
import TermsOfServicePage from "./pages/TermsOfServicePage.jsx";
import PrivacyPolicyPage from "./pages/PrivacyPolicyPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";
import MockGCashPage from "./pages/MockGCashPage.jsx";
import TransactionPage from "./pages/TransactionPage.jsx";
import ConsultationPage from "./pages/ConsultationPage.jsx";
import UserManagementPage from "./pages/UserManagementPage.jsx";
import AdminSpecialtiesPage from "./pages/AdminSpecialtiesPage.jsx";
import AdminReportsPage from "./pages/AdminReportsPage.jsx";
import AdminServiceClaimsPage from "./pages/AdminServiceClaimsPage.jsx";
import AdminAnalyticsPage from "./pages/AdminAnalyticsPage.jsx";

// Onboarding & Auth flow
import OnboardingPage from "./pages/OnboardingPage.jsx";
import OnboardingDepartment from "./pages/OnboardingDepartment.jsx";
import ManageDepartments from "./pages/ManageDepartments.jsx";
import Pending from "./pages/Pending.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ForgotPasswordVerifyPage from "./pages/ForgotPasswordVerifyPage.jsx";
import ForgotPasswordResetPage from "./pages/ForgotPasswordResetPage.jsx";

// Components
import PageLoader from "./components/PageLoader.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import OtherProfilePage from "./pages/OtherProfilePage.jsx";

// Hooks & Stores
import useAuthUser from "./hooks/useAuthUser.js";
import { useThemeStore } from "./store/useThemeStore.js";

const AppointmentsDispatch = () => {
    const { authUser } = useAuthUser();
    return authUser?.role === "doctor" ? <DoctorAppointmentsPage /> : <PatientAppointmentsPage />;
};

const App = () => {
    const { isLoading, authUser } = useAuthUser();
    const { theme } = useThemeStore();

    if (isLoading) return <PageLoader />;

    const isAuthenticated = Boolean(authUser);
    const userStatus = authUser?.status;
    const userRole = authUser?.role;

    const getHomePageComponent = () => {
        const roleComponents = {
            patient: <HomePageUser />,
            doctor: <HomePageDoctor />,
            pharmacy: <HomePagePharmacy />,
            institute: <HomePageInstitute />,
            department: <HomePageDepartment />,
            admin: <HomePageAdmin />,
        };
        return roleComponents[userRole] || <ComingSoonPage />;
    };

    // public routes
    const PublicRoute = ({ element }) =>
        !isAuthenticated ? element : <Navigate to="/" replace />;

    // protected routes — pending users can now access dashboard except admin
    const ProtectedRouteWithOnboarding = ({ element }) => {
        if (!isAuthenticated) return <Navigate to="/login" replace />;
        if (userStatus === "notOnBoarded") return <Navigate to="/onboarding" replace />;
        // admin pending → still goes to /pending
        if (userStatus === "pending" && userRole === "admin") return <Navigate to="/pending" replace />;
        return element;
    };

    // onboarding route
    const OnboardingRoute = () => {
        if (!isAuthenticated) return <Navigate to="/login" replace />;
        if (userStatus === "pending" && userRole === "admin") return <Navigate to="/pending" replace />;
        if (userStatus !== "notOnBoarded") return <Navigate to="/" replace />;
        return <OnboardingPage />;
    };

    // pending route — admin only
    const PendingRoute = () => {
        if (!isAuthenticated) return <Navigate to="/login" replace />;
        if (userStatus === "notOnBoarded") return <Navigate to="/onboarding" replace />;
        if (userRole !== "admin") return <Navigate to="/" replace />;
        if (userStatus !== "pending") return <Navigate to="/" replace />;
        return <Pending />;
    };

    return (
        <div className="min-h-screen" data-theme={theme}>
            <Routes>
                {/* Public */}
                <Route path="/signup" element={<PublicRoute element={<SignUpPage />} />} />
                <Route path="/login" element={<PublicRoute element={<LoginPage />} />} />
                <Route path="/forgot-password" element={<PublicRoute element={<ForgotPasswordPage />} />} />
                <Route path="/forgot-password/verify" element={<PublicRoute element={<ForgotPasswordVerifyPage />} />} />
                <Route path="/forgot-password/reset" element={<PublicRoute element={<ForgotPasswordResetPage />} />} />

                {/* Onboarding & Pending */}
                <Route path="/onboarding" element={<OnboardingRoute />} />
                <Route path="/pending" element={<PendingRoute />} />

                {/* Main Layout Routes */}
                <Route element={<Layout showSidebar={true} />}>
                    <Route path="/" element={<ProtectedRouteWithOnboarding element={getHomePageComponent()} />} />
                    <Route path="/profile" element={<ProtectedRouteWithOnboarding element={<ProfilePage />} />} />
                    <Route path="/profile/:id" element={<ProtectedRouteWithOnboarding element={<OtherProfilePage />} />} />
                    <Route path="/settings" element={<ProtectedRouteWithOnboarding element={<SettingsPage />} />} />

                    {/* Shared — role dispatcher */}
                    <Route path="/appointments" element={
                        <ProtectedRoute allowedRoles={["patient", "doctor"]}>
                            <AppointmentsDispatch />
                        </ProtectedRoute>
                    } />
                    <Route path="/consultation" element={
                        <ProtectedRoute allowedRoles={["patient"]}><ConsultationPage /></ProtectedRoute>
                    } />
                    <Route path="/search" element={
                        <ProtectedRoute allowedRoles={["patient"]}><SearchPage /></ProtectedRoute>
                    } />
                    <Route path="/notifications" element={
                        <ProtectedRoute allowedRoles={["patient", "doctor", "pharmacy", "institute", "department", "admin"]}><NotificationsPage /></ProtectedRoute>
                    } />
                    <Route path="/transactions" element={
                        <ProtectedRoute allowedRoles={["patient", "doctor", "pharmacy", "institute", "department"]}><TransactionPage /></ProtectedRoute>
                    } />
                    <Route path="/mock-payment" element={
                        <ProtectedRoute allowedRoles={["patient"]}><MockGCashPage /></ProtectedRoute>
                    } />
                    <Route path="/pharmacy" element={
                        <ProtectedRoute allowedRoles={["patient"]}><CustomerPharmacyPage /></ProtectedRoute>
                    } />
                    <Route path="/pharmacy-catalogue" element={
                        <ProtectedRoute allowedRoles={["pharmacy"]}><PharmacyCataloguePage /></ProtectedRoute>
                    } />
                    <Route path="/pharmacy-income" element={
                        <ProtectedRoute allowedRoles={["pharmacy"]}><PharmacyIncomePage /></ProtectedRoute>
                    } />

                    {/* Doctor / Department */}
                    <Route path="/specialty" element={
                        <ProtectedRoute allowedRoles={["doctor"]}><SpecialtyPage /></ProtectedRoute>
                    } />
                    <Route path="/queue" element={
                        <ProtectedRoute allowedRoles={["doctor", "department"]}><QueueManagementPage /></ProtectedRoute>
                    } />

                    {/* Institute */}
                    <Route path="/setup-departments" element={
                        <ProtectedRouteWithOnboarding element={
                            userRole === "institute" ? <OnboardingDepartment /> : <Navigate to="/" replace />
                        } />
                    } />
                    <Route path="/manage-departments" element={
                        <ProtectedRouteWithOnboarding element={
                            userRole === "institute" ? <ManageDepartments /> : <Navigate to="/" replace />
                        } />
                    } />

                    {/* Department */}
                    <Route path="/services" element={
                        <ProtectedRoute allowedRoles={["department"]}><ServicesPage /></ProtectedRoute>
                    } />

                    {/* Chat */}
                    <Route path="/chat/:id" element={
                        <ProtectedRoute allowedRoles={["patient", "doctor"]}><ChatPage /></ProtectedRoute>
                    } />

                    {/* Admin */}
                    <Route path="/admin/users" element={
                        <ProtectedRoute allowedRoles={["admin"]}><UserManagementPage /></ProtectedRoute>
                    } />
                    <Route path="/admin/specialties" element={
                        <ProtectedRoute allowedRoles={["admin"]}><AdminSpecialtiesPage /></ProtectedRoute>
                    } />
                    <Route path="/admin/reports" element={
                        <ProtectedRoute allowedRoles={["admin"]}><AdminReportsPage /></ProtectedRoute>
                    } />
<<<<<<< HEAD
                    <Route path="/admin/services" element={
                        <ProtectedRoute allowedRoles={["admin"]}><AdminServiceClaimsPage /></ProtectedRoute>
=======
                    <Route path="/admin/analytics" element={
                        <ProtectedRoute allowedRoles={["admin"]}><AdminAnalyticsPage /></ProtectedRoute>
>>>>>>> 901f75f47db0b175a71fb88b7d6b409ae6d08016
                    } />
                </Route>


                {/* No Layout */}
                <Route path="/call/:id" element={
                    <ProtectedRoute allowedRoles={["patient", "doctor"]}><CallPage /></ProtectedRoute>
                } />

                <Route path="/terms-of-service" element={<TermsOfServicePage />} />
                <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                <Route path="/coming-soon" element={<ComingSoonPage />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster />
        </div>
    );
};

export default App;
