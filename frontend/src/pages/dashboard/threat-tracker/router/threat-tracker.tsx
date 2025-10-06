import ThreatHome from "../home";
import Threats from "../threats";
import ThreatLayout from "../layout";
import Sources from "../sources";

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
      path: "threats",
      element: <Threats/>,
    },
  ]
}