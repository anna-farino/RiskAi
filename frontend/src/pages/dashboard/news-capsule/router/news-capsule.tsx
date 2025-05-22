import { RouteObject } from "react-router-dom";
import NewsCapsuleLayout from "../layout";
import NewsCapsuleHome from "../home";
import Reports from "../reports";

export const newsCapsuleRouter: RouteObject = {
  path: "news-capsule",
  element: <NewsCapsuleLayout />,
  children: [
    {
      index: true,
      element: <NewsCapsuleHome />,
    },
    {
      path: "reports",
      element: <Reports />,
    },
  ],
};