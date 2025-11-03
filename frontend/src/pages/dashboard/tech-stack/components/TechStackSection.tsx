import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { SectionHeader } from "./SectionHeader";
import { AddItemArea } from "./AddItemArea";
import { BulkActionButtons } from "./BulkActionButtons";
import ListOfTechStackItems from "./list-of-tech-stack-items";
import { TechStackItem, TechStackResponse } from "../tech-stack";
import { useTechStackStore } from "../stores/useTechStackStore";

// Shared props that are identical across all sections
export interface TechStackSharedProps {
  onAddItem: (type: 'software' | 'hardware' | 'vendor' | 'client', name: string, version?: string, priority?: number) => void;
  onBulkToggle: (params: { type: string; isActive: boolean }) => void;
  onBulkDelete: (params: { type: string }) => void;
  isGlobalAdding: boolean;
  limitReached: boolean;
  limitTooltip: string;
  optimisticItemName: string;
  optimisticItemType: 'software' | 'hardware' | 'vendor' | 'client' | null;
  removeItem: any;
  toggleItem: any;
  techStack: TechStackResponse | undefined;
}

// Section-specific props
interface TechStackSectionProps extends TechStackSharedProps {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  title: string;
  placeholder: string;
  items: TechStackItem[] | undefined;
  fetchOptions: (query: string) => Promise<any[]>;
}

export function TechStackSection({
  type,
  title,
  placeholder,
  items,
  fetchOptions,
  onAddItem,
  onBulkToggle,
  onBulkDelete,
  isGlobalAdding,
  limitReached,
  limitTooltip,
  optimisticItemName,
  optimisticItemType,
  removeItem,
  toggleItem,
  techStack
}: TechStackSectionProps) {
  // Get UI state from store
  const { ui, search, loading, toggleSection, setSearchValue, clearSearchValue } = useTechStackStore();
  const sectionKey = `${type === 'vendor' ? 'vendors' : type === 'client' ? 'clients' : type}Open` as keyof typeof ui;
  const isOpen = ui[sectionKey] as boolean;

  // Get search value and loading state for this section
  const searchValue = search[type];
  const loadingKey = `isAdding${type.charAt(0).toUpperCase() + type.slice(1)}` as keyof typeof loading;
  const isAdding = loading[loadingKey] as boolean;

  const disabled = isGlobalAdding || limitReached || !!optimisticItemName;

  // Get the category key for the tech stack data
  const categoryKey = (type === 'vendor' ? 'vendors' : type === 'client' ? 'clients' : type) as keyof TechStackResponse;

  const handleAdd = () => {
    if (searchValue.trim()) {
      onAddItem(type, searchValue.trim());
      clearSearchValue(type);
    }
  };

  const handleAutocompleteSelect = (option: { name: string }) => {
    onAddItem(type, option.name, undefined, 1);
    clearSearchValue(type);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={() => toggleSection(type === 'vendor' ? 'vendors' : type === 'client' ? 'clients' : type)}>
      <div className="space-y-4">
        <SectionHeader title={title} count={items?.length || 0} isOpen={isOpen} />

        <CollapsibleContent className="space-y-4">
          <div className="space-y-2">
            <div className="space-y-2">
              <AddItemArea
                type={type}
                placeholder={placeholder}
                searchValue={searchValue}
                onSearchChange={(value) => setSearchValue(type, value)}
                fetchOptions={fetchOptions}
                onAdd={handleAdd}
                onSelect={handleAutocompleteSelect}
                isAdding={isAdding || isGlobalAdding}
                disabled={disabled}
                limitReached={limitReached}
                limitTooltip={limitTooltip}
              />

              <BulkActionButtons
                type={type}
                itemCount={items?.length || 0}
                onEnableAll={() => onBulkToggle({ type, isActive: true })}
                onDisableAll={() => onBulkToggle({ type, isActive: false })}
                onDeleteAll={() => onBulkDelete({ type })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <ListOfTechStackItems
              techStack={techStack}
              category={categoryKey}
              removeItem={removeItem}
              optimisticItemName={optimisticItemName}
              optimisticItemType={optimisticItemType}
              toggleItem={toggleItem}
            />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
