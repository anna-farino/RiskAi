import { useAuth0 } from "@auth0/auth0-react"
import { Navigate, Outlet } from "react-router-dom"

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user } = useAuth0();

  // Show loading while Auth0 determines authentication state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#BF00FF] mx-auto mb-4"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  // If authenticated and email verified, redirect to dashboard
  if (isAuthenticated && user?.email_verified) {
    return <Navigate to="/dashboard" replace />;
  }

  // Allow access to auth pages if not authenticated or email not verified
  return <Outlet/>
}
