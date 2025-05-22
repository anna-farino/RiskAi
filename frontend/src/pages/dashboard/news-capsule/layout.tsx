import { Outlet } from "react-router-dom";
import { RisqContainer } from "@/components/ui/risq-container";
import { Timer } from "lucide-react";
import { NavLink } from "react-router-dom";

export default function NewsCapsuleLayout() {
  return (
    <RisqContainer variant="default" width="full">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Timer className="w-10 h-10 text-primary" />
          <h1 className="text-3xl font-bold">News Capsule</h1>
        </div>
        <p className="text-muted-foreground">
          Capture and digest news stories in manageable, time-based capsules
        </p>
      </div>

      <div className="mb-8 border-b pb-2">
        <nav className="flex gap-4">
          <NavLink
            to="/dashboard/capsule/home"
            className={({ isActive }) =>
              isActive
                ? "font-medium text-primary border-b-2 border-primary pb-2"
                : "text-muted-foreground hover:text-foreground transition-colors pb-2"
            }
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/dashboard/capsule/history"
            className={({ isActive }) =>
              isActive
                ? "font-medium text-primary border-b-2 border-primary pb-2"
                : "text-muted-foreground hover:text-foreground transition-colors pb-2"
            }
          >
            History
          </NavLink>
          <NavLink
            to="/dashboard/capsule/preferences"
            className={({ isActive }) =>
              isActive
                ? "font-medium text-primary border-b-2 border-primary pb-2"
                : "text-muted-foreground hover:text-foreground transition-colors pb-2"
            }
          >
            Preferences
          </NavLink>
        </nav>
      </div>

      <Outlet />
    </RisqContainer>
  );
}