import { useCanAccessAuth } from "@/hooks/use-can-access-auth"
import { Outlet } from "react-router-dom"


export default function AuthLayout() {
  if (!useCanAccessAuth()) return
  return <Outlet/>
}
