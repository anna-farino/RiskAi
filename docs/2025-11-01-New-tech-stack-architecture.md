# Tech Stack Module Architecture

**Date:** 2025-11-01
**Status:** Current
**Module:** `/frontend/src/pages/dashboard/tech-stack/`

## Overview

The Tech Stack module is a React-based feature for managing software, hardware, vendors, and clients in a threat monitoring system. The module has been extensively refactored to follow modern React patterns with clear separation of concerns.

### Key Metrics
- **Main File:** 299 lines (down from 1,590 lines originally)
- **Total Module Size:** ~1,200 lines across all files
- **State Management:** Zustand (24 state variables, 16 actions)
- **Data Fetching:** TanStack Query (1 query, 5 mutations)
- **Custom Hooks:** 4 specialized hooks
- **Components:** 10+ UI components

---

## Folder Structure

```
tech-stack/
├── tech-stack.tsx                    # Main orchestration file (299 lines)
├── docs/
│   └── ARCHITECTURE-2025-11-01.md   # This document
├── components/                       # UI components
│   ├── DragDropZoneCard.tsx         # File upload drop zone
│   ├── EntityRoutingDialogContent.tsx  # AI suggestion dialog
│   ├── GlobalBulkActions.tsx        # Bulk enable/disable/delete
│   ├── ImportPreviewDialogContent.tsx  # Spreadsheet import preview
│   ├── list-of-tech-stack-items.tsx # Item list renderer
│   ├── ProgressCard.tsx             # Upload progress display
│   ├── tech-item-wrapper.tsx        # Individual item wrapper
│   ├── tech-stack-item.tsx          # Single item component
│   └── TechStackSection.tsx         # Collapsible section component
├── hooks/                            # Custom React hooks
│   ├── useEntityValidation.ts       # AI entity validation (56 lines)
│   ├── useFileUpload.ts             # File upload handlers (196 lines)
│   ├── useTechStackAutocomplete.ts  # Autocomplete search
│   └── useTechStackQueries.ts       # TanStack Query operations (360 lines)
├── services/                         # API boundary
│   └── techStackService.ts          # All API calls
└── stores/                           # State management
    └── useTechStackStore.ts         # Zustand store (274 lines)
```

---

## Architecture Patterns

### 1. **Composition Over Monolith**
The original 1,590-line file has been decomposed into focused, single-responsibility modules.

### 2. **Custom Hook Pattern**
Complex logic is encapsulated in reusable hooks:
- **useEntityValidation**: AI validation with caching
- **useFileUpload**: File upload workflow
- **useTechStackQueries**: Server state management
- **useTechStackAutocomplete**: Search functionality

### 3. **Service Layer Pattern**
All API calls are centralized in `techStackService.ts`, providing a clear API boundary.

### 4. **Centralized State Management**
Zustand store manages all client-side state, eliminating prop drilling.

### 5. **Optimistic Updates**
All mutations implement optimistic UI updates with proper rollback on error.

---

## File Responsibilities

### Main File: `tech-stack.tsx`

**Purpose:** Orchestration and business logic

**Responsibilities:**
- Component composition
- Hook initialization
- Business logic coordination (handleAddItem with validation)
- Shared props construction
- Main UI layout

**Does NOT contain:**
- State declarations (moved to Zustand)
- API calls (moved to services)
- Query logic (moved to hooks)
- File upload handlers (moved to useFileUpload)
- Validation logic (moved to useEntityValidation)

**Key Exports:**
```typescript
export interface TechStackItem { /* ... */ }
export interface TechStackResponse { /* ... */ }
export default function TechStackPage() { /* ... */ }
```

---

### Zustand Store: `stores/useTechStackStore.ts`

**Purpose:** Centralized client-side state management

**State Categories:**
1. **UI State** (6 fields)
   - Section collapse states (softwareOpen, hardwareOpen, etc.)
   - Dialog visibility (showPreview)
   - Drag state (isDragging)

2. **Search State** (4 fields)
   - Search inputs for each category (software, hardware, vendor, client)

3. **Loading State** (5 fields)
   - Loading flags for add operations per category

4. **Optimistic UI State** (2 fields)
   - itemName, itemType for optimistic rendering

5. **Upload State** (4 fields)
   - isUploading, extractedEntities, selectedEntities, currentUploadId

6. **Dialog State** (1 object)
   - routingDialog for AI entity routing suggestions

