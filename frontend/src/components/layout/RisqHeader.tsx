import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/logo';
import { ModeToggle } from '@/components/theme-toggle';
import { useLogout } from '@/hooks/use-logout';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { ChevronDown, LogOut, Menu } from 'lucide-react';
import { MobileNavigation } from './MainNavigation';

export function RisqHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [windowWidth, setWindowWidth] = useState<number>(typeof window !== 'undefined' ? window.innerWidth : 1024);
  const { logout } = useLogout();
  const { data: userData } = useAuth();
  
  // Add window resize listener
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // Determine logo size based on screen width - increased for more prominence
  const getLogoSize = () => {
    if (windowWidth < 640) return "lg";   // Mobile - increased to large (40px) for better visibility
    if (windowWidth < 1024) return "lg";  // Tablet - same large size for consistency
    return "xl";                          // Desktop - extra large for maximum prominence
  };

  // Handle scroll events to add background when scrolled
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        'h-[88px] md:h-[96px] lg:h-[100px]', // Optimized height for mobile logo alignment
        scrolled 
          ? 'bg-black/95 backdrop-blur border-b border-[#BF00FF]/20 shadow-sm' 
          : 'bg-black/90 backdrop-blur'
      )}
    >
      <div className="w-full flex items-center h-full">
        {/* Logo and tagline as a fixed unit on the left side */}
        <div className="flex flex-col items-start justify-center h-full pl-4 md:pl-6 lg:pl-[18px]">
          <div className="mt-0 sm:mt-1">
            <Link to="/dashboard" className="group block">
              <div className="logo-container relative">
                <Logo interactive animated variant="gradient" size={getLogoSize()} />
              </div>
            </Link>
          </div>
          <div className="h-3 sm:h-4"></div> {/* Increased spacer on mobile for better spacing */}
          <p className="block text-sm sm:text-xs text-white font-light italic tracking-wide ml-0.5 sm:ml-1 leading-tight sm:leading-normal opacity-90">
            AI-Powered Risk Intelligence
          </p>
        </div>
        
        {/* Rest of the header in a separate container */}
        <div className="flex items-center justify-end gap-2 flex-1 pr-4 md:pr-6 lg:pr-8">
          
          {/* User account and theme toggle */}
          <div className="flex items-center space-x-3 border-l border-[#BF00FF]/20 pl-3">
            <ModeToggle />
            {userData && (
              <div className="relative group">
                <button className="flex items-center text-sm font-medium text-white rounded-full hover:bg-[#BF00FF]/10 p-1.5">
                  <div className="bg-[#BF00FF]/50 text-white rounded-full h-6 w-6 flex items-center justify-center mr-1">
                    {userData.email ? userData.email.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="max-w-[100px] truncate hidden sm:inline-block">
                    {userData.email ? userData.email.split('@')[0] : 'User'}
                  </span>
                  <ChevronDown className="h-4 w-4 ml-1" />
                </button>
                <div className="absolute right-0 z-10 mt-1 w-48 origin-top-right rounded-md bg-black border border-[#BF00FF]/20 shadow-lg invisible group-hover:visible transition-all opacity-0 group-hover:opacity-100 py-1">
                  <Link
                    to="/dashboard/settings"
                    className="block px-4 py-2 text-sm text-white hover:bg-[#BF00FF]/10"
                  >
                    Settings
                  </Link>
                  <button
                    onClick={logout}
                    className="flex w-full items-center px-4 py-2 text-sm text-[#00FFFF] hover:bg-[#00FFFF]/10"
                  >
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
          
          {/* Mobile navigation - repositioned to far right */}
          <div className="flex items-center md:hidden ml-2 pl-2 border-l border-[#BF00FF]/20">
            <MobileNavigation />
          </div>
        </div>
      </div>
    </header>
  );
}
