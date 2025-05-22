import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Newspaper, 
  Search, 
  Radar, 
  FileText, 
  Settings, 
  AlertTriangle, 
  ChevronDown, 
  ChevronUp,
  Shield,
  ShieldAlert,
  Menu,
  X
} from 'lucide-react';

import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetClose
} from "@/components/ui/sheet";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import { Button } from "@/components/ui/button";
import { cn } from '@/lib/utils';

type NavItemProps = {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  active?: boolean;
  isChild?: boolean;
};

type NavGroupProps = {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
};

const NavItem = ({ href, icon, children, active, isChild = false }: NavItemProps) => (
  <Link
    to={href}
    className={cn(
      "flex items-center gap-3 rounded-md py-2.5 text-sm transition-colors",
      isChild 
        ? "ml-6 pl-4 border-l border-[#BF00FF]/20 relative" 
        : "px-3",
      active 
        ? isChild
          ? "bg-gradient-to-r from-[#BF00FF]/20 to-[#00FFFF]/5 text-white shadow-inner" 
          : "bg-gradient-to-r from-[#BF00FF]/30 to-[#00FFFF]/10 text-white shadow-inner"
        : "text-white hover:text-white hover:bg-gradient-to-r hover:from-[#BF00FF]/20 hover:to-[#00FFFF]/5"
    )}
  >
    {isChild && (
      <div className="absolute left-0 top-0 w-[1px] h-full bg-gradient-to-b from-[#BF00FF]/30 to-[#00FFFF]/30"></div>
    )}
    <div className="relative">
      {icon}
    </div>
    <span className={isChild ? "font-normal" : "font-medium"}>{children}</span>
  </Link>
);

const NavGroup = ({ title, children, defaultOpen = false }: NavGroupProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <Button 
          variant="ghost" 
          className="flex w-full items-center justify-between py-1 px-2 text-sm text-gray-400 hover:text-white"
        >
          <span className="font-medium">{title}</span>
          {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-1 pt-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
};

export const MainNavigation = ({ className }: { className?: string }) => {
  const location = useLocation();
  const pathname = location.pathname;

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    
    // Special case for threat tracker
    if (path === '/dashboard/threat/home' && pathname.startsWith('/dashboard/threat')) {
      return true;
    }
    
    return pathname.startsWith(path) && path !== '/dashboard';
  };

  const NavigationContent = () => (
    <div className="flex flex-col gap-2 py-2">
      <div className="px-3 py-2">
        <h2 className="mb-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] bg-clip-text text-transparent">
          Your Toolkit
        </h2>
        <p className="text-sm text-gray-400 leading-tight">
          Access your dashboard, monitoring tools, and security alerts from this centralized navigation menu.
        </p>
      </div>

      <div className="px-3 py-1 space-y-1">
        <NavItem 
          href="/dashboard" 
          icon={<LayoutDashboard size={18} className="text-[#00FFFF]" />} 
          active={pathname === '/dashboard'}
        >
          Dashboard
        </NavItem>
        
        {/* News Radar parent */}
        <NavItem 
          href="/dashboard/news/home" 
          icon={<Newspaper size={20} className="text-[#BF00FF]" />} 
          active={isActive('/dashboard/news/home')}
        >
          News Radar
        </NavItem>
        
        {/* News Radar children */}
        <NavItem 
          href="/dashboard/news/sources" 
          icon={<Search size={16} className="text-[#BF00FF]/80" />} 
          active={isActive('/dashboard/news/sources')}
          isChild={true}
        >
          News Sources
        </NavItem>
        
        <NavItem 
          href="/dashboard/news/keywords" 
          icon={<AlertTriangle size={16} className="text-[#BF00FF]/80" />} 
          active={isActive('/dashboard/news/keywords')}
          isChild={true}
        >
          Keywords
        </NavItem>
        
        {/* Threat Tracker parent */}
        <NavItem 
          href="/dashboard/threat/home" 
          icon={<ShieldAlert size={20} className="text-[#00FFFF]" />}
          active={isActive('/dashboard/threat/home')}
        >
          Threat Tracker
        </NavItem>
        
        {/* Threat Tracker children */}
        <NavItem 
          href="/dashboard/threat/sources" 
          icon={<Search size={16} className="text-[#00FFFF]/80" />} 
          active={isActive('/dashboard/threat/sources')}
          isChild={true}
        >
          Sources
        </NavItem>
        
        <NavItem 
          href="/dashboard/threat/keywords" 
          icon={<AlertTriangle size={16} className="text-[#00FFFF]/80" />} 
          active={isActive('/dashboard/threat/keywords')}
          isChild={true}
        >
          Keywords
        </NavItem>
      </div>

      <div className="px-3 py-1 space-y-1">
        {/* News Capsule parent */}
        <NavItem 
          href="/dashboard/capsule/home" 
          icon={<Radar size={20} className="text-[#00FFFF]" />} 
          active={isActive('/dashboard/capsule/home')}
        >
          News Capsule
        </NavItem>
        
        {/* News Capsule child */}
        <NavItem 
          href="/dashboard/capsule/reports" 
          icon={<FileText size={16} className="text-[#00FFFF]/80" />} 
          active={isActive('/dashboard/capsule/reports')}
          isChild={true}
        >
          Reports
        </NavItem>
        
        <div className="mt-4"></div>
        
        <NavItem 
          href="/dashboard/settings" 
          icon={<Settings size={18} className="text-[#00FFFF]" />} 
          active={isActive('/dashboard/settings')}
        >
          Settings
        </NavItem>
      </div>
    </div>
  );

  return (
    <div className={className}>
      <NavigationContent />
    </div>
  );
};

