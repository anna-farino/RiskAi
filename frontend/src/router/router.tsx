import DashboardWrapper from '../pages/dashboard/DashboardWrapper'
import ProtectedRoutesWrapper from '../pages/ProtectedRoutesWrapper'
import Redirect from '../Redirect.tsx'
import AuthLayout from '../pages/auth-layout.tsx'
import NewsRadar from '../pages/NewsRadar'
import ThreatAlerts from '../pages/ThreatAlerts'
import TrendAnalysis from '../pages/TrendAnalysis'
import { createBrowserRouter } from 'react-router-dom'
import { authChildren } from './auth/auth-children.tsx'
import { dashboardChildren } from './dashboard/dashboardChildren.tsx'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout/>,
    children: authChildren
  },
  {
    path: "/dashboard",
    element: <ProtectedRoutesWrapper>
        <DashboardWrapper />
      </ProtectedRoutesWrapper>,
    hydrateFallbackElement: <h1>Loading...</h1>,
    children: dashboardChildren 
  },
  {
    path: "/news-radar",
    element: <ProtectedRoutesWrapper>
        <NewsRadar />
      </ProtectedRoutesWrapper>,
  },
  {
    path: "/threat-alerts",
    element: <ProtectedRoutesWrapper>
        <ThreatAlerts />
      </ProtectedRoutesWrapper>,
  },
  {
    path: "/trend-analysis",
    element: <ProtectedRoutesWrapper>
        <TrendAnalysis />
      </ProtectedRoutesWrapper>,
  },
  {
    path: '*',
    element: <Redirect/>
  },
])
