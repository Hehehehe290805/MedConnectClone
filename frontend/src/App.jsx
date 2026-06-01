import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "react-hot-toast";

// Pages
import HomePageUser from "./pages/HomePageUser.jsx";
import HomePageDoctor from "./pages/HomePageDoctor.jsx";
import HomePageAdmin from "./pages/HomePageAdmin.jsx";
import HomePageInstitute from "./pages/HomePageInstitute.jsx";
import HomePageDepartment from "./pages/HomePageDepartment.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CallPage from "./pages/CallPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SpecialtyPage from "./pages/SpecialtyPage.jsx";
import ComingSoonPage from "./pages/ComingSoonPage.jsx";

// Onboarding & Auth flow
import OnboardingPage from "./pages/OnboardingPage.jsx";
import Pending from "./pages/Pending.jsx";

// Components
import PageLoader from "./components/PageLoader.jsx";
import Layout from "./components/Layout.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import OtherProfilePage from "./pages/OtherProfilePage.jsx";

// Hooks & Stores
import useAuthUser from "./hooks/useAuthUser.js";
import { useThemeStore } from "./store/useThemeStore.js";

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
            pharmacy: <ComingSoonPage />,
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

                {/* Onboarding & Pending */}
                <Route path="/onboarding" element={<OnboardingRoute />} />
                <Route path="/pending" element={<PendingRoute />} />

                {/* Main Layout Routes */}
                <Route element={<Layout showSidebar={true} />}>
                    <Route path="/" element={<ProtectedRouteWithOnboarding element={getHomePageComponent()} />} />
                    <Route path="/profile" element={<ProtectedRouteWithOnboarding element={<ProfilePage />} />} />
                    <Route path="/profile/:id" element={<ProtectedRouteWithOnboarding element={<OtherProfilePage />} />} />
                    <Route path="/settings" element={<ProtectedRouteWithOnboarding element={<SettingsPage />} />} />

                    {/* Patient */}
                    <Route path="/search" element={
                        <ProtectedRoute allowedRoles={["patient"]}><SearchPage /></ProtectedRoute>
                    } />
                    <Route path="/notifications" element={
                        <ProtectedRoute allowedRoles={["patient"]}><NotificationsPage /></ProtectedRoute>
                    } />
                    <Route path="/pharmacy" element={<ProtectedRouteWithOnboarding element={<ComingSoonPage />} />} />

                    {/* Doctor */}
                    <Route path="/specialty" element={
                        <ProtectedRoute allowedRoles={["doctor"]}><SpecialtyPage /></ProtectedRoute>
                    } />
                    <Route path="/appointments" element={
                        <ProtectedRoute allowedRoles={["doctor"]}><ComingSoonPage /></ProtectedRoute>
                    } />

                    {/* Institute */}
                    <Route path="/setup-departments" element={
                        <ProtectedRoute allowedRoles={["institute"]}><ComingSoonPage /></ProtectedRoute>
                    } />

                    {/* Department */}
                    <Route path="/services" element={
                        <ProtectedRoute allowedRoles={["department"]}><ComingSoonPage /></ProtectedRoute>
                    } />
                </Route>

                {/* Minimal Layout Routes */}
                <Route element={<Layout showSidebar={false} />}>
                    <Route path="/chat/:id" element={
                        <ProtectedRoute allowedRoles={["patient", "doctor"]}><ChatPage /></ProtectedRoute>
                    } />
                </Route>

                {/* No Layout */}
                <Route path="/call/:id" element={
                    <ProtectedRoute allowedRoles={["patient", "doctor"]}><CallPage /></ProtectedRoute>
                } />

                <Route path="/coming-soon" element={<ComingSoonPage />} />

                {/* Catch-all */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <Toaster />
        </div>
    );
};

export default App;