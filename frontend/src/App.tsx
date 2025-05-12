import { RouterProvider } from 'react-router-dom'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { ThemeProvider } from './components/theme-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from '@/components/ui/toaster'
import { router } from './router/router'

//test for demo

// NEW COMMENT
const queryClient = new QueryClient()

export default function App() {
  
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <RouterProvider router={router} />
        <Toaster />
      </ThemeProvider>
      {
        true && <ReactQueryDevtools position='right'/> // change to "false" to hide//
      }
    </QueryClientProvider>
  )
}

