import React from 'react';
import NewsCapsuleLayout from "../layout";
import Dashboard from "../home";
import Submit from "../submit";
import Reports from "../reports";

export const newsCapsuleRouter = {
  path: "news-capsule",
  element: <NewsCapsuleLayout />,
  children: [
    {
      path: "home",
      element: <Dashboard />,
    },
    {
      path: "submit",
      element: <Submit />,
    },
    {
      path: "reports",
      element: <Reports />,
    },
    {
      index: true,
      element: <Dashboard />,
    }
  ]
}