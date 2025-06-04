import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";

const buttons = [
  {
    label: 'Home',
    url: '/dashboard/news/home'
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
  const location = useLocation().pathname.split('/')[3];
  const [isMobile, setIsMobile] = useState(false);

  // Check if we're on mobile for responsive rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div className={cn(
        "flex w-full rounded-md bg-slate-900/70 dark:bg-slate-900/70 border border-slate-700/50 backdrop-blur-sm font-light overflow-x-auto",
        isMobile 
          ? "p-2 px-3 min-h-[36px] items-center gap-x-4 text-sm"
          : "p-3 md:p-4 min-h-[38px] md:min-h-[40px] items-center gap-x-6 md:gap-x-10 text-sm md:text-base"
      )}>
        {buttons.map(button => {
          const selected = location === button.label.toLowerCase();

          return (
            <Link
              to={button.url}
              key={button.label}
              className={cn(
                "whitespace-nowrap transition-colors",
                "hover:underline", 
                selected 
                  ? "text-primary font-medium" 
                  : "text-foreground/80 hover:text-foreground"
              )} 
            >
              {button.label}
            </Link>
          );
        })}
      </div>
      <Outlet/>
    </div>
  );
}
