import ThreatHome from "../home";
import Keywords from "../keywords";
import ThreatLayout from "../layout";
import Sources from "../sources";
import TechStack from "../tech-stack";

export const threatTrackerRouter = {
  path: "threat",
  element: <ThreatLayout/>,
  children: [
    {
      path: "home",
      element: <ThreatHome/>,
    },
    {
      path: "sources",
      element: <Sources/>,
    },
    {
      path: "keywords",
      element: <Keywords/>,
    },
    {
      path: "tech-stack",
      element: <TechStack/>,
    },
  ]
}