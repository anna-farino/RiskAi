import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// Type definitions
interface TechStackItem {
  id: string;
  name: string;
  version?: string | null;
  priority?: number | null;
  isActive?: boolean;
  company?: string | null;
  manufacturer?: string | null;
  model?: string | null;
  source?: string | null;
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  threats?: {
    count: number;
    highestLevel: 'critical' | 'high' | 'medium' | 'low';
  } | null;
}

interface TechStackItemProps {
  item: TechStackItem;
  type: 'software' | 'hardware' | 'vendor' | 'client';
  onToggle: (itemId: string, type: string, isActive: boolean) => void;
  onRemove: (itemId: string, type: string) => void;
}

export default function TechStackItemComponent({
  item,
  type,
  onToggle,
  onRemove
}: TechStackItemProps) {
  const navigate = useNavigate();
  const [localIsActive, setLocalIsActive] = useState(item.isActive === true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  // Sync local state when item.isActive changes from server/optimistic update
  useEffect(() => {
    setLocalIsActive(item.isActive === true);
  }, [item.isActive]);

  const getThreatColor = (level: string) => {
    switch(level) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-500';
    }
  };

  const getThreatLabel = (level: string) => {
    return level.charAt(0).toUpperCase() + level.slice(1);
  };

  // Use local state for immediate UI feedback
  const isActive = localIsActive;

  return (
    <div
      className={cn(
        "flex items-center hover:bg-muted/50 justify-between gap-4 py-3 px-4 rounded-md transition-colors", 
        {
          "opacity-60 hover:bg-muted/30 blur-[1px]": item.id==='optimistic'
        }
      )}
      data-testid={`tech-item-${item.id}`}
    >
      <div className="flex items-center gap-3 flex-1">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span
              className="font-medium"
              data-testid={`text-item-name-${item.id}`}
            >
              {/* Display with styled prefix for both hardware and software */}
              {type === 'hardware' && item.manufacturer && (
                <>
                  <span className="text-muted-foreground">{item.manufacturer}</span>
                  {' '}
                </>
              )}
              {type === 'software' && item.company && (
                <>
                  <span className="text-muted-foreground">{item.company}</span>
                  {' '}
                </>
              )}
              <span>{item.name}</span>
            </span>
            {/* Show version for software */}
            {item.version && (
              <span className="text-sm text-muted-foreground" data-testid={`text-item-version-${item.id}`}>
                v{item.version}
              </span>
            )}
            {/* Show auto-added indicator for vendors */}
            {type === 'vendor' && item.source && item.source !== 'manual' && (
              <span className="text-xs bg-muted px-2 py-0.5 rounded-md text-muted-foreground" data-testid={`text-auto-added-${item.id}`}>
                {item.source === 'auto-software' ? 'from software' :
                 item.source === 'auto-hardware' ? 'from hardware' : 'auto'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Threat indicators section */}
      <div className="flex items-center gap-3">
        {((item.criticalCount ?? 0) > 0 ||
          (item.highCount ?? 0) > 0 ||
          (item.mediumCount ?? 0) > 0 ||
          (item.lowCount ?? 0) > 0) && (
          <div className="flex flex-col items-end">
            <button
              onClick={() => {
                const filterParam = encodeURIComponent(`${type}:${item.name}`);
                navigate(`/dashboard/threat/home?entityFilter=${filterParam}`);
              }}
              className="px-1 py-0 text-xs text-primary hover:underline"
              style={{ background: 'transparent' }}
              data-testid={`button-see-all-threats-${item.id}`}
            >
              See Potential Threats
            </button>
            <div className="flex items-center gap-0">
              {/* Show High for both critical and high counts */}
              {((item.criticalCount ?? 0) > 0 || (item.highCount ?? 0) > 0) && (
                <button
                  onClick={() => {
                    const filterParam = encodeURIComponent(`${type}:${item.name}:${(item.criticalCount ?? 0) > 0 ? 'critical' : 'high'}`);
                    navigate(`/dashboard/threat/home?entityFilter=${filterParam}`);
                  }}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity px-1 py-0 text-xs rounded hover:bg-muted/50"
                  style={{ background: 'transparent' }}
                  data-testid={`button-threat-high-${item.id}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                  <span className="text-muted-foreground">High</span>
                </button>
              )}
              {(item.mediumCount ?? 0) > 0 && (
                <button
                  onClick={() => {
                    const filterParam = encodeURIComponent(`${type}:${item.name}:medium`);
                    navigate(`/dashboard/threat/home?entityFilter=${filterParam}`);
                  }}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity px-1 py-0 text-xs rounded hover:bg-muted/50"
                  style={{ background: 'transparent' }}
                  data-testid={`button-threat-medium-${item.id}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  <span className="text-muted-foreground">Medium</span>
                </button>
              )}
              {(item.lowCount ?? 0) > 0 && (
                <button
                  onClick={() => {
                    const filterParam = encodeURIComponent(`${type}:${item.name}:low`);
                    navigate(`/dashboard/threat/home?entityFilter=${filterParam}`);
                  }}
                  className="flex items-center gap-1 hover:opacity-80 transition-opacity px-1 py-0 text-xs rounded hover:bg-muted/50"
                  style={{ background: 'transparent' }}
                  data-testid={`button-threat-low-${item.id}`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                  <span className="text-muted-foreground">Low</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {item.id==='optimistic' && <Spinner/>}

      <div className="flex items-center gap-2">
        {/* Enable/Disable Toggle */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center">
                <Switch
                  checked={isActive}
                  disabled={item.id==='optimistic'}
                  onCheckedChange={(checked) => {
                    // Update local state immediately for instant visual feedback
                    setLocalIsActive(checked);
                    // Then trigger the mutation (optimistic update will sync later)
                    onToggle(item.id, type, checked);
                  }}
                  data-testid={`switch-toggle-${item.id}`}
                />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isActive ? 'Disable' : 'Enable'} monitoring for this item</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Delete Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                disabled={item.id==='optimistic'}
                size="sm"
                onClick={() => setShowDeleteDialog(true)}
                data-testid={`button-remove-${item.id}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Permanently delete this item</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">{item.name}</span> from your tech stack. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className={cn(
                "hover:border-input hover:bg-background",
                "hover:bg-muted-foreground/20"
              )}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onRemove(item.id, type);
                setShowDeleteDialog(false);
              }}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                "hover:text-white hover:border-destructive"
              )}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
