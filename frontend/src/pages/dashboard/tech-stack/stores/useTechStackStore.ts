import { create } from 'zustand';

interface RoutingDialog {
  open: boolean;
  entity: { name: string; version?: string; priority?: number } | null;
  currentType: 'software' | 'hardware' | 'vendor' | 'client' | null;
  suggestedType: 'software' | 'hardware' | 'vendor' | 'client' | null;
  message: string;
}

interface ExtractedEntity {
  type: 'software' | 'hardware' | 'vendor' | 'client';
  name: string;
  version?: string;
  manufacturer?: string;
  model?: string;
  isNew: boolean;
  matchedId?: string;
}

interface TechStackStore {
  // UI State - Collapsible Sections
  ui: {
    softwareOpen: boolean;
    hardwareOpen: boolean;
    vendorsOpen: boolean;
    clientsOpen: boolean;
    showPreview: boolean;
    isDragging: boolean;
  };

  // Search Input State
  search: {
    software: string;
    hardware: string;
    vendor: string;
    client: string;
  };

  // Loading State
  loading: {
    isAddingSoftware: boolean;
    isAddingHardware: boolean;
    isAddingVendor: boolean;
    isAddingClient: boolean;
    isAddingTechStackKeyword: boolean;
  };

  // Optimistic UI State
  optimistic: {
    itemName: string;
    itemType: 'software' | 'hardware' | 'vendor' | 'client' | null;
  };

  // Upload State
  upload: {
    isUploading: boolean;
    extractedEntities: ExtractedEntity[];
    selectedEntities: Set<number>;
    currentUploadId: string | null;
  };

  // Entity Routing Dialog State
  routingDialog: RoutingDialog;

  // Actions - Collapsible Sections
  toggleSection: (section: 'software' | 'hardware' | 'vendors' | 'clients') => void;

  // Actions - Dialog States
  setShowPreview: (show: boolean) => void;
  setIsDragging: (dragging: boolean) => void;

  // Actions - Search
  setSearchValue: (type: 'software' | 'hardware' | 'vendor' | 'client', value: string) => void;
  clearSearchValue: (type: 'software' | 'hardware' | 'vendor' | 'client') => void;

  // Actions - Loading
  setLoadingState: (type: 'software' | 'hardware' | 'vendor' | 'client' | 'techStackKeyword', loading: boolean) => void;

  // Actions - Optimistic UI
  setOptimisticItem: (name: string, type: 'software' | 'hardware' | 'vendor' | 'client' | null) => void;
  clearOptimisticItem: () => void;

  // Actions - Upload
  setUploadState: (isUploading: boolean, currentUploadId?: string | null) => void;
  setExtractedEntities: (entities: ExtractedEntity[]) => void;
  toggleEntitySelection: (index: number) => void;
  toggleAllEntitySelection: () => void;
  clearUploadState: () => void;

  // Actions - Routing Dialog
  setRoutingDialog: (dialog: RoutingDialog) => void;
  closeRoutingDialog: () => void;
}

export const useTechStackStore = create<TechStackStore>((set) => ({
  // Initial UI State
  ui: {
    softwareOpen: true,
    hardwareOpen: false,
    vendorsOpen: false,
    clientsOpen: false,
    showPreview: false,
    isDragging: false,
  },

  // Initial Search State
  search: {
    software: '',
    hardware: '',
    vendor: '',
    client: '',
  },

  // Initial Loading State
  loading: {
    isAddingSoftware: false,
    isAddingHardware: false,
    isAddingVendor: false,
    isAddingClient: false,
    isAddingTechStackKeyword: false,
  },

  // Initial Optimistic State
  optimistic: {
    itemName: '',
    itemType: null,
  },

  // Initial Upload State
  upload: {
    isUploading: false,
    extractedEntities: [],
    selectedEntities: new Set(),
    currentUploadId: null,
  },

  // Initial Routing Dialog State
  routingDialog: {
    open: false,
    entity: null,
    currentType: null,
    suggestedType: null,
    message: '',
  },

  // Toggle collapsible section
  toggleSection: (section) =>
    set((state) => ({
      ui: {
        ...state.ui,
        [`${section}Open`]: !state.ui[`${section}Open` as keyof typeof state.ui],
      },
    })),

  // Set preview dialog visibility
  setShowPreview: (show) =>
    set((state) => ({
      ui: { ...state.ui, showPreview: show },
    })),

  // Set dragging state
  setIsDragging: (dragging) =>
    set((state) => ({
      ui: { ...state.ui, isDragging: dragging },
    })),

  // Set routing dialog state
  setRoutingDialog: (dialog) =>
    set({ routingDialog: dialog }),

  // Close routing dialog
  closeRoutingDialog: () =>
    set({
      routingDialog: {
        open: false,
        entity: null,
        currentType: null,
        suggestedType: null,
        message: '',
      },
    }),

  // Set search value
  setSearchValue: (type, value) =>
    set((state) => ({
      search: { ...state.search, [type]: value },
    })),

  // Clear search value
  clearSearchValue: (type) =>
    set((state) => ({
      search: { ...state.search, [type]: '' },
    })),

  // Set loading state
  setLoadingState: (type, loading) =>
    set((state) => {
      const key = type === 'techStackKeyword' ? 'isAddingTechStackKeyword' : `isAdding${type.charAt(0).toUpperCase() + type.slice(1)}`;
      return {
        loading: { ...state.loading, [key]: loading },
      };
    }),

  // Set optimistic item
  setOptimisticItem: (name, type) =>
    set({
      optimistic: { itemName: name, itemType: type },
    }),

  // Clear optimistic item
  clearOptimisticItem: () =>
    set({
      optimistic: { itemName: '', itemType: null },
    }),

  // Set upload state
  setUploadState: (isUploading, currentUploadId) =>
    set((state) => ({
      upload: {
        ...state.upload,
        isUploading,
        currentUploadId: currentUploadId !== undefined ? currentUploadId : state.upload.currentUploadId,
      },
    })),

  // Set extracted entities
  setExtractedEntities: (entities) =>
    set((state) => ({
      upload: {
        ...state.upload,
        extractedEntities: entities,
        selectedEntities: new Set(entities.map((_, i) => i)),
      },
    })),

  // Toggle entity selection
  toggleEntitySelection: (index) =>
    set((state) => {
      const newSelection = new Set(state.upload.selectedEntities);
      if (newSelection.has(index)) {
        newSelection.delete(index);
      } else {
        newSelection.add(index);
      }
      return {
        upload: { ...state.upload, selectedEntities: newSelection },
      };
    }),

  // Toggle all entity selection
  toggleAllEntitySelection: () =>
    set((state) => ({
      upload: {
        ...state.upload,
        selectedEntities:
          state.upload.selectedEntities.size === state.upload.extractedEntities.length
            ? new Set()
            : new Set(state.upload.extractedEntities.map((_, i) => i)),
      },
    })),

  // Clear upload state
  clearUploadState: () =>
    set({
      upload: {
        isUploading: false,
        extractedEntities: [],
        selectedEntities: new Set(),
        currentUploadId: null,
      },
    }),
}));