**Actions:** 16 typed actions for state updates

**Key Pattern:**
```typescript
const { ui, loading, optimistic, /* ... */ } = useTechStackStore();
// Components use selectors for granular subscriptions
const isDragging = useTechStackStore((state) => state.ui.isDragging);
```

---

### Query Hook: `hooks/useTechStackQueries.ts`

**Purpose:** Encapsulate all TanStack Query operations

**Contains:**
- 1 `useQuery` for fetching tech stack data
- 5 `useMutation` hooks:
  - addItem
  - removeItem (hard delete)
  - toggleItem (soft delete/enable)
  - bulkToggle
  - bulkDelete

**Key Features:**
- Optimistic updates on all mutations
- Proper error handling with rollback
- Cache manipulation for instant UI updates
- Limit checking (based on user tier)

**Usage:**
```typescript
const {
  techStack,           // Query data
  isLoading,          // Loading state
  limitReached,       // Boolean flag
  addItem,            // Mutation function
  removeItem,         // Mutation function
  toggleItem,         // Mutation function
  bulkToggle,         // Mutation function
  bulkDelete          // Mutation function
} = useTechStackQueries({ userData, onItemAdded });
```

---

### File Upload Hook: `hooks/useFileUpload.ts`

**Purpose:** Handle all file upload operations

**Responsibilities:**
- Drag and drop handlers (handleDragOver, handleDragLeave, handleDrop)
- File selection handler (handleFileSelect)
- File upload with CSRF token handling
- Upload progress tracking via `useUploadProgress`
- Import selected entities after preview

**Key Features:**
- CSRF token extraction from cookies
- Upload ID generation for progress tracking
- Integration with Zustand for state updates
- Error handling with toast notifications

**Returns:**
```typescript
{
  progress,              // Upload progress object
  handleDragOver,        // Drag event handler
  handleDragLeave,       // Drag event handler
  handleDrop,            // Drop event handler
  handleFileSelect,      // File input handler
  handleImportSelected   // Import handler
}
```

---

### Validation Hook: `hooks/useEntityValidation.ts`

**Purpose:** AI-powered entity type validation with caching

**Responsibilities:**
- Validate if entity is categorized correctly
- Cache validation results (5-minute TTL)
- Call AI service for suggestions

**Key Features:**
- In-memory caching using `useRef<Map>`
- 5-minute cache duration
- Graceful error handling

**Returns:**
```typescript
{
  validateEntityType: (name: string, currentType: string) => Promise<ValidationResult | null>
}
```

**Usage:**
```typescript
const { validateEntityType } = useEntityValidation();
const validation = await validateEntityType("nginx", "hardware");
if (validation?.shouldSuggestCorrection) {
  // Show routing dialog
}
```

---

### Service Layer: `services/techStackService.ts`

**Purpose:** API boundary - all backend communication

**Methods:**
- `getTechStack()` - Fetch all tech stack data
- `addItem()` - Add new item
- `removeItem()` - Remove item (hard delete)
- `toggleItem()` - Enable/disable item
- `bulkToggle()` - Bulk enable/disable
- `bulkDelete()` - Bulk delete
- `uploadFile()` - Upload spreadsheet
- `importEntities()` - Import extracted entities
- `validateEntity()` - AI validation

**Pattern:**
```typescript
export const techStackService = {
  async getTechStack(fetchWithAuth: any) {
    return await fetchWithAuth('/api/threat-tracker/tech-stack');
  },
  // ... other methods
};
```

---

## Data Flow

### 1. Fetching Data
```
Component Mount
  ↓
useTechStackQueries (useQuery)
  ↓
techStackService.getTechStack()
  ↓
Backend API
  ↓
React Query Cache
  ↓
Component Render
```

### 2. Adding an Item
```
User Input → handleAddItem()
  ↓
useEntityValidation.validateEntityType()
  ↓
AI Validation Service
  ↓
If correct type:
  addItem.mutate() → Optimistic Update → API Call → Refetch
If wrong type:
  Show Routing Dialog → User Confirms → addItem.mutate()
```

### 3. File Upload Flow
```
User Drops File
  ↓
handleDrop() → handleFileUpload()
  ↓
Generate uploadId → setUploadState(true, uploadId)
  ↓
Add CSRF Token → FormData
  ↓
techStackService.uploadFile()
  ↓
useUploadProgress polls progress
  ↓
onComplete → setExtractedEntities() → Show Preview Dialog
  ↓
User Selects Entities → handleImportSelected()
  ↓
techStackService.importEntities()
  ↓
Invalidate Query → Refetch
```

