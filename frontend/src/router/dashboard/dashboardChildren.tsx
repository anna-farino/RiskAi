import { newsCapsuleRouter } from './news-capsule/news-capsule.tsx'
import { newsRadarRouter } from './news-radar/news-radar.tsx'
import { vendorNewsRouter } from './vendor-news/vendor-news.tsx'
import { dashboardRouter } from './dashboardRouter.tsx'


export const dashboardChildren = [

  ...dashboardRouter,

  newsCapsuleRouter,

  newsRadarRouter,

  vendorNewsRouter,
]
