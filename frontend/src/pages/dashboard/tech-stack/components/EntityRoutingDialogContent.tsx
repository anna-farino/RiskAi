import {
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { useTechStackStore } from "../stores/useTechStackStore";

interface EntityRoutingDialogContentProps {
  onAddItem: (params: { type: 'software' | 'hardware' | 'vendor' | 'client'; name: string; version?: string; priority?: number }) => void;
}

export function EntityRoutingDialogContent({ onAddItem }: EntityRoutingDialogContentProps) {
  const routingDialog = useTechStackStore((state) => state.routingDialog);
  return (
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Suggested Category</AlertDialogTitle>
        <AlertDialogDescription>
          {routingDialog.message}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel onClick={() => {
          // Add to the originally selected category
          if (routingDialog.entity && routingDialog.currentType) {
            onAddItem({
              type: routingDialog.currentType,
              name: routingDialog.entity.name,
              version: routingDialog.entity.version,
              priority: routingDialog.entity.priority
            });
          }
        }}>
          Keep as {routingDialog.currentType}
        </AlertDialogCancel>
        <AlertDialogAction onClick={() => {
          // Add to the suggested category
          if (routingDialog.entity && routingDialog.suggestedType) {
            onAddItem({
              type: routingDialog.suggestedType,
              name: routingDialog.entity.name,
              version: routingDialog.entity.version,
              priority: routingDialog.entity.priority
            });
          }
        }}>
          Move to {routingDialog.suggestedType}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  );
}
