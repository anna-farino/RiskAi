import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const buttons = [
  {
    label: "Detected Threats",
    url: "/dashboard/threat/home",
  },
  {
    label: "Sources",
    url: "/dashboard/threat/sources",
  },
  {
    label: "Keywords",
    url: "/dashboard/threat/keywords",
  },
];

export default function ThreatLayout() {
  const location = useLocation().pathname.split("/")[3];
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile for responsive rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div
        className={cn(
          "flex w-full rounded-md bg-slate-900/70 dark:bg-slate-900/70 border border-slate-700/50 backdrop-blur-sm font-light overflow-x-auto",
          isMobile
            ? "p-2 px-3 min-h-[36px] items-center gap-x-4 text-sm"
            : "p-4 min-h-[40px] items-center gap-x-10",
        )}
      >
        {buttons.map((button) => {
          const selected = location === button.url.split('/').pop();

          return (
            <Link
              to={button.url}
              key={button.label}
              className={cn(
                "whitespace-nowrap transition-colors duration-200",
                selected
                  ? "text-[#00FFFF] font-medium px-2 py-1"
                  : "text-foreground/80 hover:text-[#00FFFF] hover:bg-gradient-to-r hover:from-[#BF00FF]/10 hover:to-[#00FFFF]/5 px-2 py-1 rounded-md",
              )}
            >
              {button.label}
            </Link>
          );
        })}
      </div>
      <Outlet />
    </div>
  );
}
