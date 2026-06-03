import { Navigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";

// Guards routes that require authentication and a specific role.
// Pending non-admin users are allowed through — they see dashboards with
// "pending approval" banners. Only notOnBoarded users are redirected to onboarding,
// and pending admins are redirected to /pending.
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { authUser } = useAuthUser();

  if (!authUser) return <Navigate to="/login" replace />;

  if (authUser.status === "notOnBoarded") return <Navigate to="/onboarding" replace />;

  // Admin pending stays on /pending; all other pending users can access features
  if (authUser.status === "pending" && authUser.role === "admin") {
    return <Navigate to="/pending" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(authUser.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
