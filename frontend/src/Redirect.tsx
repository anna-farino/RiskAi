import { useNavigate } from "react-router-dom"
import { useEffect } from "react"
import { useAuth0 } from "@auth0/auth0-react";

export default function Redirect() {
  const { isAuthenticated, isLoading } = useAuth0();
  const navigate = useNavigate();

  console.log("Redirect component")
  console.log("isAuthenticated", isAuthenticated)
  console.log("isLoading", isLoading)

  useEffect(() => {
    if (isLoading) return;

    if (isAuthenticated) {
      console.log("Redirect: authenticated");
      navigate("/dashboard");
    } else {
      console.log("Redirect: NOT authenticated");
      navigate("/auth/login");
    }
  }, [isAuthenticated, isLoading, navigate]);

  return null;
}
