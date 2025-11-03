import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Upload } from "lucide-react";
import {
  Dialog,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { TechStackItem } from "./components/tech-item-wrapper";
import { EntityRoutingDialogContent } from "./components/EntityRoutingDialogContent";
import { TechStackSection, TechStackSharedProps } from "./components/TechStackSection";
import { GlobalBulkActions } from "./components/GlobalBulkActions";
import { ImportPreviewDialogContent } from "./components/ImportPreviewDialogContent";
import { ProgressCard } from "./components/ProgressCard";
import { DragDropZoneCard } from "./components/DragDropZoneCard";
import { useTechStackAutocomplete } from "./hooks/useTechStackAutocomplete";
import { useTechStackStore } from "./stores/useTechStackStore";
import { useTechStackQueries } from "./hooks/useTechStackQueries";
import { useFileUpload } from "./hooks/useFileUpload";
import { useEntityValidation } from "./hooks/useEntityValidation";

// Type definitions
export interface TechStackItem {
  id: string;
  name: string;
  version?: string | null;
  priority?: number | null;
  isActive?: boolean;
  company?: string | null;
  manufacturer?: string | null; // For hardware items
  model?: string | null; // For hardware items
  source?: string | null; // For tracking auto-added vendors
  criticalCount?: number;
  highCount?: number;
  mediumCount?: number;
  lowCount?: number;
  createdAt?: Date;
  // Legacy fields - kept for backwards compatibility
  threats?: {
    count: number;
    highestLevel: 'critical' | 'high' | 'medium' | 'low';
  } | null;
}

export interface TechStackResponse {
  software: TechStackItem[];
  hardware: TechStackItem[];
  vendors: TechStackItem[];
  clients: TechStackItem[];
}

export default function TechStackPage() {
  const { data: userData } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Zustand store for all UI, search, loading, optimistic, and upload state
  const {
    ui,
    loading,
    optimistic,
    routingDialog,
    setShowPreview,
    setRoutingDialog,
    closeRoutingDialog,
    setLoadingState,
    setOptimisticItem
  } = useTechStackStore();

  // Track newly added items during this session
  const [_newlyAddedItems, setNewlyAddedItems] = useState<Set<string>>(new Set());

  // Vendor limit dialog state
  const [vendorLimitDialog, setVendorLimitDialog] = useState({
    open: false,
    itemName: '',
    vendorName: ''
  });

  // Entity validation hook
  const { validateEntityType } = useEntityValidation();

  // File upload hook with all handlers
  const {
    progress,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileSelect,
    handleImportSelected
  } = useFileUpload({ fileInputRef });

  // Handle adding item with validation
  async function handleAddItem(
    type: 'software' | 'hardware' | 'vendor' | 'client',
    name: string,
    version?: string,
    priority?: number
  ) {
    setOptimisticItem(name, type);
    setLoadingState('techStackKeyword', true);
    setLoadingState(type, true);

    try {
      // Validate entity type
      const validation = await validateEntityType(name, type);

      if (validation?.shouldSuggestCorrection) {
        // Show routing dialog
        setRoutingDialog({
          open: true,
          entity: { name, version, priority },
          currentType: type,
          suggestedType: validation.suggestedType,
          message: validation.message || ""
        });
      } else {
        // Add directly
        addItem.mutate({ type, name, version, priority });
      }
    } finally {
      setLoadingState(type, false);
      setLoadingState('techStackKeyword', false);
      //techStackRefetch()
    }
  };

  // Autocomplete fetch functions using custom hook
  const fetchSoftwareOptions = useTechStackAutocomplete('software');
  const fetchHardwareOptions = useTechStackAutocomplete('hardware');
  const fetchVendorOptions = useTechStackAutocomplete('vendor');
  const fetchClientOptions = useTechStackAutocomplete('client');

  // Use TanStack Query hook for all data fetching and mutations
  const {
    techStack,
    isLoading,
    limitReached,
    addItem,
    removeItem,
    toggleItem,
    bulkToggle,
    bulkDelete,
  } = useTechStackQueries({
    userData,
    onItemAdded: (itemId) => setNewlyAddedItems(prev => new Set([...prev, itemId])),
    onVendorSkipped: (itemName, vendorName) => {
      setVendorLimitDialog({ open: true, itemName, vendorName });
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-muted-foreground">Loading technology stack...</div>
      </div>
    );
  }

  // Shared props for all tech stack sections
  const techStackShared: TechStackSharedProps = {
    onAddItem: handleAddItem,
    onBulkToggle: bulkToggle.mutate,
    onBulkDelete: bulkDelete.mutate,
    isGlobalAdding: loading.isAddingTechStackKeyword,
    limitReached,
    limitTooltip: "You have reached the maximum number of keywords for your plan. Upgrade to add more",
    optimisticItemName: optimistic.itemName,
    optimisticItemType: optimistic.itemType,
    removeItem,
    toggleItem,
    techStack,
  };

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Technology Stack</h2>
          <p className="text-muted-foreground mt-1">
            Configure your software, hardware, vendors, and clients for personalized threat monitoring
          </p>
        </div>
        
        {/* File Upload Button */}
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={false}
            variant="outline"
            className="gap-2"
          >
            <Upload className="h-4 w-4" />
            Import from Spreadsheet
          </Button>
        </div>
      </div>

      {/* Upload Progress OR Drag and Drop Zone - Only show one at a time */}
      {progress ? (
        // Show progress bar when upload is in progress
        <ProgressCard progress={progress} />
      ) : (
        // Show drag and drop zone when no upload is in progress
        <DragDropZoneCard
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={ui.showPreview} onOpenChange={setShowPreview}>
        <ImportPreviewDialogContent
          onCancel={() => setShowPreview(false)}
          onImport={handleImportSelected}
        />
      </Dialog>

      <Card>
        <CardContent className="pt-6 space-y-6">
          {/* Global Bulk Actions */}
          <GlobalBulkActions
            totalItems={(techStack?.software?.length || 0) + (techStack?.hardware?.length || 0) + (techStack?.vendors?.length || 0) + (techStack?.clients?.length || 0)}
            onEnableAll={() => bulkToggle.mutate({ isActive: true })}
            onDisableAll={() => bulkToggle.mutate({ isActive: false })}
            onDeleteAll={() => bulkDelete.mutate({})}
          />

          {/* Software Section */}
          <TechStackSection
            type="software"
            title="Software"
            placeholder="Add software (e.g., Apache, nginx, Redis)..."
            items={techStack?.software}
            fetchOptions={fetchSoftwareOptions}
            {...techStackShared}
          />

          <Separator />

          {/* Hardware Section */}
          <TechStackSection
            type="hardware"
            title="Hardware"
            placeholder="Add hardware (e.g., Cisco ASA, Dell PowerEdge)..."
            items={techStack?.hardware}
            fetchOptions={fetchHardwareOptions}
            {...techStackShared}
          />

          <Separator />

          {/* Vendors Section */}
          <TechStackSection
            type="vendor"
            title="Vendors"
            placeholder="Add vendor (e.g., Microsoft, Amazon, Oracle)..."
            items={techStack?.vendors}
            fetchOptions={fetchVendorOptions}
            {...techStackShared}
          />

          <Separator />

          {/* Clients Section */}
          <TechStackSection
            type="client"
            title="Clients"
            placeholder="Add client (e.g., Bank of America, Acme Corp)..."
            items={techStack?.clients}
            fetchOptions={fetchClientOptions}
            {...techStackShared}
          />
        </CardContent>
      </Card>

      {/* Entity Routing Suggestion Dialog */}
      <AlertDialog
        open={routingDialog.open}
        onOpenChange={(open) => !open && closeRoutingDialog()}
      >
        <EntityRoutingDialogContent
          onAddItem={addItem.mutate}
        />
      </AlertDialog>

      {/* Vendor Limit Reached Dialog */}
      <AlertDialog
        open={vendorLimitDialog.open}
        onOpenChange={(open) => setVendorLimitDialog({ ...vendorLimitDialog, open })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Item Added - Keyword Limit Reached</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold">{vendorLimitDialog.itemName}</span> was added successfully to your tech stack.
              However, you've reached your keyword limit, so we couldn't auto-add the vendor{' '}
              <span className="font-semibold">{vendorLimitDialog.vendorName}</span>.
              {' '}Upgrade your plan to add more tech stack items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Close</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
