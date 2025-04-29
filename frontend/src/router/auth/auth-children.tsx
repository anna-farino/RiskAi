import EmailOtp from "@/pages/email-otp";
import Login from "@/pages/Login";
import ConfirmPassword from "@/pages/new-password";
import OtpPage from "@/pages/otp-page";
import Signup from "@/pages/Signup";
import Redirect from "@/Redirect";


export const authChildren = [
  {
    index: true,
    element: <Redirect/>
  },
  {
    path: "login",
    element: <Login />
  },
  {
    path: "signup",
    element: <Signup />
  },
  {
    path: "email-otp",
    element: <EmailOtp />
  },
  {
    path: "otp",
    element: <OtpPage twHeight='min-h-screen'/>
  },
  {
    path: "new-password",
    element: <ConfirmPassword />
  },
]

