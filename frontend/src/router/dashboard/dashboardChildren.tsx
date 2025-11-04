import { newsRadarRouter } from '../../pages/dashboard/news-radar/router/news-radar.tsx'
import { threatTrackerRouter } from '../../pages/dashboard/threat-tracker/router/threat-tracker.tsx'
import { newsCapsuleRouter } from '../../pages/dashboard/news-capsule/router/news-capsule.tsx'
import { techStackRouter } from '../../pages/dashboard/tech-stack/router/tech-stack.tsx'
import { dashboardRouter } from './dashboardRouter.tsx'


export const dashboardChildren = [

  ...dashboardRouter,

  newsRadarRouter,

  threatTrackerRouter,

  newsCapsuleRouter,

  techStackRouter,

]