export const MobileNavigation = () => {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  // Close sheet when location changes (i.e., when a link is clicked)
  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <div className="md:hidden">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <div className="p-[1px] bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] rounded-[5px]">
            <Button 
              variant="ghost" 
              className="p-[5px] text-white bg-black border-0 hover:border-0 hover:bg-black rounded-[4px] transition-colors"
            >
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 border-[#BF00FF]/20 bg-black/95 p-0">
          <div className="pt-2"> {/* Add some top padding for better spacing */}
            <div className="flex flex-col gap-2 py-2">
              <div className="px-3 py-2">
                <h2 className="mb-2 text-lg font-semibold tracking-tight bg-gradient-to-r from-[#BF00FF] to-[#00FFFF] bg-clip-text text-transparent">
                  Your Toolkit
                </h2>
                <p className="text-sm text-gray-400 leading-tight">
                  Access your dashboard, monitoring tools, and security alerts from this centralized navigation menu.
                </p>
              </div>

              <div className="px-3 py-1 space-y-1">
                <NavItem 
                  href="/dashboard" 
                  icon={<LayoutDashboard size={18} className="text-[#00FFFF]" />} 
                  active={location.pathname === '/dashboard'}
                >
                  Dashboard
                </NavItem>
                
                {/* News Radar parent */}
                <NavItem 
                  href="/dashboard/news/home" 
                  icon={<Newspaper size={20} className="text-[#BF00FF]" />} 
                  active={location.pathname.startsWith('/dashboard/news')}
                >
                  News Radar
                </NavItem>
                
                {/* News Radar children */}
                <NavItem 
                  href="/dashboard/news/sources" 
                  icon={<Search size={16} className="text-[#BF00FF]/80" />}
                  active={location.pathname.includes('/dashboard/news/sources')}
                  isChild={true}
                >
                  News Sources
                </NavItem>
                
                <NavItem 
                  href="/dashboard/news/keywords" 
                  icon={<AlertTriangle size={16} className="text-[#BF00FF]/80" />}
                  active={location.pathname.includes('/dashboard/news/keywords')}
                  isChild={true}
                >
                  Keywords
                </NavItem>
                
                {/* Threat Tracker parent */}
                <NavItem 
                  href="/dashboard/threat/home" 
                  icon={<ShieldAlert size={20} className="text-[#00FFFF]" />}
                  active={location.pathname.startsWith('/dashboard/threat')}
                >
                  Threat Tracker
                </NavItem>
                
                {/* Threat Tracker children */}
                <NavItem 
                  href="/dashboard/threat/sources" 
                  icon={<Search size={16} className="text-[#00FFFF]/80" />}
                  active={location.pathname.includes('/dashboard/threat/sources')}
                  isChild={true}
                >
                  Sources
                </NavItem>
                
                <NavItem 
                  href="/dashboard/threat/keywords" 
                  icon={<AlertTriangle size={16} className="text-[#00FFFF]/80" />}
                  active={location.pathname.includes('/dashboard/threat/keywords')}
                  isChild={true}
                >
                  Keywords
                </NavItem>

                {/* News Capsule parent */}
                <NavItem 
                  href="/dashboard/capsule/home" 
                  icon={<Radar size={20} className="text-[#00FFFF]" />} 
                  active={location.pathname.startsWith('/dashboard/capsule')}
                >
                  News Capsule
                </NavItem>
                
                {/* News Capsule child */}
                <NavItem 
                  href="/dashboard/capsule/reports" 
                  icon={<FileText size={16} className="text-[#00FFFF]/80" />}
                  active={location.pathname.includes('/dashboard/capsule/reports')}
                  isChild={true}
                >
                  Reports
                </NavItem>
                
                <NavItem 
                  href="/dashboard/settings" 
                  icon={<Settings size={18} className="text-[#00FFFF]" />} 
                  active={location.pathname.startsWith('/dashboard/settings')}
                >
                  Settings
                </NavItem>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};