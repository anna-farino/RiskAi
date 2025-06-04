import ProtectedRoutesWrapper from '../pages/ProtectedRoutesWrapper'
import Redirect from '../Redirect.tsx'
import AuthLayout from '../pages/auth-layout.tsx'
import { createBrowserRouter } from 'react-router-dom'
import { authChildren } from './auth/auth-children.tsx'
import { dashboardChildren } from './dashboard/dashboardChildren.tsx'
import DashboardLayout from '@/components/layout/DashboardLayout.tsx'
import LoadingScreen from '@/components/LoadingScreen'

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout/>,
    children: authChildren
  },
  {
    path: "/dashboard",
    element: <ProtectedRoutesWrapper>
        <DashboardLayout/>
      </ProtectedRoutesWrapper>,
    hydrateFallbackElement: <h1>Loading...</h1>,
    children: dashboardChildren 
  },
  {
    path: '*',
    element: <Redirect/>
  },
])
