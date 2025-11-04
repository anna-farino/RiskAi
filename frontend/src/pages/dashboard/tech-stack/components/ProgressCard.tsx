import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface ProgressCardProps {
  progress: {
    status: 'validating' | 'parsing' | 'extracting' | 'importing' | 'completed' | 'failed';
    message: string;
    percentage: number;
    rowsProcessed?: number;
    totalRows?: number;
    entityCount?: number;
  };
}

export function ProgressCard({ progress }: ProgressCardProps) {
  return (
    <Card className={cn(
      "border-2 border-dashed",
      "border-primary bg-primary/5"
    )}>
      <CardContent className="pt-6 pb-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium">
                {progress.status === 'validating' && '🔍 Validating file...'}
                {progress.status === 'parsing' && '📄 Parsing spreadsheet...'}
                {progress.status === 'extracting' && '⚙️ Extracting entities with AI...'}
                {progress.status === 'importing' && '📥 Importing to tech stack...'}
                {progress.status === 'completed' && '✅ Upload complete!'}
                {progress.status === 'failed' && '❌ Upload failed'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {progress.message}
              </p>
              {progress.rowsProcessed && progress.totalRows && (
                <p className="text-xs text-muted-foreground mt-1">
                  Processing row {progress.rowsProcessed} of {progress.totalRows} • {progress.entityCount || 0} entities found
                </p>
              )}
            </div>
            <span className="text-sm font-medium">{progress.percentage}%</span>
          </div>
          <Progress value={progress.percentage} className="h-2" />
        </div>
      </CardContent>
    </Card>
  );
}
