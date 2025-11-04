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

interface GlobalBulkActionsProps {
  totalItems: number;
  onEnableAll: () => void;
  onDisableAll: () => void;
  onDeleteAll: () => void;
}

export function GlobalBulkActions({
  totalItems,
  onEnableAll,
  onDisableAll,
  onDeleteAll
}: GlobalBulkActionsProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  return (
    <div className="flex items-center justify-between pb-4 border-b">
      <div className="text-sm text-muted-foreground">
        Total items: {totalItems}
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onEnableAll}
          className="h-8 px-3 text-xs"
          data-testid="button-enable-all"
        >
          Enable All
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onDisableAll}
          className="h-8 px-3 text-xs"
          data-testid="button-disable-all"
        >
          Disable All
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setShowDeleteDialog(true)}
          className="h-8 px-3 text-xs"
          data-testid="button-delete-all"
        >
          Delete All
        </Button>
      </div>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete All Items?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove <span className="font-semibold">ALL {totalItems} items</span> from your technology stack. This action cannot be undone.
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
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
