import LoadingScreen from "@/components/LoadingScreen";
import { useAuth0 } from "@auth0/auth0-react"
import { Navigate, Outlet } from "react-router-dom"

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuth0();

  // Show loading while Auth0 determines authentication state
  if (isLoading) {
    return (
      <LoadingScreen/>
    );
  }

  // If authenticated and email verified, redirect to dashboard
  if (isAuthenticated && user?.email_verified) {
    return <Navigate to="/dashboard" replace />;
  }

  // Allow access to auth pages if not authenticated or email not verified
  return <Outlet/>
}
