import { useNavigate } from "react-router-dom"
import { useAuth } from "./hooks/use-auth"
import { useEffect } from "react"

export default function Redirect() {
  const { data, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading) return;

    if (data) {
      console.log("Redirect: authenticated");
      navigate("/dashboard");
    } else {
      console.log("Redirect: NOT authenticated");
      navigate("/auth/login");
    }
  }, [data, isLoading, navigate]);

  return null;
}
