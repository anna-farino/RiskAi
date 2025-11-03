import TechStack from "@/pages/dashboard/tech-stack/tech-stack";
import TechStackLayout from "@/pages/dashboard/tech-stack/layout";

export const techStackRouter = {
  path: "tech-stack",
  element: <TechStackLayout/>,
  children: [
    {
      index: true,
      element: <TechStack/>,
    },
  ]
}