### 4. State Updates
```
User Action
  ↓
Component Handler
  ↓
Zustand Action (e.g., setLoadingState())
  ↓
State Updated
  ↓
All Subscribed Components Re-render
```

---

## State Management Strategy

### Client State (Zustand)
- UI state (collapsibles, dialogs, drag state)
- Search inputs
- Loading flags
- Optimistic UI data
- Upload workflow state

### Server State (TanStack Query)
- Tech stack data (software, hardware, vendors, clients)
- Cached responses
- Loading/error states
- Automatic refetching

### Local Component State (useState)
- `newlyAddedItems` - Session-specific tracking
- `fileInputRef` - File input reference

**Principle:**
- **Zustand** for client-side UI state
- **TanStack Query** for server-synchronized data
- **useState** for truly local, component-specific state

---

## Key Patterns & Conventions

### 1. Type Safety
All interfaces are exported from main file:
```typescript
export interface TechStackItem { /* ... */ }
export interface TechStackResponse { /* ... */ }
```

Hooks import types:
```typescript
import type { TechStackItem, TechStackResponse } from "../tech-stack";
```

### 2. Optimistic Updates
All mutations implement:
```typescript
onMutate: async (variables) => {
  await queryClient.cancelQueries();
  const previousData = queryClient.getQueryData();
  queryClient.setQueryData(/* optimistic update */);
  return { previousData };
},
onError: (err, variables, context) => {
  queryClient.setQueryData(context.previousData); // Rollback
},
```

### 3. Selector Pattern
Components use Zustand selectors for fine-grained subscriptions:
```typescript
// Subscribe to specific state slice
const isDragging = useTechStackStore((state) => state.ui.isDragging);
```

### 4. Composition Pattern
Components keep root elements in parent, extract content:
```typescript
<Dialog open={ui.showPreview} onOpenChange={setShowPreview}>
  <ImportPreviewDialogContent {...props} />
</Dialog>
```

### 5. Error Handling
- All API calls wrapped in try/catch
- Toast notifications for user-facing errors
- Rollback on optimistic update failures
- Console logging for debugging

### 6. Naming Conventions
- **Handlers:** `handle*` prefix (handleAddItem, handleFileUpload)
- **Store Actions:** Descriptive verbs (setLoadingState, toggleSection)
- **Hooks:** `use*` prefix (useEntityValidation, useFileUpload)
- **Services:** Noun + Service (techStackService)

---

## Integration Points

### External Dependencies

**UI Components:**
- `@/components/ui/*` - shadcn/ui components
- `lucide-react` - Icons

**Hooks:**
- `@/hooks/use-auth` - User authentication
- `@/hooks/use-fetch` - Authenticated fetch wrapper
- `@/hooks/use-toast` - Toast notifications
- `@/hooks/useUploadProgress` - Upload progress polling

**Libraries:**
- `@tanstack/react-query` - Server state management
- `zustand` - Client state management
- `react` - Core framework

### Backend APIs
All endpoints prefixed with `/api/threat-tracker/tech-stack`

**GET** `/api/threat-tracker/tech-stack` - Fetch all data
**POST** `/api/threat-tracker/tech-stack/add` - Add item
**DELETE** `/api/threat-tracker/tech-stack/remove` - Remove item
**PUT** `/api/threat-tracker/tech-stack/toggle` - Toggle active state
**PUT** `/api/threat-tracker/tech-stack/bulk-toggle` - Bulk toggle
**DELETE** `/api/threat-tracker/tech-stack/bulk-delete` - Bulk delete
**POST** `/api/threat-tracker/tech-stack/upload` - Upload file
**POST** `/api/threat-tracker/tech-stack/import` - Import entities
**POST** `/api/threat-tracker/tech-stack/validate` - Validate entity

---

## Testing Recommendations

### Unit Tests
- **Hooks:** Test useEntityValidation caching logic
- **Service Layer:** Mock API calls, test request/response formatting
- **Components:** Test rendering, user interactions

### Integration Tests
- **File Upload Flow:** End-to-end from file selection to import
- **Add Item Flow:** Test validation → routing → addition
- **Optimistic Updates:** Test UI updates and rollbacks

