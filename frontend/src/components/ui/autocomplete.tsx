import { useState, useRef, useEffect } from "react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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
        setOpen(results.length > 0);
      } catch (error) {
        console.error("Failed to fetch autocomplete options:", error);
        setOptions([]);
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
      <Popover open={open} onOpenChange={setOpen}>
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
              <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <CommandList>
              {options.length === 0 && !loading && (
                <CommandEmpty>No matching items found</CommandEmpty>
              )}
              {options.length > 0 && (
                <CommandGroup>
                  {options.map((option) => (
                    <CommandItem
                      key={option.id}
                      value={option.id}
                      onSelect={() => handleSelect(option)}
                      className="cursor-pointer"
                    >
                      {formatOptionLabel(option)}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}