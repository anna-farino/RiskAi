import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, LogOut, ChevronDown } from 'lucide-react';
import { Logo } from '@/components/ui/logo';
import { ModeToggle } from '@/components/theme-toggle';
import { useLogout } from '@/hooks/use-logout';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';

export function RisqHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { logout } = useLogout();
  const { data: userData } = useAuth();

  // Navigation items - these can be expanded as needed
  const navItems = [
  {
    label: "Home",
    href: "/dashboard/home",
    restricted: false,
  },
  {
    label: "News Radar",
    href: "/dashboard/news/home",
    restricted: false,
  },
  {
    label: "News Capsule",
    href: "/dashboard/capsule/home",
    restricted: false,
  },
  {
    label: "Vendor Threat",
    href: "/dashboard/vendor/home",
    restricted: true,
  },
];

  // Filter navigation items based on user permissions
  const filteredNavItems = navItems.filter(item => {
    if (userData?.permissions?.includes("permissions:edit") || !item.restricted) {
      return true;
    }
    return false;
  });

  // Handle scroll events to add background when scrolled
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Function to check if link is active
  const isActive = (path: string) => {
    return location.pathname.includes(path);
  };

  return (
    <header 
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-[64px]',
        scrolled 
          ? 'bg-slate-900/95 backdrop-blur border-b border-slate-700/50 shadow-sm' 
          : 'bg-slate-900/90 backdrop-blur'
      )}
    >
      <div className="container mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Logo and tagline */}
          <div className="flex items-center">
            <Link to="/dashboard/home" className="flex items-center">
              <Logo interactive size="md" />
            </Link>
            <div className="hidden md:block ml-3 h-6 border-l border-border"></div>
            <p className="hidden md:block ml-3 text-sm text-slate-400 italic">
              Secure your tomorrow, today.
            </p>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            <ul className="flex space-x-1 mr-4">
              {filteredNavItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'bg-primary/10 text-primary'
                        : 'text-white hover:bg-slate-700/50 hover:text-white'
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex items-center space-x-3 border-l border-border pl-3">
              <ModeToggle />
              {userData && (
                <div className="relative group">
                  <button className="flex items-center text-sm font-medium text-white rounded-full hover:bg-slate-700/50 p-1.5">
                    <div className="bg-purple-500 text-white rounded-full h-6 w-6 flex items-center justify-center mr-1">
                      {userData.email ? userData.email.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <span className="max-w-[100px] truncate hidden sm:inline-block">
                      {userData.email ? userData.email.split('@')[0] : 'User'}
                    </span>
                    <ChevronDown className="h-4 w-4 ml-1" />
                  </button>
                  <div className="absolute right-0 z-10 mt-1 w-48 origin-top-right rounded-md bg-slate-800 border border-slate-700/50 shadow-lg invisible group-hover:visible transition-all opacity-0 group-hover:opacity-100 py-1">
                    <Link
                      to="/dashboard/settings"
                      className="block px-4 py-2 text-sm text-white hover:bg-slate-700/50"
                    >
                      Settings
                    </Link>
                    <button
                      onClick={logout}
                      className="flex w-full items-center px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          </nav>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-slate-700/50 focus:outline-none"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="block h-6 w-6" />
              ) : (
                <Menu className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={cn(
          'md:hidden transition-all duration-300 overflow-hidden',
          mobileMenuOpen ? 'max-h-96 mt-3' : 'max-h-0'
        )}>
          <div className="border-t pt-3 pb-1">
            <p className="text-sm text-slate-400 italic mb-3">
              Secure your tomorrow, today.
            </p>

            <nav className="flex flex-col space-y-1">
              {filteredNavItems.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'bg-primary/10 text-primary'
                      : 'text-white hover:bg-slate-700/50 hover:text-white'
                  )}
                >
                  {item.name}
                </Link>
              ))}
              <Link
                to="/dashboard/settings"
                className={cn(
                  'px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive('/dashboard/settings')
                    ? 'bg-primary/10 text-primary'
                    : 'text-white hover:bg-slate-700/50 hover:text-white'
                )}
              >
                Settings
              </Link>

              <div className="pt-2 mt-2 border-t border-border flex justify-between items-center">
                <button
                  onClick={logout}
                  className="flex items-center px-3 py-2 rounded-md text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </button>
                <ModeToggle />
              </div>
            </nav>
          </div>
        </div>
      </div>
    </header>
  );
}