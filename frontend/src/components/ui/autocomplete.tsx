import { useState, useRef, useEffect } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

interface AutocompleteOption {
  id: string;
  name: string;
  company?: string;
  manufacturer?: string;
  model?: string;
  category?: string;
}

interface AutocompleteProps {
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSelect: (option: AutocompleteOption) => void;
  fetchOptions: (query: string) => Promise<AutocompleteOption[]>;
  className?: string;
  disabled?: boolean;
}

export function Autocomplete({
  placeholder,
  value,
  onValueChange,
  onSelect,
  fetchOptions,
  className,
  disabled = false,
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedOption, setSelectedOption] = useState<AutocompleteOption | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout>();

  // Debounce search
  useEffect(() => {
    if (value.length < 2) {
      setOptions([]);
      setOpen(false);
      return;
    }

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    debounceTimeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await fetchOptions(value);
        setOptions(results);
        // Only open if we have results AND user has typed something
        setOpen(results.length > 0 && value.length >= 2);
      } catch (error) {
        console.error("Failed to fetch autocomplete options:", error);
        setOptions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [value, fetchOptions]);

  const handleSelect = (option: AutocompleteOption) => {
    setSelectedOption(option);
    onSelect(option);
    setOpen(false);
    setOptions([]);
    onValueChange(""); // Clear the input after selection
  };

  const formatOptionLabel = (option: AutocompleteOption) => {
    if (option.company) {
      // Software with company
      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{option.name}</span>
            {option.category && (
              <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{option.category}</span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{option.company}</span>
        </div>
      );
    } else if (option.manufacturer) {
      // Hardware
      return (
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-medium">{option.name}</span>
            {option.model && (
              <span className="text-sm text-muted-foreground">({option.model})</span>
            )}
          </div>
          <span className="text-sm text-muted-foreground">{option.manufacturer}</span>
        </div>
      );
    } else {
      // Company/Vendor/Client
      return (
        <div className="flex items-center gap-2">
          <span className="font-medium">{option.name}</span>
          {option.category && (
            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{option.category}</span>
          )}
        </div>
      );
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Popover 
        open={open} 
        onOpenChange={setOpen}
        modal={false}
      >
        <PopoverTrigger asChild>
          <div className="relative">
            <Input
              ref={inputRef}
              type="text"
              placeholder={placeholder}
              value={value}
              onChange={(e) => onValueChange(e.target.value)}
              disabled={disabled}
              className="pr-8"
              onKeyDown={(e) => {
                if (e.key === "Enter" && options.length > 0) {
                  e.preventDefault();
                  handleSelect(options[0]);
                }
              }}
            />
            {loading && (
              <Spinner className="absolute right-2 top-[10px] text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent 
          className="w-[--radix-popover-trigger-width] p-0" 
          align="start"
          onOpenAutoFocus={(e) => {
            // Prevent the popover from stealing focus from the input
            e.preventDefault();
          }}
        >
          <div className="max-h-[300px] overflow-y-auto overflow-x-hidden">
            {options.length === 0 && !loading && (
              <div className="py-6 text-center text-sm">No matching items found</div>
            )}
            {options.length > 0 && (
              <div className="p-1">
                {options.map((option) => (
                  <div
                    key={option.id}
                    onClick={() => handleSelect(option)}
                    className="relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                    role="option"
                    aria-selected={false}
                  >
                    {formatOptionLabel(option)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
