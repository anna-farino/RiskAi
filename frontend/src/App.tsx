import { createBrowserRouter, Outlet, RouterProvider } from 'react-router-dom'
import { ThemeProvider } from './components/theme-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import Login from './pages/Login'
import Signup from './pages/Signup'
import DashboardWrapper from './pages/dashboard/DashboardWrapper'
import Home from './pages/dashboard/Home'
import ProtectedRoutesWrapper from './pages/ProtectedRoutesWrapper'
import Admin from './pages/dashboard/Admin'
import OtpPage from './pages/otp-page.tsx'
import Redirect from './Redirect.tsx'
import NewsHome from './pages/dashboard/news-tracker//home.tsx'
import Sources from './pages/dashboard/news-tracker/sources.tsx'
import Keywords from './pages/dashboard/news-tracker/keywords.tsx'
import NewsLayout from './pages/dashboard/news-tracker/layout.tsx'
import EmailOtp from './pages/email-otp.tsx'
import ConfirmPassword from './pages/new-password.tsx'
import AuthLayout from './pages/auth-layout.tsx'
import Settings from './pages/dashboard/Settings.tsx'
import NewsCapsuleHome from './pages/dashboard/news-capsule/news-capsule-home.tsx'
import AnalysisPage from './pages/dashboard/news-capsule/AnalysisPage.tsx'
import HistoryPage from './pages/dashboard/news-capsule/HistoryPage.tsx'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout/>,
    children: [
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
        element: <OtpPage/>
      },
      {
        path: "new-password",
        element: <ConfirmPassword/>
      },
    ]
  },
  {
    path: "/dashboard",
    element: <ProtectedRoutesWrapper>
      <DashboardWrapper />
    </ProtectedRoutesWrapper>,
    hydrateFallbackElement: <h1>Loading...</h1>,
    children: [
      {
        path: "home",
        element: <Home/>,
      },
      {
        path: "settings",
        element: <Settings/>,
      },
      {
        path: "settings/otp",
        element: <OtpPage twHeight='h-full' />
      },
      {
        path: "settings/new-password",
        element: <ConfirmPassword twHeight='h-full' redirect='settings'/>
      },
      {
        path: "admin",
        element: <Admin/>,
      },
      {
        path: "news",
        element: <NewsLayout/>,
        children: [
          {
            path: "home",
            element: <NewsHome/>,
          },
          {
            path: "sources",
            element: <Sources/>,
          },
          {
            path: "keywords",
            element: <Keywords/>,
          },
        ]
      },
      {
        path: "news-capsule",
        element: <NewsCapsuleHome/>,
        children: [
          {
            path: "analysis",
            element: <AnalysisPage/>
          },
          {
            path: "history",
            element: <HistoryPage/>
          }
        ]
      }
    ]
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

// Test for git
// test test test

function App() {

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default App
