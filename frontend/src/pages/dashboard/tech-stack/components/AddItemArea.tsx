import { Button } from "@/components/ui/button";
import { Autocomplete } from "@/components/ui/autocomplete";
import { CustomTooltip } from "@/components/ui/custom-tooltip";
import { Spinner } from "@/components/ui/spinner";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddItemAreaProps {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  placeholder: string;
  searchValue: string;
  onSearchChange: (value: string) => void;
  fetchOptions: (query: string) => Promise<any[]>;
  onAdd: () => void;
  onSelect?: (option: { name: string }) => void;
  isAdding: boolean;
  disabled: boolean;
  limitReached: boolean;
  limitTooltip: string;
}

export function AddItemArea({
  type,
  placeholder,
  searchValue,
  onSearchChange,
  fetchOptions,
  onAdd,
  onSelect,
  isAdding,
  disabled,
  limitReached,
  limitTooltip
}: AddItemAreaProps) {
  return (
    <div className="space-y-2">
      <CustomTooltip show={limitReached} message={limitTooltip}>
        <div className={cn("flex gap-2", { "cursor-not-allowed": disabled })}>
          <Autocomplete
            placeholder={placeholder}
            value={searchValue}
            onValueChange={onSearchChange}
            onSelect={onSelect}
            fetchOptions={fetchOptions}
            className="flex-1"
            disabled={disabled}
          />
          <Button
            onClick={onAdd}
            disabled={disabled}
            data-testid={`button-add-${type}`}
            className="min-w-20"
          >
            {isAdding ? (
              <Spinner />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-1" />
                Add
              </>
            )}
          </Button>
        </div>
      </CustomTooltip>
    </div>
  );
}
