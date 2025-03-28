import { useNavigate } from "react-router-dom"
import { useAuth } from "./hooks/use-auth"
import { useEffect } from "react"

export default function Redirect() {
  const { user } = useAuth()
  const navigate = useNavigate()
  
  useEffect(()=>{
    if (user) {
      navigate("/dashboard/home")
    } else {
      navigate("/login")
    }
  },[])

  return (<></>)
}
