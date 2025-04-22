import { ModeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useLocation, Link, useLoaderData } from "react-router-dom";
import { useLogout } from "@/hooks/use-logout";
import {
  LogOut,
  ChevronLeft,
  ChevronRight,
  Bug,
  Home,
  File,
  AppWindowIcon,
} from "lucide-react";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import UserBadgeAndDropDown from "@/pages/user-badge";

const buttons = [
  {
    label: "Home",
    path: "/dashboard/home",
    icon: Home,
    restricted: false,
  },
  {
    label: "News Radar",
    path: "/dashboard/news/home",
    icon: Home,
    restricted: false,
  },
  {
    label: "Admin",
    path: "/dashboard/admin",
    icon: File,
    restricted: true,
  },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { logout } = useLogout();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const data = useLoaderData();
  const { data: userData } = useAuth();
  
  //console.log("User data from dashboard layout", userData)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      setSidebarCollapsed(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, [data, userData]);

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {!sidebarCollapsed && isMobile && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30"
          onClick={() => setSidebarCollapsed(true)}
        />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-background transition-all duration-300",
          "md:relative md:z-0",
          sidebarCollapsed
            ? "-translate-x-full md:translate-x-0 md:w-16"
            : "translate-x-0 w-64",
        )}
      >
        <div className="flex h-14 items-center justify-center border-b border-border"></div>

        <div className="flex flex-1 flex-col justify-between">
          <div className="flex flex-col p-4 gap-y-2">
            {buttons
              .filter((button) => {
                if (
                  userData?.permissions.includes("permissions:edit") ||
                  !button.restricted
                ) {
                  return button;
                }
              })
              .map((button) => (
                <Link to={button.path} key={button.path}>
                  <Button
                    variant="default"
                    className={cn(
                      "w-full justify-start border-none bg-foreground/80 text-background hover:border-none active:border-none",
                      "active:bg-foreground hover:bg-foreground",
                      !isMobile && sidebarCollapsed && "justify-center px-0",
                    )}
                    onClick={() => {
                      if (window.innerWidth < 768) setSidebarCollapsed(true);
                    }}
                  >
                    {!isMobile && sidebarCollapsed ? (
                      <button.icon className="h-4 w-4" />
                    ) : (
                      button.label
                    )}
                  </Button>
                </Link>
              ))}
          </div>
          <div className="p-4 border-t border-border">
            <Button
              variant="link"
              className="w-full justify-start text-foreground bg-transparent"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              {!sidebarCollapsed && <span className="ml-2">Logout</span>}
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex h-14 items-center justify-between px-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="flex flex-col hover:bg-accent hover:text-accent-foreground"
            >
              {sidebarCollapsed ? (
                <ChevronRight className="h-5 w-5 text-foreground" />
              ) : (
                <ChevronLeft className="h-5 w-5 text-foreground" />
              )}
            </Button>
            <div className="flex items-center gap-4">
              <p className="hidden md:block text-sm text-foreground">
                Hello, {userData?.email}
              </p>
              <ModeToggle />
              <UserBadgeAndDropDown userData={userData} />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
