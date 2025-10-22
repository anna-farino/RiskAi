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
  X,
  Terminal
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
import { useLiveLogsPermission } from '@/hooks/use-live-logs-permission';
import { useAuth } from '@/hooks/use-auth';

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
      "flex items-center gap-3 rounded-md py-2.5 text-sm transition-all duration-300",
      isChild 
        ? "ml-4 mr-2 px-3 bg-gradient-to-b backdrop-blur-sm border shadow-sm" 
        : "px-3 bg-gradient-to-b backdrop-blur-sm border shadow-sm",
      active 
        ? isChild
          ? "from-[#300A45]/60 to-black/60 border-[#BF00FF]/40 text-white shadow-lg shadow-[#BF00FF]/10" 
          : "from-[#300A45]/80 to-black/80 border-[#BF00FF]/30 text-white shadow-lg shadow-[#BF00FF]/15"
        : isChild
          ? "from-slate-900/30 to-slate-800/20 border-slate-700/30 text-gray-300 hover:text-white hover:from-[#300A45]/40 hover:to-black/40 hover:border-[#BF00FF]/25 hover:shadow-md hover:shadow-[#BF00FF]/5"
          : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#BF00FF]/30 hover:shadow-lg hover:shadow-[#BF00FF]/10"
    )}
  >
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
          className={cn(
            "flex w-full items-center justify-between py-2 px-3 text-sm transition-all duration-300 rounded-md",
            "bg-gradient-to-b from-slate-900/20 to-slate-800/10 backdrop-blur-sm border border-slate-700/20 shadow-sm",
            "text-gray-400 hover:text-[#BF00FF] hover:from-[#300A45]/40 hover:to-black/40 hover:border-[#BF00FF]/25 hover:shadow-md hover:shadow-[#BF00FF]/5"
          )}
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
  const liveLogsPermission = useLiveLogsPermission();
  const userData = useAuth();
  console.log("From Main Navigation. UserData: ", userData.data)

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    
    // Exact match for parent navigation items when on sub-pages
    if (path.endsWith('/home') && pathname.startsWith(path.replace('/home', ''))) {
      return pathname === path;
    }
    
    return pathname.startsWith(path) && path !== '/dashboard';
  };

  // Check if user is on any News Radar page for auto-expand
  const isOnNewsRadarPage = pathname.startsWith('/dashboard/news');
  
  // Check if user is on any Threat Tracker page for auto-expand
  const isOnThreatTrackerPage = pathname.startsWith('/dashboard/threat');
  
  // Check if user is on any News Capsule page for auto-expand
  const isOnNewsCapsulePage = pathname.startsWith('/dashboard/news-capsule');
  
  // State for News Radar collapse/expand with smart defaults
  const [newsRadarExpanded, setNewsRadarExpanded] = useState(isOnNewsRadarPage);
  
  // State for Threat Tracker collapse/expand with smart defaults
  const [threatTrackerExpanded, setThreatTrackerExpanded] = useState(isOnThreatTrackerPage);
  
  // State for News Capsule collapse/expand with smart defaults
  const [newsCapsuleExpanded, setNewsCapsuleExpanded] = useState(isOnNewsCapsulePage);
  
  // Auto-expand when navigating to News Radar pages
  useEffect(() => {
    if (isOnNewsRadarPage) {
      setNewsRadarExpanded(true);
    }
  }, [isOnNewsRadarPage]);
  
  // Auto-expand when navigating to Threat Tracker pages
  useEffect(() => {
    if (isOnThreatTrackerPage) {
      setThreatTrackerExpanded(true);
    }
  }, [isOnThreatTrackerPage]);
  
  // Auto-expand when navigating to News Capsule pages
  useEffect(() => {
    if (isOnNewsCapsulePage) {
      setNewsCapsuleExpanded(true);
    }
  }, [isOnNewsCapsulePage]);

  const NavigationContent = () => (
    <div className="flex flex-col gap-2 py-2">
      <div className="px-3 py-2">
        <h2 className="mb-2 text-lg font-semibold tracking-tight text-white">
          Your RisqAi Toolkit
        </h2>
        <p className="text-sm text-gray-400 leading-tight">
          Access your dashboard, monitoring tools, and security alerts from this centralized navigation menu.
        </p>
      </div>

      <div className="px-3 py-1 space-y-2">
        <NavItem 
          href="/dashboard" 
          icon={<LayoutDashboard size={18} className="text-white" />} 
          active={pathname === '/dashboard'}
        >
          Dashboard
        </NavItem>
        
        {/* News Radar collapsible section */}
        <div className="space-y-1">
          <Collapsible open={newsRadarExpanded} onOpenChange={setNewsRadarExpanded} className="w-full">
            <div className="flex items-center">
              <div className={cn(
                "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                isActive('/dashboard/news/home')
                  ? "from-[#300A45]/80 to-black/80 border-[#BF00FF]/30 text-white shadow-lg shadow-[#BF00FF]/15"
                  : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#BF00FF]/30 hover:shadow-lg hover:shadow-[#BF00FF]/10"
              )}>
                <Link to="/dashboard/news/home" className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <Newspaper size={20} className="text-[#BF00FF]" />
                  </div>
                  <span className="font-medium">News Radar</span>
                </Link>
                <CollapsibleTrigger asChild>
                  <button className="text-gray-400 group-hover:text-[#BF00FF] transition-colors p-1 hover:bg-[#BF00FF]/10 rounded">
                    {newsRadarExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </CollapsibleTrigger>
              </div>
            </div>
            
            <CollapsibleContent 
              className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
              style={{
                WebkitOverflowScrolling: 'touch',
                willChange: 'height',
                transform: 'translateZ(0)' // Force hardware acceleration
              }}
            >
              <NavItem 
                href="/dashboard/news/keywords" 
                icon={<AlertTriangle size={16} className="text-[#BF00FF]/60" />} 
                active={isActive('/dashboard/news/keywords')}
                isChild={true}
              >
                Keywords
              </NavItem>
              
              <NavItem 
                href="/dashboard/news/sources" 
                icon={<Search size={16} className="text-[#BF00FF]/60" />} 
                active={isActive('/dashboard/news/sources')}
                isChild={true}
              >
                Sources
              </NavItem>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        {/* Threat Tracker collapsible section */}
        <div className="space-y-1">
          <Collapsible open={threatTrackerExpanded} onOpenChange={setThreatTrackerExpanded} className="w-full">
            <div className="flex items-center">
              <div className={cn(
                "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                isActive('/dashboard/threat/home')
                  ? "from-[#300A45]/80 to-black/80 border-[#00FFFF]/30 text-white shadow-lg shadow-[#00FFFF]/15"
                  : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#00FFFF]/30 hover:shadow-lg hover:shadow-[#00FFFF]/10"
              )}>
                <Link to="/dashboard/threat/home" className="flex items-center gap-3 flex-1">
                  <div className="relative">
                    <ShieldAlert size={20} className="text-[#00FFFF]" />
                  </div>
                  <span className="font-medium">Threat Tracker</span>
                </Link>
                <CollapsibleTrigger asChild>
                  <button className="text-gray-400 group-hover:text-[#00FFFF] transition-colors p-1 hover:bg-[#00FFFF]/10 rounded border border-transparent hover:border-[#00FFFF]/40">
                    {threatTrackerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </CollapsibleTrigger>
              </div>
            </div>
            
            <CollapsibleContent 
              className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
              style={{
                WebkitOverflowScrolling: 'touch',
                willChange: 'height',
                transform: 'translateZ(0)' // Force hardware acceleration
              }}
            >
              <NavItem 
                href="/dashboard/threat/keywords" 
                icon={<AlertTriangle size={16} className="text-[#00FFFF]/60" />} 
                active={isActive('/dashboard/threat/keywords')}
                isChild={true}
              >
                Keywords
              </NavItem>
              
              <NavItem 
                href="/dashboard/threat/sources" 
                icon={<Search size={16} className="text-[#00FFFF]/60" />} 
                active={isActive('/dashboard/threat/sources')}
                isChild={true}
              >
                Sources
              </NavItem>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Report Center collapsible section - Admin Only */}
          <div className="space-y-1">
            <Collapsible open={newsCapsuleExpanded} onOpenChange={setNewsCapsuleExpanded} className="w-full">
              <div className="flex items-center">
                <div className={cn(
                  "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                  "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                  isActive('/dashboard/news-capsule/research')
                    ? "from-[#300A45]/80 to-black/80 border-[#BF00FF]/30 text-white shadow-lg shadow-[#BF00FF]/15"
                    : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#BF00FF]/30 hover:shadow-lg hover:shadow-[#BF00FF]/10"
                )}>
                  <Link to="/dashboard/news-capsule/research" className="flex items-center gap-3 flex-1">
                    <div className="relative">
                      <Search size={20} className="text-[#BF00FF]" />
                    </div>
                    <span className="font-medium">Report Center</span>
                  </Link>
                  <CollapsibleTrigger asChild>
                    <button className="text-gray-400 group-hover:text-[#BF00FF] transition-colors p-1 hover:bg-[#BF00FF]/10 rounded border border-transparent hover:border-[#BF00FF]/40">
                      {newsCapsuleExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </CollapsibleTrigger>
                </div>
              </div>

              <CollapsibleContent
                className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
                style={{
                  WebkitOverflowScrolling: 'touch',
                  willChange: 'height',
                  transform: 'translateZ(0)' // Force hardware acceleration
                }}
              >
              <NavItem 
                href="/dashboard/news-capsule/reports" 
                icon={<FileText size={16} className="text-[#BF00FF]/60" />} 
                active={isActive('/dashboard/news-capsule/reports')}
                isChild={true}
              >
                Current Report
              </NavItem>
              
              <NavItem 
                href="/dashboard/news-capsule/home" 
                icon={<Radar size={16} className="text-[#BF00FF]/60" />} 
                active={isActive('/dashboard/news-capsule/home')}
                isChild={true}
              >
                Reports Library
              </NavItem>
            </CollapsibleContent>
          </Collapsible>
        </div>
        
        <NavItem
          href="/dashboard/settings"
          icon={<Settings size={18} className="text-gray-300" />}
          active={isActive('/dashboard/settings')}
        >
          Settings
        </NavItem>

        {/* Live Logs - Available when user has permission */}
        {liveLogsPermission.available && liveLogsPermission.hasPermission && (
          <NavItem
            href="/dashboard/dev/live-logs"
            icon={<Terminal size={18} className="text-orange-400" />}
            active={isActive('/dashboard/dev/live-logs')}
          >
            Live Logs
          </NavItem>
        )}
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
  const liveLogsPermission = useLiveLogsPermission();
  const { data: userData } = useAuth();

  // Check if user is on any News Radar page for auto-expand
  const isOnNewsRadarPage = location.pathname.startsWith('/dashboard/news');
  
  // Check if user is on any Threat Tracker page for auto-expand
  const isOnThreatTrackerPage = location.pathname.startsWith('/dashboard/threat');
  
  // Check if user is on any News Capsule page for auto-expand
  const isOnNewsCapsulePage = location.pathname.startsWith('/dashboard/news-capsule');
  
  // State for News Radar collapse/expand with smart defaults
  const [newsRadarExpanded, setNewsRadarExpanded] = useState(isOnNewsRadarPage);
  
  // State for Threat Tracker collapse/expand with smart defaults
  const [threatTrackerExpanded, setThreatTrackerExpanded] = useState(isOnThreatTrackerPage);
  
  // State for News Capsule collapse/expand with smart defaults
  const [newsCapsuleExpanded, setNewsCapsuleExpanded] = useState(isOnNewsCapsulePage);
  
  // Auto-expand when navigating to News Radar pages
  useEffect(() => {
    if (isOnNewsRadarPage) {
      setNewsRadarExpanded(true);
    }
  }, [isOnNewsRadarPage]);
  
  // Auto-expand when navigating to Threat Tracker pages
  useEffect(() => {
    if (isOnThreatTrackerPage) {
      setThreatTrackerExpanded(true);
    }
  }, [isOnThreatTrackerPage]);
  
  // Auto-expand when navigating to News Capsule pages
  useEffect(() => {
    if (isOnNewsCapsulePage) {
      setNewsCapsuleExpanded(true);
    }
  }, [isOnNewsCapsulePage]);

  // Close sheet when location changes (i.e., when a link is clicked)
  useEffect(() => {
    setOpen(false);
  }, [location]);

  return (
    <div className="lg:hidden">
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
        <SheetContent side="left" className="w-72 border-[#BF00FF]/20 bg-black/95 p-0 flex flex-col">
          <div className="flex-shrink-0 pt-2 pb-4"> {/* Fixed header section */}
            <div className="px-3 py-2">
              <h2 className="mb-2 text-lg font-semibold tracking-tight text-white">
                Your RisqAi Toolkit
              </h2>
              <p className="text-sm text-gray-400 leading-tight">
                Access your dashboard, monitoring tools, and security alerts from this centralized navigation menu.
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0" style={{
            WebkitOverflowScrolling: 'touch',
            scrollbarWidth: 'thin',
            scrollbarColor: '#BF00FF40 transparent'
          }}>
            <div className="px-3 py-1 space-y-2 pb-6">
                <NavItem 
                  href="/dashboard" 
                  icon={<LayoutDashboard size={18} className="text-white" />} 
                  active={location.pathname === '/dashboard'}
                >
                  Dashboard
                </NavItem>
                
                {/* News Radar collapsible section */}
                <div className="space-y-1">
                  <Collapsible open={newsRadarExpanded} onOpenChange={setNewsRadarExpanded} className="w-full">
                    <div className="flex items-center">
                      <div className={cn(
                        "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                        "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                        (location.pathname === '/dashboard/news/home' || location.pathname === '/dashboard/news')
                          ? "from-[#300A45]/80 to-black/80 border-[#BF00FF]/30 text-white shadow-lg shadow-[#BF00FF]/15"
                          : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#BF00FF]/30 hover:shadow-lg hover:shadow-[#BF00FF]/10"
                      )}>
                        <Link to="/dashboard/news/home" className="flex items-center gap-3 flex-1">
                          <div className="relative">
                            <Newspaper size={20} className="text-[#BF00FF]" />
                          </div>
                          <span className="font-medium">News Radar</span>
                        </Link>
                        <CollapsibleTrigger asChild>
                          <button className="text-gray-400 group-hover:text-[#BF00FF] transition-colors p-1 hover:bg-[#BF00FF]/10 rounded">
                            {newsRadarExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent 
                      className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                        willChange: 'height',
                        transform: 'translateZ(0)' // Force hardware acceleration
                      }}
                    >
                      <NavItem 
                        href="/dashboard/news/keywords" 
                        icon={<AlertTriangle size={16} className="text-[#BF00FF]/60" />}
                        active={location.pathname.includes('/dashboard/news/keywords')}
                        isChild={true}
                      >
                        Keywords
                      </NavItem>
                    
                      <NavItem 
                        href="/dashboard/news/sources" 
                        icon={<Search size={16} className="text-[#BF00FF]/60" />}
                        active={location.pathname.includes('/dashboard/news/sources')}
                        isChild={true}
                      >
                        Sources
                      </NavItem>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              
                {/* Threat Tracker collapsible section */}
                <div className="space-y-1">
                  <Collapsible open={threatTrackerExpanded} onOpenChange={setThreatTrackerExpanded} className="w-full">
                    <div className="flex items-center">
                      <div className={cn(
                        "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                        "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                        location.pathname.startsWith('/dashboard/threat')
                          ? "from-[#300A45]/80 to-black/80 border-[#00FFFF]/30 text-white shadow-lg shadow-[#00FFFF]/15"
                          : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#00FFFF]/30 hover:shadow-lg hover:shadow-[#00FFFF]/10"
                      )}>
                        <Link to="/dashboard/threat/home" className="flex items-center gap-3 flex-1">
                          <div className="relative">
                            <ShieldAlert size={20} className="text-[#00FFFF]" />
                          </div>
                          <span className="font-medium">Threat Tracker</span>
                        </Link>
                        <CollapsibleTrigger asChild>
                          <button className="text-gray-400 group-hover:text-[#00FFFF] transition-colors p-1 hover:bg-[#00FFFF]/10 rounded border border-transparent hover:border-[#00FFFF]/40">
                            {threatTrackerExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent 
                      className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                        willChange: 'height',
                        transform: 'translateZ(0)' // Force hardware acceleration
                      }}
                    >
                      <NavItem 
                        href="/dashboard/threat/keywords" 
                        icon={<AlertTriangle size={16} className="text-[#00FFFF]/60" />}
                        active={location.pathname.includes('/dashboard/threat/keywords')}
                        isChild={true}
                      >
                        Keywords
                      </NavItem>
                    
                      <NavItem 
                        href="/dashboard/threat/sources" 
                        icon={<Search size={16} className="text-[#00FFFF]/60" />}
                        active={location.pathname.includes('/dashboard/threat/sources')}
                        isChild={true}
                      >
                        Sources
                      </NavItem>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                {/* Report Center collapsible section */}
                <div className="space-y-1">
                  <Collapsible open={newsCapsuleExpanded} onOpenChange={setNewsCapsuleExpanded} className="w-full">
                    <div className="flex items-center">
                      <div className={cn(
                        "flex items-center justify-between w-full gap-3 rounded-md py-2.5 px-3 text-sm transition-all duration-300 group",
                        "bg-gradient-to-b backdrop-blur-sm border shadow-sm",
                        location.pathname.startsWith('/dashboard/news-capsule')
                          ? "from-[#300A45]/80 to-black/80 border-[#BF00FF]/30 text-white shadow-lg shadow-[#BF00FF]/15"
                          : "from-slate-900/20 to-slate-800/10 border-slate-700/20 text-gray-300 hover:text-white hover:from-[#300A45]/60 hover:to-black/60 hover:border-[#BF00FF]/30 hover:shadow-lg hover:shadow-[#BF00FF]/10"
                      )}>
                        <Link to="/dashboard/news-capsule/research" className="flex items-center gap-3 flex-1">
                          <div className="relative">
                            <Search size={20} className="text-[#BF00FF]" />
                          </div>
                          <span className="font-medium">Report Center</span>
                        </Link>
                        <CollapsibleTrigger asChild>
                          <button className="text-gray-400 group-hover:text-[#BF00FF] transition-colors p-1 hover:bg-[#BF00FF]/10 rounded border border-transparent hover:border-[#BF00FF]/40">
                            {newsCapsuleExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </CollapsibleTrigger>
                      </div>
                    </div>
                    
                    <CollapsibleContent
                      className="space-y-1 pt-2 overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"
                      style={{
                        WebkitOverflowScrolling: 'touch',
                        willChange: 'height',
                        transform: 'translateZ(0)' // Force hardware acceleration
                      }}
                    >

                      <NavItem 
                        href="/dashboard/news-capsule/research" 
                        icon={<Search size={16} className="text-[#BF00FF]/60" />} 
                        active={location.pathname.includes('/dashboard/news-capsule/research')}
                        isChild={true}
                      >
                        Article Library
                      </NavItem>
                      
                      <NavItem 
                        href="/dashboard/news-capsule/reports" 
                        icon={<FileText size={16} className="text-[#BF00FF]/60" />}
                        active={location.pathname.includes('/dashboard/news-capsule/reports')}
                        isChild={true}
                      >
                        Current Report
                      </NavItem>
                      
                      <NavItem 
                        href="/dashboard/news-capsule/home" 
                        icon={<Radar size={16} className="text-[#BF00FF]/60" />} 
                        active={location.pathname.includes('/dashboard/news-capsule/home')}
                        isChild={true}
                      >
                        Reports Library
                      </NavItem>
                    </CollapsibleContent>
                  </Collapsible>
                </div>
                <NavItem
                  href="/dashboard/settings"
                  icon={<Settings size={18} className="text-gray-300" />}
                  active={location.pathname.startsWith('/dashboard/settings')}
                >
                  Settings
                </NavItem>

                {/* Live Logs - Available when user has permission */}
                {liveLogsPermission.available && liveLogsPermission.hasPermission && (
                  <NavItem
                    href="/dashboard/dev/live-logs"
                    icon={<Terminal size={18} className="text-orange-400" />}
                    active={location.pathname.startsWith('/dashboard/dev/live-logs')}
                  >
                    Live Logs
                  </NavItem>
                )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
