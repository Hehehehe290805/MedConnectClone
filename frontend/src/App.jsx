import { Navigate, Route, Routes } from "react-router";
import { Toaster } from "react-hot-toast";

// Pages
import HomePageUser from "./pages/HomePageUser.jsx";
import HomePageDoctor from "./pages/HomePageDoctor.jsx";
import HomePageInstitute from "./pages/HomePageInstitute.jsx";
import HomePageAdmin from "./pages/HomePageAdmin.jsx";
import SignUpPage from "./pages/SignUpPage.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import CallPage from "./pages/CallPage.jsx";
import ChatPage from "./pages/ChatPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import SearchPage from "./pages/SearchPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";
import SpecialtyPage from "./pages/SpecialtyPage.jsx";

// Onboarding
import OnboardingUser from "./pages/OnboardingUser.jsx";
import OnboardingDoctor from "./pages/OnboardingDoctor.jsx";
import OnboardingInstitute from "./pages/OnboardingInstitute.jsx";
import OnboardingAdmin from "./pages/OnboardingAdmin.jsx";
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

  // Helpers
  const getHomePageComponent = () => {
    const roleComponents = {
      doctor: <HomePageDoctor />,
      institute: <HomePageInstitute />,
      admin: <HomePageAdmin />,
      user: <HomePageUser />,
    };
    return roleComponents[userRole] || <HomePageUser />;
  };

  const getOnboardingComponent = () => {
    const onboardingComponents = {
      doctor: <OnboardingDoctor />,
      institute: <OnboardingInstitute />,
      admin: <OnboardingAdmin />,
      user: <OnboardingUser />,
    };
    return onboardingComponents[userRole] || <OnboardingUser />;
  };

  // Public routes - redirect to home if authenticated
  const PublicRoute = ({ element }) =>
    !isAuthenticated ? element : <Navigate to="/" replace />;

  // Protected routes - require authentication and onboarding
  const ProtectedRouteWithOnboarding = ({ element }) => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (userStatus === "pending") return <Navigate to="/pending" replace />;
    if (userStatus !== "onBoarded") return <Navigate to="/onboarding" replace />;
    return element;
  };

  // Protected routes without onboarding check
  const ProtectedRouteBasic = ({ element }) => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    return element;
  };

  // Onboarding route handling
  const OnboardingRoute = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
    if (userStatus === "pending") return <Navigate to="/pending" replace />;
    if (userStatus === "onBoarded") return <Navigate to="/" replace />;
    return getOnboardingComponent();
  };

  // Pending route handling
  const PendingRoute = () => {
    if (!isAuthenticated) return <Navigate to="/login" replace />;
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

          {/* User-only */}
          <Route path="/search" element={
            <ProtectedRoute allowedRoles={["user"]}><SearchPage /></ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute allowedRoles={["user"]}><NotificationsPage /></ProtectedRoute>
          } />
          
          {/* Doctor-only */}
          <Route path="/specialty" element={
            <ProtectedRoute allowedRoles={["doctor"]}><SpecialtyPage /></ProtectedRoute>
          } />
        </Route>

          

        {/* Minimal Layout Routes */}
        <Route element={<Layout showSidebar={false} />}>
          <Route path="/chat/:id" element={
            <ProtectedRoute allowedRoles={["user", "doctor", "institute"]}><ChatPage /></ProtectedRoute>
          } />
        </Route>

        {/* No Layout */}
        <Route path="/call/:id" element={
          <ProtectedRoute allowedRoles={["user", "doctor", "institute"]}><CallPage /></ProtectedRoute>
        } />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      <Toaster />
    </div>
  );
};

export default App;
