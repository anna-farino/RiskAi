import { Outlet, useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useState, useEffect } from 'react';

export default function NewsCapsuleLayout() {
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(false);
  
  // Check if we're on mobile for responsive rendering
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  
  const buttons = [
    {
      label: 'Research',
      url: '/dashboard/capsule/research'
    },
    {
      label: 'Reporting',
      url: '/dashboard/capsule/reporting'
    }
  ];
  
  const currentPage = location.pathname.split('/')[3] || '';

  return (
    <div className="flex flex-col w-full h-full gap-y-4">
      <div className="flex flex-col gap-3 sm:gap-4 mb-4">
        <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white">
          News Capsule
        </h1>
        <p className="text-base sm:text-lg text-slate-300 max-w-3xl">
          Research, analyze, and create executive reports from news articles
        </p>
      </div>

      <div className={cn(
        "flex w-full rounded-md bg-slate-900/70 dark:bg-slate-900/70 border border-slate-700/50 backdrop-blur-sm font-light overflow-x-auto",
        isMobile 
          ? "p-2 px-3 min-h-[36px] items-center gap-x-4 text-sm"
          : "p-4 min-h-[40px] items-center gap-x-10"
      )}>
        {buttons.map(button => {
          const selected = currentPage === button.label.toLowerCase();
          return (
            <Link
              key={button.label}
              to={button.url}
              className={cn(
                "transition-colors whitespace-nowrap",
                selected 
                  ? "text-white font-medium" 
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {button.label}
            </Link>
          );
        })}
      </div>
      
      <div className="flex-1 mt-4">
        <Outlet />
      </div>
    </div>
  );
}