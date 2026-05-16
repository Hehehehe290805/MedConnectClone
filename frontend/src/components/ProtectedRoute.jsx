import { Navigate } from "react-router";
import useAuthUser from "../hooks/useAuthUser";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { authUser } = useAuthUser();

  // Not authenticated - redirect to login
  if (!authUser) {
    return <Navigate to="/login" replace />;
  }

  // Not onboarded - redirect to appropriate onboarding
  if (authUser.status !== "onBoarded") {
    if (authUser.status === "pending") {
      return <Navigate to="/pending" replace />;
    }
    // Redirect to role-specific onboarding
    const onboardingPath = `/onboarding-${authUser.role}`;
    return <Navigate to={onboardingPath} replace />;
  }

  // Check if user's role is allowed for this route
  if (allowedRoles && !allowedRoles.includes(authUser.role)) {
    // Unauthorized - redirect to their home page
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
