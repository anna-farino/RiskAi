import { CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  count: number;
  isOpen: boolean;
}

export function SectionHeader({ title, count, isOpen }: SectionHeaderProps) {
  return (
    <CollapsibleTrigger className="flex items-center gap-2 w-full text-left hover:bg-muted/50 rounded-md p-2 -ml-2 transition-colors">
      {isOpen ? (
        <ChevronDown className="h-5 w-5 text-muted-foreground" />
      ) : (
        <ChevronRight className="h-5 w-5 text-muted-foreground" />
      )}
      <h3 className="text-lg font-semibold">
        {title} ({count})
      </h3>
    </CollapsibleTrigger>
  );
}
