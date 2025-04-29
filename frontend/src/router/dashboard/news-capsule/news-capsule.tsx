import NewsCapsule from "@/pages/dashboard/news-capsule/news-capsule-new";
import Reports from "@/pages/dashboard/news-capsule/reports";
import CapsuleLayout from "@/pages/dashboard/news-capsule/layout";

export const newsCapsuleRouter = {
  path: "capsule",
  element: <CapsuleLayout/>,
  children: [
    {
      path: "home",
      element: <NewsCapsule/>,
    },
    {
      path: "reports",
      element: <Reports/>,
    },
  ]
}
