import Home from "../home";
import Research from "../research";
import Reports from "../reports";
import NewsCapsuleLayout from "../layout";

export const newsCapsuleRouter = {
  path: "news-capsule",
  element: <NewsCapsuleLayout/>,
  children: [
    {
      path: "home",
      element: <Home/>,
    },
    {
      path: "research",
      element: <Research/>,
    },
    {
      path: "reports",
      element: <Reports/>,
    },
  ]
}
