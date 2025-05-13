import { newsCapsuleRouter } from '../../pages/dashboard/news-capsule/router/news-capsule.tsx'
import { newsRadarRouter } from '../../pages/dashboard/news-radar/router/news-radar.tsx'
import { dashboardRouter } from './dashboardRouter.tsx'


export const dashboardChildren = [

  ...dashboardRouter,

  newsCapsuleRouter,

  newsRadarRouter,

]
