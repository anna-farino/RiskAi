import { useNavigate } from "react-router-dom"
import { useAuth } from "./hooks/use-auth"
import { useEffect } from "react"
import { RisqLoader } from "./components/ui/loading"
import { useLoadingState } from "./hooks/use-loading-state"

export default function Redirect() {
  const { data, isLoading } = useAuth();
  const navigate = useNavigate();
  const showLoading = useLoadingState(isLoading, { minimumLoadingTime: 1000 });

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

  if (showLoading) {
    return <RisqLoader message="Authenticating your session..." />;
  }

  return null;
}
