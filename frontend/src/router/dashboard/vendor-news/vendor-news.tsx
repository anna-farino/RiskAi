import NewsHome from "@/pages/dashboard/news-radar/home";
import Keywords from "@/pages/dashboard/news-radar/keywords";
import NewsLayout from "@/pages/dashboard/news-radar/layout";
import Sources from "@/pages/dashboard/news-radar/sources";

export const vendorNewsRouter = {
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
}
