import React from 'react';
import NewsCapsuleLayout from "@/pages/dashboard/news-capsule/layout";
import Dashboard from "@/pages/dashboard/news-capsule/home";
import Submit from "@/pages/dashboard/news-capsule/submit";
import Reports from "@/pages/dashboard/news-capsule/reports";

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