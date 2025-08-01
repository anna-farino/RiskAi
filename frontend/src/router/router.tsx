import Redirect from '../Redirect.tsx'
import AuthLayout from '../pages/auth-layout.tsx'
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { authChildren } from './auth/auth-children.tsx'
import { dashboardChildren } from './dashboard/dashboardChildren.tsx'
import DashboardLayout from '@/components/layout/DashboardLayout.tsx'
import Auth0ProviderWithNavigate from '@/auth0-provider-with-navigate.tsx'
import LoadingScreen from '@/components/LoadingScreen'

export const router = createBrowserRouter([
  {
    path: '/',
    element:
      <Auth0ProviderWithNavigate>
        <Outlet/>
      </Auth0ProviderWithNavigate>,
    children: [
      {
        path: '/auth',
        element: <AuthLayout/>,
        hydrateFallbackElement: <LoadingScreen />,
        children: authChildren
      },
      {
        path: "/dashboard",
        element: <DashboardLayout/>,
        hydrateFallbackElement: <LoadingScreen />,
        children: dashboardChildren 
      },
      {
        index: true,
        element: <Redirect/>
      },
      {
        path: '*',
        element: <Redirect/>
      },
    ]
  },
])
