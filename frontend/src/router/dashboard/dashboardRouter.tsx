//import Admin from '../../pages/dashboard/Admin'
//import Secrets from '../../pages/dashboard/Secrets.tsx'
import OtpPage from '../../pages/otp-page.tsx'
import ConfirmPassword from '../../pages/new-password.tsx'
import Settings from '../../pages/dashboard/Settings.tsx'
import HackRoles from '../../pages/dashboard/hack-roles.tsx'
import WidgetDashboard from '@/pages/Dashboard.tsx'

export const dashboardRouter = [
  {
    index: true,
    element: <WidgetDashboard/>,
  },
  {
    path: "settings",
    element: <Settings/>,
  },
  {
    path: "hack-roles",
    element: <HackRoles/>
  },
  {
    path: "settings/otp",
    element: <OtpPage twHeight='h-full' />
  },
  {
    path: "settings/new-password",
    element: <ConfirmPassword twHeight='h-full' redirect='settings'/>
  },
  //{
  //  path: "admin",
  //  element: <Admin/>,
  //},
  //{
  //  path: "secrets",
  //  element: <Secrets/>
  //},
]
