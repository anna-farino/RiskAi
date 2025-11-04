import { useState } from "react";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

interface BulkActionButtonsProps {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  itemCount: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onDeleteAll: () => void;
}

export function BulkActionButtons({
  type,
  itemCount,
  onEnableAll,
  onDisableAll,
  onDeleteAll
}: BulkActionButtonsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  if (itemCount === 0) return null;

  const typeLabel = type === 'vendor' ? 'Vendors' : type === 'client' ? 'Clients' : type.charAt(0).toUpperCase() + type.slice(1);

  return (
    <div className="flex gap-2 justify-end">
      <Button
        variant="ghost"
        size="sm"
        onClick={onEnableAll}
        className="h-7 px-2 text-xs"
      >
        Enable All {typeLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onDisableAll}
        className="h-7 px-2 text-xs"
      >
        Disable All {typeLabel}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDeleteDialog(true)}
        className="h-7 px-2 text-xs text-destructive hover:text-destructive"
      >
        Delete All {typeLabel}
      </Button>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All {typeLabel}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">all {itemCount} {type}</span> items from your technology stack. This action cannot be undone.
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
                onDeleteAll();
                setShowDeleteDialog(false);
              }}
              className={cn(
                "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                "hover:text-white hover:border-destructive"
              )}
            >
              Delete All {typeLabel}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
