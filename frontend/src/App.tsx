import { createBrowserRouter, RouterProvider } from 'react-router-dom'
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
import NewsHome from './pages/dashboard/news/home.tsx'
import Sources from './pages/dashboard/news/sources.tsx'
import Keywords from './pages/dashboard/news/keywords.tsx'
import NewsLayout from './pages/dashboard/news/layout.tsx'

const queryClient = new QueryClient()

const router = createBrowserRouter([
  {
    path: '/',
    element: <Redirect/>
  },
  {
    path: "/login",
    element: <Login />
  },
  {
    path: "/signup",
    element: <Signup />
  },
  {
    path: "otp",
    element: <OtpPage/>
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
    ]
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
