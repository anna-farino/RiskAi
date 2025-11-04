import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuth0 } from "@auth0/auth0-react";
import LoadingScreen from "./components/LoadingScreen";

export default function Redirect() {
  const { isAuthenticated, isLoading, user, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    // Handle Auth0 errors
    if (error) {
      console.error("Auth check error:", error);
      navigate("/auth/login");
      return;
    }

    if (isAuthenticated && user?.email_verified) {
      navigate("/dashboard");
    } else if (isAuthenticated && !user?.email_verified) {
      navigate("/auth/login");
    } else {
      navigate("/auth/login");
    }
  }, [isAuthenticated, isLoading, user?.email_verified, navigate, error]);

  // Show loading screen while auth is being determined
  if (isLoading) {
    return (
      <LoadingScreen/>
    );
  }

  return null;
}
