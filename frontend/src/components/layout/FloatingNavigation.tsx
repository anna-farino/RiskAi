import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, Home, File, ChevronUp, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLogout } from "@/hooks/use-logout";
import { useAuth } from "@/hooks/use-auth";
import { ModeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/ui/logo";

type NavButton = {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  restricted: boolean;
};

const navButtons: NavButton[] = [
  {
    label: "Home",
    path: "/dashboard/home",
    icon: Home,
    restricted: false,
  },
  {
    label: "News Radar",
    path: "/dashboard/news/home",
    icon: Home,
    restricted: false,
  },
  {
    label: "Admin",
    path: "/dashboard/admin",
    icon: File,
    restricted: true,
  },
];

export default function FloatingNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const location = useLocation();
  const { logout } = useLogout();
  const { data: userData } = useAuth();
  
  // Handle responsive state
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Close menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Filter buttons based on user permissions
  const filteredButtons = navButtons.filter((button) => {
    if (userData?.permissions?.includes("permissions:edit") || !button.restricted) {
      return true;
    }
    return false;
  });

  const handleScrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      {/* Desktop Navigation - Horizontal bar at top */}
      {!isMobile && (
        <div className="fixed top-0 left-0 right-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Logo interactive />
              </div>
              
              <div className="nav-container">
                <nav>
                  <ul className="nav-list">
                    {filteredButtons.map((button) => {
                      const isActive = location.pathname.includes(button.path);
                      return (
                        <li key={button.path}>
                          <Link
                            to={button.path}
                            className={cn(
                              "nav-item",
                              isActive && "active"
                            )}
                          >
                            {button.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
                
                <div className="flex items-center space-x-3">
                  <ModeToggle />
                  <button
                    onClick={logout}
                    className="flex items-center space-x-1 text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Logout</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Navigation - Floating */}
      {isMobile && (
        <div className="floating-nav">
          {menuOpen && (
            <div className="floating-nav-menu">
              <div className="flex flex-col space-y-2">
                <div className="pb-2 mb-2 border-b border-gray-200 dark:border-gray-700">
                  <Logo size="md" className="mb-2" />
                  <div className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Menu</div>
                </div>
                
                {filteredButtons.map((button) => {
                  const isActive = location.pathname.includes(button.path);
                  return (
                    <Link
                      key={button.path}
                      to={button.path}
                      className={cn(
                        "flex items-center space-x-2 px-3 py-2 rounded-md transition-colors duration-200",
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      <button.icon className="h-5 w-5" />
                      <span>{button.label}</span>
                    </Link>
                  );
                })}
                
                <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <button
                      onClick={logout}
                      className="flex items-center space-x-2 px-3 py-2 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <LogOut className="h-4 w-4 mr-1" />
                      <span className="text-sm">Logout</span>
                    </button>
                    <ModeToggle />
                  </div>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleScrollToTop}
            className="floating-nav-button top mb-2"
            aria-label="Scroll to top"
          >
            <ChevronUp className="h-5 w-5" />
          </button>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="floating-nav-button"
            aria-label="Toggle menu"
          >
            {menuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>
      )}

      {/* Mobile menu overlay at top for larger devices */}
      {isMobile && (
        <div className={cn("mobile-menu", menuOpen ? "open" : "closed")}>
          <div className="container mx-auto px-4 py-2">
            <div className="flex items-center justify-center mb-3">
              <Logo size="md" />
            </div>
            <div className="flex flex-col space-y-1">
              {filteredButtons.map((button, index) => {
                const isActive = location.pathname.includes(button.path);
                return (
                  <div key={button.path} className="mobile-menu-item">
                    <Link
                      to={button.path}
                      className={cn(
                        "mobile-menu-link",
                        isActive && "active"
                      )}
                    >
                      <div className="flex items-center">
                        <button.icon className="h-5 w-5 mr-2" />
                        {button.label}
                      </div>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}