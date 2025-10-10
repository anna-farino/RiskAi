import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const buttons = [
  {
    label: "Radar Articles",
    url: "/dashboard/news/home",
  },
  {
    label: 'Keywords',
    url: '/dashboard/news/keywords'
  },
  {
    label: 'Sources',
    url: '/dashboard/news/sources'
  },
]

export default function NewsLayout() {
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
    <div className="flex flex-col w-full h-full gap-y-2">
      {/* Page Title Tile */}
      <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md p-4">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-wider relative">
              <span className="text-white">
                News Radar
              </span>
            </h1>
            <p className="text-muted-foreground max-w-3xl">
              AI-powered news aggregation and intelligent content analysis.
            </p>
          </div>
        </div>
      </div>

      {/* Secondary Navigation */}
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
