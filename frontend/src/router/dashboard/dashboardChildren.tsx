import { newsRadarRouter } from '../../pages/dashboard/news-radar/router/news-radar.tsx'
import { threatTrackerRouter } from '../../pages/dashboard/threat-tracker/router/threat-tracker.tsx'
import { dashboardRouter } from './dashboardRouter.tsx'


export const dashboardChildren = [

  ...dashboardRouter,

  newsRadarRouter,
  
  threatTrackerRouter,

]
