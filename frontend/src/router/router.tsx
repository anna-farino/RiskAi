import DashboardWrapper from '../pages/dashboard/DashboardWrapper'
import ProtectedRoutesWrapper from '../pages/ProtectedRoutesWrapper'
import Redirect from '../Redirect.tsx'
import AuthLayout from '../pages/auth-layout.tsx'
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
    path: '*',
    element: <Redirect/>
  },
  {
    path: "*",
    element: <h1>Ooops! Page not found... </h1>
  }
])
