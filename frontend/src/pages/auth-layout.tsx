import { toast } from "@/hooks/use-toast";
import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom"

export default function AuthLayout() {
  const { isAuthenticated, isLoading, user, logout } = useAuth0();
  const navigate = useNavigate();

  console.log("Redirect component. User:", user)
  console.log("isAuthenticated", isAuthenticated)
  console.log("isLoading", isLoading)

  useEffect(() => {
    if (isAuthenticated && user?.email_verified) {
      console.log("Redirect: authenticated");
      navigate("/dashboard");
    } 
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) return null;

  return <Outlet/>
}
