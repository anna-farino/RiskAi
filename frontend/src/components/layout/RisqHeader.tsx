import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Logo } from '@/components/ui/logo';
import { ModeToggle } from '@/components/theme-toggle';
import { useLogout } from '@/hooks/use-logout';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { ChevronDown, LogOut } from 'lucide-react'

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
  
  // Determine logo size based on screen width - adjusted for better quality
  const getLogoSize = () => {
    if (windowWidth < 640) return "sm";   // Mobile - smaller for better fit
    if (windowWidth < 1024) return "sm";  // Tablet - smaller for problematic mid-sized screens
    return "md";                          // Desktop - medium size for better quality/fit balance
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
        'h-[72px] md:h-[76px] lg:h-[72px]', // Variable height based on screen size
        scrolled 
          ? 'bg-black/95 backdrop-blur border-b border-[#BF00FF]/20 shadow-sm' 
          : 'bg-black/90 backdrop-blur'
      )}
    >
      <div className="container mx-auto px-4 flex items-center h-full">
        <div className="flex items-center justify-between gap-4 w-full">
          {/* Logo and tagline */}
          <div className="flex items-center">
            <Link to="/dashboard" className="flex items-center overflow-hidden my-1">
              <div className="logo-container">
                <Logo interactive animated variant="gradient" size={getLogoSize()} />
              </div>
            </Link>
            <div className="hidden md:block ml-3 h-6 border-l border-[#BF00FF]/20"></div>
            <p className="hidden md:block ml-3 text-sm text-gray-400 italic">
              Secure your tomorrow, today.
            </p>
          </div>

          {/* Spacer for layout balance */}
          <div className="flex-1"></div>
          
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
        </div>
      </div>
    </header>
  );
}
