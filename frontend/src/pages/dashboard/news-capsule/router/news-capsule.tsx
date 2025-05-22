import CapsuleResearch from "../capsule-research";
import ExecutiveReporting from "../executive-reporting";
import NewsCapsuleLayout from "../layout";

export const newsCapsuleRouter = {
  path: "capsule",
  element: <NewsCapsuleLayout />,
  children: [
    {
      path: "research",
      element: <CapsuleResearch />,
    },
    {
      path: "reporting",
      element: <ExecutiveReporting />,
    },
  ]
}