import Settings from '../../pages/dashboard/Settings.tsx'
import LiveLogs from '../../pages/dashboard/LiveLogs.tsx'
import WidgetDashboard from '@/pages/Dashboard.tsx'
import Admin from '@/pages/dashboard/Admin.tsx'

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
    path: "dev/live-logs",
    element: <LiveLogs />
  },
  {
    path: "admin",
    element: <Admin/>,
  },
]
