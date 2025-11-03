import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useTechStackStore } from "../stores/useTechStackStore";

interface ImportPreviewDialogContentProps {
  onCancel: () => void;
  onImport: () => void;
}

export function ImportPreviewDialogContent({
  onCancel,
  onImport
}: ImportPreviewDialogContentProps) {
  // Get upload state from store
  const { upload, toggleEntitySelection, toggleAllEntitySelection } = useTechStackStore();
  const { extractedEntities, selectedEntities, isUploading } = upload;
  return (
    <DialogContent className="max-w-4xl max-h-[80vh]">
      <DialogHeader>
        <DialogTitle>Review Extracted Items</DialogTitle>
        <DialogDescription>
          We've extracted the following items from your spreadsheet. Select which ones to import to your tech stack.
        </DialogDescription>
      </DialogHeader>

      <div className="py-4">
        <div className="flex justify-between items-center mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllEntitySelection}
          >
            {selectedEntities.size === extractedEntities.length ? 'Deselect All' : 'Select All'}
          </Button>
          <span className="text-sm text-muted-foreground">
            {selectedEntities.size} of {extractedEntities.length} selected
          </span>
        </div>

        <ScrollArea className="h-[400px] border rounded-lg p-4">
          <div className="space-y-2">
            {extractedEntities.map((entity, index) => (
              <div
                key={index}
                className={cn(
                  "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                  selectedEntities.has(index) ? "bg-primary/5 border-primary" : "hover:bg-muted/50"
                )}
                onClick={() => toggleEntitySelection(index)}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-4 h-4 rounded border-2 flex items-center justify-center",
                    selectedEntities.has(index) ? "bg-primary border-primary" : "border-muted-foreground"
                  )}>
                    {selectedEntities.has(index) && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{entity.name}</span>
                      {entity.version && <Badge variant="secondary">{entity.version}</Badge>}
                      <Badge variant={entity.type === 'software' ? 'default' : entity.type === 'hardware' ? 'secondary' : 'outline'}>
                        {entity.type}
                      </Badge>
                      {entity.isNew && <Badge variant="outline" className="text-green-600">New</Badge>}
                    </div>
                    {entity.manufacturer && (
                      <p className="text-sm text-muted-foreground">by {entity.manufacturer}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button onClick={onImport} disabled={isUploading || selectedEntities.size === 0}>
          Import {selectedEntities.size} Items
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
