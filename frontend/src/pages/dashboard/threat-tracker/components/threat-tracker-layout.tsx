import { useEffect, useState } from "react";
import { ScrapingProgressDialog } from "./scraping-progress-dialog";
import { serverUrl } from "@/utils/server-url";
import { csfrHeaderObject } from "@/utils/csrf-header";

interface ThreatTrackerLayoutProps {
  children: React.ReactNode;
}

export function ThreatTrackerLayout({ children }: ThreatTrackerLayoutProps) {
  const [isScrapingActive, setIsScrapingActive] = useState<boolean>(false);

  // Monitor scraping status to show progress dialog across all pages
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
    <>
      {children}
      
      {/* Progress dialog for scraping status - appears on all Threat Tracker pages */}
      <ScrapingProgressDialog isVisible={isScrapingActive} />
    </>
  );
}