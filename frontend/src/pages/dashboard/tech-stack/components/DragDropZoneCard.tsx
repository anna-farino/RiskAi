import { Card, CardContent } from "@/components/ui/card";
import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTechStackStore } from "../stores/useTechStackStore";

interface DragDropZoneCardProps {
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
}

export function DragDropZoneCard({
  onDragOver,
  onDragLeave,
  onDrop
}: DragDropZoneCardProps) {
  const isDragging = useTechStackStore((state) => state.ui.isDragging);
  return (
    <Card
      className={cn(
        "border-2 border-dashed transition-colors",
        isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
      )}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <CardContent className="pt-6 pb-6 text-center">
        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-sm text-muted-foreground">
          Drag and drop an Excel or CSV file here, or click the Import button above
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Supported formats: .xlsx, .xls, .csv
        </p>
      </CardContent>
    </Card>
  );
}
