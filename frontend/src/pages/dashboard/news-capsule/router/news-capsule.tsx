import NewsCapsuleHome from "@/pages/dashboard/news-capsule/home";
import NewsCapsuleHistory from "@/pages/dashboard/news-capsule/history";
import NewsCapsulePreferences from "@/pages/dashboard/news-capsule/preferences";
import NewsCapsuleLayout from "@/pages/dashboard/news-capsule/layout";

export const newsCapsuleRouter = {
  path: "capsule",
  element: <NewsCapsuleLayout />,
  children: [
    {
      path: "home",
      element: <NewsCapsuleHome />,
    },
    {
      path: "history",
      element: <NewsCapsuleHistory />,
    },
    {
      path: "preferences",
      element: <NewsCapsulePreferences />,
    },
  ]
}