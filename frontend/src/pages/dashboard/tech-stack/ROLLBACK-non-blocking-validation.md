# Rollback Instructions: Non-Blocking Validation

## Change Summary
Made validation non-blocking in tech-stack feature to improve perceived performance.

**Date:** 2025-11-02
**Files Modified:**
- `frontend/src/pages/dashboard/tech-stack/tech-stack.tsx`

## What Changed

### Before (Blocking Validation)
```typescript
async function handleAddItem(type, name, version?, priority?) {
  setOptimisticItem(name, type);
  setLoadingState('techStackKeyword', true);
  setLoadingState(type, true);

  try {
    // Validate entity type - BLOCKING (2-4 seconds)
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
  }
}
```

**User Experience:**
- User clicks "Add" → Waits 2-4s (validation) → Dialog OR Add → Waits 2-4s (addItem) → Success
- **Total time: 4-8 seconds**

### After (Non-Blocking Validation)
```typescript
async function handleAddItem(type, name, version?, priority?) {
  setOptimisticItem(name, type);
  setLoadingState('techStackKeyword', true);
  setLoadingState(type, true);

  try {
    // Add item immediately without blocking on validation
    addItem.mutate({ type, name, version, priority });

    // Run validation in background (non-blocking)
    validateEntityType(name, type).then((validation) => {
      if (validation?.shouldSuggestCorrection && validation.suggestedType) {
        // Show toast notification
        toast({
          title: "Category suggestion",
          description: `"${name}" was added as ${type} but appears to be ${validation.suggestedType}. Would you like to move it?`,
          action: {
            label: "Move",
            onClick: () => {
              setRoutingDialog({
                open: true,
                entity: { name, version, priority },
                currentType: type,
                suggestedType: validation.suggestedType,
                message: validation.message || ""
              });
            }
          },
          duration: 10000,
        });
      }
    }).catch((error) => {
      console.error("Background validation failed:", error);
    });
  } finally {
    setLoadingState(type, false);
    setLoadingState('techStackKeyword', false);
  }
}
```

**User Experience:**
- User clicks "Add" → Item added immediately → Waits 2-4s (addItem) → Success
- Background: Validation runs → If mismatch, show toast with "Move" action
- **Total perceived time: 2-4 seconds (50-75% faster)**

**Additional Import Added:**
```typescript
import { toast } from "@/hooks/use-toast";
```

## How to Rollback

### Option 1: Git Revert (Recommended)
```bash
# Find the commit hash
git log --oneline frontend/src/pages/dashboard/tech-stack/tech-stack.tsx

# Revert the specific commit
git revert <commit-hash>
```

### Option 2: Manual Restore

1. Open `frontend/src/pages/dashboard/tech-stack/tech-stack.tsx`

2. Find the `handleAddItem` function (around line 94)

3. Replace the entire function with the "Before" version above

4. Remove the toast import if not used elsewhere:
```typescript
// Remove this line:
import { toast } from "@/hooks/use-toast";
```

5. Delete this rollback file:
```bash
rm frontend/src/pages/dashboard/tech-stack/ROLLBACK-non-blocking-validation.md
```

## When to Rollback

Consider rolling back if:
1. ❌ Users report items being added to wrong categories frequently
2. ❌ Toast notifications are too intrusive or not noticed
3. ❌ Background validation causes performance issues
4. ❌ Routing dialog doesn't work correctly when triggered from toast
5. ❌ Users prefer upfront validation before adding

## Testing Checklist

After rollback, verify:
- [ ] Adding items shows routing dialog BEFORE adding (not after)
- [ ] Validation blocks the add operation
- [ ] No toast notifications appear
- [ ] All existing functionality works as before
- [ ] No console errors

## Notes

The non-blocking approach trades immediate categorization correctness for perceived speed. Items may be temporarily in the wrong category until the user acts on the toast notification.

If rollback is needed, consider these alternatives:
1. Faster AI model (gpt-4o-mini instead of GPT-4-turbo)
2. Known vendor mappings to bypass AI for common items
3. Skip validation entirely for certain entity types
4. Cache validation results more aggressively
