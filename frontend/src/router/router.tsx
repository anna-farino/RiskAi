import ProtectedRoutesWrapper from '../pages/ProtectedRoutesWrapper'
import Redirect from '../Redirect.tsx'
import AuthLayout from '../pages/auth-layout.tsx'
import { createBrowserRouter } from 'react-router-dom'
import { authChildren } from './auth/auth-children.tsx'
import { dashboardChildren } from './dashboard/dashboardChildren.tsx'
import DashboardLayout from '@/components/layout/DashboardLayout.tsx'
import Auth0ProviderWithNavigate from '@/auth0-provider-with-navigate.tsx'
import LoginPageForAuth0 from '@/login-page-for-auth0.tsx'
import LoadingScreen from '@/components/LoadingScreen'

export const router = createBrowserRouter([
  {
    path: 'login',
    element:
      <Auth0ProviderWithNavigate>
        <LoginPageForAuth0/>
      </Auth0ProviderWithNavigate>,
    index: true
  },
  {
    path: '/auth',
    element: <AuthLayout/>,
    children: authChildren
  },
  {
    path: "/dashboard",
    element: 
      <Auth0ProviderWithNavigate>
        <DashboardLayout/>
      </Auth0ProviderWithNavigate>,
    hydrateFallbackElement: <LoadingScreen />,
    children: dashboardChildren 
  },
  //{
  //  path: '*',
  //  element: <Redirect/>
  //},
])
