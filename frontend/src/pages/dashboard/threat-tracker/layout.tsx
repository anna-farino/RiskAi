import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ScrapingProgressDialog } from "./components/scraping-progress-dialog";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";

const buttons = [
  {
    label: 'Home',
    url: '/dashboard/threat/home'
  },
  {
    label: 'Keywords',
    url: '/dashboard/threat/keywords'
  },
  {
    label: 'Sources',
    url: '/dashboard/threat/sources'
  },
]

export default function ThreatLayout() {
  const location = useLocation().pathname.split('/')[3];
  const [isMobile, setIsMobile] = useState(false);
  const [isScrapingActive, setIsScrapingActive] = useState<boolean>(false);

  // Check if we're on mobile for responsive rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Monitor scraping status to show progress dialog across all Threat Tracker pages
  useEffect(() => {
    const checkScrapingStatus = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/threat-tracker/scraping-status`, {
          method: 'GET',
          credentials: 'include',
          headers: {
            ...csfrHeaderObject(),
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsScrapingActive(data.isActive);
        }
      } catch (error) {
        console.error('Error checking scraping status:', error);
      }
    };

    // Check immediately
    checkScrapingStatus();

    // Then check every 2 seconds
    const interval = setInterval(checkScrapingStatus, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div className={cn(
        "flex w-full rounded-md bg-slate-900/70 dark:bg-slate-900/70 border border-slate-700/50 backdrop-blur-sm font-light overflow-x-auto",
        isMobile 
          ? "p-2 px-3 min-h-[36px] items-center gap-x-4 text-sm"
          : "p-4 min-h-[40px] items-center gap-x-10"
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
                  ? "text-[#BF00FF] font-medium" 
                  : "text-foreground/80 hover:text-foreground"
              )} 
            >
              {button.label}
            </Link>
          );
        })}
      </div>
      <Outlet/>
      
      {/* Progress dialog for scraping status - appears on all Threat Tracker pages */}
      <ScrapingProgressDialog isVisible={isScrapingActive} />
    </div>
  );
}