### E2E Tests
- **Complete Workflows:** Add/remove/toggle items
- **Bulk Operations:** Enable/disable/delete all
- **Import Workflow:** Upload spreadsheet → preview → import

---

## Future Considerations

### Potential Improvements
1. **Performance:** Virtualization for large lists (React Window)
2. **Accessibility:** ARIA labels, keyboard navigation
3. **Testing:** Comprehensive test coverage
4. **Error Boundaries:** Wrap sections in error boundaries
5. **Analytics:** Track user interactions
6. **Undo/Redo:** Implement action history
7. **Export:** Add export functionality (CSV, JSON)

### Scalability
- Current architecture supports 1000+ items (Pro plan)
- Pagination may be needed for enterprise plans
- Consider infinite scroll for very large datasets

---

## Migration History

### Phase 1: Component Extraction (Completed)
- Extracted dialog components
- Extracted section components
- Reduced main file from 1,590 → 886 lines

### Phase 2: State Management (Completed)
- Introduced Zustand store
- Migrated 22 useState to centralized state
- Reduced props from 24 → 19 across components

### Phase 3: Query Extraction (Completed)
- Created useTechStackQueries hook
- Extracted ~300 lines of TanStack Query logic
- Main file: 886 → 506 lines

### Phase 4: Handler Extraction (Completed - 2025-11-01)
- Created useFileUpload hook (196 lines)
- Created useEntityValidation hook (56 lines)
- Final main file: 299 lines

**Total Reduction:** 1,590 → 299 lines (81% reduction)

---

## Troubleshooting

### Common Issues

**1. Type Errors**
- Ensure types are imported from main file: `import type { TechStackItem } from "../tech-stack"`
- Check `createdAt` field type (should be `Date`, not `string`)

**2. Optimistic Updates Not Working**
- Verify query key matches: `['/api/threat-tracker/tech-stack']`
- Check context rollback in `onError` handlers

**3. Upload Progress Not Showing**
- Verify `uploadId` is generated and passed to backend
- Check `useUploadProgress` hook is polling correctly

**4. CSRF Token Issues**
- Check cookie parsing in `useFileUpload`
- Verify `_csrf` field is appended to FormData

**5. Validation Cache Not Working**
- Check cache key format: `${name}-${currentType}`
- Verify 5-minute TTL logic

---

## Contact & Maintenance

**Last Updated:** 2025-11-01
**Maintained By:** Development Team
**Related Docs:**
- `/docs/API.md` - Backend API documentation
- `/docs/STATE_MANAGEMENT.md` - Zustand patterns
- `/docs/QUERY_PATTERNS.md` - TanStack Query conventions

---

## Appendix: Quick Reference

### Import Paths
```typescript
// Main file
import { TechStackItem, TechStackResponse } from "./tech-stack";

// Hooks
import { useTechStackQueries } from "./hooks/useTechStackQueries";
import { useFileUpload } from "./hooks/useFileUpload";
import { useEntityValidation } from "./hooks/useEntityValidation";
import { useTechStackAutocomplete } from "./hooks/useTechStackAutocomplete";

// Store
import { useTechStackStore } from "./stores/useTechStackStore";

// Service
import { techStackService } from "./services/techStackService";

// Components
import { TechStackSection } from "./components/TechStackSection";
import { ImportPreviewDialogContent } from "./components/ImportPreviewDialogContent";
// ... etc
```

### Store Actions Quick Reference
```typescript
// UI Actions
toggleSection(section)
setShowPreview(show)
setIsDragging(dragging)

// Search Actions
setSearchValue(type, value)
clearSearchValue(type)

// Loading Actions
setLoadingState(type, loading)

// Optimistic UI
setOptimisticItem(name, type)
clearOptimisticItem()

// Upload Actions
setUploadState(isUploading, uploadId?)
setExtractedEntities(entities)
toggleEntitySelection(index)
toggleAllEntitySelection()
clearUploadState()

// Dialog Actions
setRoutingDialog(dialog)
closeRoutingDialog()
```

### Query Hook Returns
```typescript
{
  techStack,          // TechStackResponse | undefined
  isLoading,          // boolean
  limitReached,       // boolean
  addItem,            // UseMutationResult
  removeItem,         // UseMutationResult
  toggleItem,         // UseMutationResult
  bulkToggle,         // UseMutationResult
  bulkDelete          // UseMutationResult
}
```

---

**End of Document**
