import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';

interface SidebarProps {
  activeItem: string;
  onExportClick: () => void;
}
export default function Navbar({ activeItem, onExportClick }: SidebarProps) {
  return (
    <div 
      className={cn(
        "flex flex-row w-full border-r border-border mb-10",
        "bg-background rounded-lg border border-muted p-4 shadow shadow-muted",
        "sm:gap-x-20"
      )}
    >
      <div>
        <h2 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
          Analysis
        </h2>
        <div className="mt-2 space-y-1">
          <Link to="/dashboard/news-capsule/analysis">
            <div className={`flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${
              activeItem === 'analysis' 
                ? 'bg-muted text-sidebar-foreground' 
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}>
              <i className="fas fa-magnifying-glass-chart w-5 h-5 mr-2"></i>
              New News Capsule
            </div>
          </Link>
          <Link to="/dashboard/news-capsule/history">
            <div className={`flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer ${
              activeItem === 'history' 
                ? 'bg-muted text-sidebar-foreground' 
                : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
            }`}>
              <i className="fas fa-clock-rotate-left w-5 h-5 mr-2"></i>
              History
            </div>
          </Link>
        </div>
      </div>
      <div>
        <h2 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
          Reports
        </h2>
        <div className="mt-2 space-y-1">
          <Link to="/dashboard/news-capsule/history">
            <div className="flex items-center px-3 py-2 text-sm font-medium rounded-md cursor-pointer text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
              <i className="fas fa-bookmark w-5 h-5 mr-2"></i>
              Saved Reports
            </div>
          </Link>
          <button 
            onClick={onExportClick}
            className={cn(
              "w-full flex items-center px-3 py-2 text-sm font-medium rounded-md bg-background",
              "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground text-left"
            )}
          >
            <i className="fas fa-share-nodes w-5 h-5 mr-2"></i>
            Export Options
          </button>
        </div>
      </div>
      <div>
        <h2 className="px-3 text-xs font-semibold text-sidebar-foreground/60 uppercase tracking-wider">
          Resources
        </h2>
        <div className="mt-2 space-y-1">
          <a href="https://msrc.microsoft.com/update-guide" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <i className="fas fa-shield-halved w-5 h-5 mr-2"></i>
            MS Security Updates
          </a>
          <a href="https://cve.mitre.org/cve/search_cve_list.html" target="_blank" rel="noopener noreferrer" className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground">
            <i className="fas fa-bug w-5 h-5 mr-2"></i>
            CVE Database
          </a>
        </div>
      </div>
    </div>
  );
};

