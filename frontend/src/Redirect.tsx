import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuth0 } from "@auth0/auth0-react";

export default function Redirect() {
  const { isAuthenticated, isLoading, user, error } = useAuth0();
  const navigate = useNavigate();

  console.log("Redirect component. User:", user)
  console.log("isAuthenticated", isAuthenticated)
  console.log("isLoading", isLoading)

  useEffect(() => {
    if (isLoading) return;

    // Handle Auth0 errors
    if (error) {
      console.error("Auth check error:", error);
      navigate("/auth/login");
      return;
    }

    if (isAuthenticated && user?.email_verified) {
      console.log("Redirect: authenticated");
      navigate("/dashboard");
    } else if (isAuthenticated && !user?.email_verified) {
      console.log("Redirect: authenticated but email not verified");
      navigate("/auth/login");
    } else {
      console.log("Redirect: NOT authenticated");
      navigate("/auth/login");
    }
  }, [isAuthenticated, isLoading, user?.email_verified, navigate, error]);

  // Show loading screen while auth is being determined
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

  return null;
}
