# Development Scraping Toggle Feature Plan

**Date**: October 20, 2025
**Status**: Planning - Not Yet Implemented

## Overview

Add a toggle in Settings page (visible only to developers in development environment) to temporarily enable/disable global scraping, with ability to stop in-progress scrapes gracefully.

## Goals

1. Allow developers to control scraping during development
2. Stop in-progress scrapes gracefully (between sources and articles)
3. Only accessible to authorized developers
4. Simple in-memory implementation
5. Safe default (resets on server restart)

## Requirements

- **Visibility**: Only when `NODE_ENV === 'development'`
- **Authorization**: User email must exist in `devs_allowed_logs` table
- **Graceful Stop**: Leverage existing `globalJobRunning` and `activeScraping` checks
- **State Management**: In-memory (no Redis/database needed)

## Technical Implementation

### 1. Backend - Scraping Control Module

**File**: `backend/services/scraping-control.ts` (NEW)

```typescript
// In-memory scraping control state
let scrapingEnabled = true;

export function getScrapingEnabled(): boolean {
  return scrapingEnabled;
}

export function enableScraping(): void {
  scrapingEnabled = true;
  console.log('[SCRAPING-CONTROL] Global scraping enabled');
}

export function disableScraping(): void {
  scrapingEnabled = false;
  console.log('[SCRAPING-CONTROL] Global scraping disabled');
}

export function stopCurrentScrape(): void {
  scrapingEnabled = false;
  console.log('[SCRAPING-CONTROL] Stopping current scrape gracefully');
  // Note: activeScraping Map is managed in global-scraper.ts
  // This flag will be checked between sources and articles
}
```

### 2. Backend - Update Global Scraper

**File**: `backend/services/global-scraping/global-scraper.ts`

**Changes needed**:

1. Import scraping control:
```typescript
import { getScrapingEnabled } from '../scraping-control';
```

2. Replace `globalJobRunning` check at line 323:
```typescript
// Before:
if (globalJobRunning) {
  return { ... };
}

// After:
if (globalJobRunning || !getScrapingEnabled()) {
  return {
    success: false,
    message: !getScrapingEnabled()
      ? "Global scraping is currently disabled"
      : "A global scraping job is already running",
    totalProcessed: 0,
    totalSaved: 0,
    sourceResults: []
  };
}
```

3. Add check in source loop at line 363:
```typescript
// Before:
if (!globalJobRunning) {
  log(`[UNIFIED GLOBAL] Global scrape job was stopped, aborting remaining sources`, "scraper");
  break;
}

// After:
if (!globalJobRunning || !getScrapingEnabled()) {
  log(`[UNIFIED GLOBAL] Global scrape job was stopped, aborting remaining sources`, "scraper");
  break;
}
```

4. Add check in article loop at line 117:
```typescript
// Before:
if (!activeScraping.get(sourceId)) {
  log(`[Global Scraping] Stopping scrape for source ID: ${sourceId} as requested`, "scraper");
  break;
}

// After:
if (!activeScraping.get(sourceId) || !getScrapingEnabled()) {
  log(`[Global Scraping] Stopping scrape for source ID: ${sourceId} as requested`, "scraper");
  break;
}
```

### 3. Backend - API Endpoint

**File**: `backend/handlers/scraping-control.ts` (NEW)

```typescript
import { Response } from 'express';
import { FullRequest } from 'backend/middleware';
import { db } from 'backend/db/db';
import { devsAllowedLogs } from '@shared/db/schema/devs-allowed-logs';
import { eq } from 'drizzle-orm';
import {
  getScrapingEnabled,
  enableScraping,
  disableScraping,
  stopCurrentScrape
} from 'backend/services/scraping-control';

export default async function handleScrapingControlToggle(
  req: FullRequest,
  res: Response
) {
  try {
    // Check 1: Development environment only
    if (process.env.NODE_ENV !== 'development') {
      return res.status(403).json({
        error: 'This feature is only available in development'
      });
    }

    // Check 2: User must be in devs_allowed_logs
    const { email } = req.user;
    const allowedDevs = await db
      .select()
      .from(devsAllowedLogs)
      .where(eq(devsAllowedLogs.email, email.toLowerCase()))
      .limit(1);

    if (allowedDevs.length === 0) {
      return res.status(403).json({
        error: 'Not authorized to control scraping'
      });
    }

    // Get desired state from body
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        error: 'Invalid request. Expected { enabled: boolean }'
      });
    }

    // Update scraping state
    if (enabled) {
      enableScraping();
    } else {
      stopCurrentScrape(); // This also disables
    }

    console.log(`[SCRAPING-CONTROL] Scraping ${enabled ? 'enabled' : 'disabled'} by ${email}`);

    return res.json({
      enabled: getScrapingEnabled(),
      message: enabled
        ? 'Global scraping enabled'
        : 'Global scraping disabled (stops gracefully)'
    });

  } catch (error) {
    console.error('[SCRAPING-CONTROL] Error:', error);
    return res.status(500).json({
      error: 'Failed to update scraping control'
    });
  }
}
```

### 4. Backend - Register Route

**File**: `backend/router/index.ts`

Add import:
```typescript
import handleScrapingControlToggle from "backend/handlers/scraping-control";
```

Add route (after other protected routes):
```typescript
router.post("/scraping-control/toggle", handleScrapingControlToggle)
```

### 5. Backend - Auth Check Updates

**File**: `backend/handlers/auth-check.ts`

Add imports:
```typescript
import { devsAllowedLogs } from '@shared/db/schema/devs-allowed-logs';
import { getScrapingEnabled } from 'backend/services/scraping-control';
```

Add after subscription check:
```typescript
// Check if user is an authorized developer (for dev features)
let isDevAllowed = false;
let scrapingEnabled = undefined;

if (process.env.NODE_ENV === 'development') {
  const devCheck = await db
    .select()
    .from(devsAllowedLogs)
    .where(eq(devsAllowedLogs.email, user.email.toLowerCase()))
    .limit(1);

  isDevAllowed = devCheck.length > 0;
  if (isDevAllowed) {
    scrapingEnabled = getScrapingEnabled();
  }
}
```

Update response:
```typescript
const jsonResponse = {
  authenticated: true,
  user: [
    {
      ...user,
      subscription: subscriptionName,
      hasPromoCode,
      promoInfo,
      isDevAllowed,
      scrapingEnabled,
      permissions: (req as unknown as FullRequest).user.permissions,
      role: (req as unknown as FullRequest).user.role,
      password: "hidden",
      organizationName: organizationName || undefined
    }
  ]
}
```

### 6. Frontend - User Type Extension

**File**: `frontend/src/hooks/use-auth.ts`

```typescript
export type UserWithPerm = User
  & { permissions: string[] }
  & { role: Role }
  & { subscription: string }
  & { hasPromoCode?: boolean }
  & { promoInfo?: { description?: string } }
  & { isDevAllowed?: boolean }
  & { scrapingEnabled?: boolean }
```

### 7. Frontend - Settings Toggle

**File**: `frontend/src/pages/dashboard/Settings.tsx`

Add state:
```typescript
const [ scrapingEnabled, setScrapingEnabled ] = useState(
  userData.data?.scrapingEnabled ?? true
);
```

Add mutation:
```typescript
const scrapingControlMutation = useMutation({
  mutationFn: async (enabled: boolean) => {
    const response = await fetchWithAuth('/api/scraping-control/toggle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!response.ok) throw new Error('Failed to update scraping control');
    return response.json();
  },
  onSuccess: (data) => {
    setScrapingEnabled(data.enabled);
    userData.refetch();
  },
  onError: (error) => {
    console.error(error);
    setError(true);
    setTimeout(() => setError(false), 3000);
  }
});
```

Add toggle section (after Subscription section, before 2FA):
```tsx
{/* Developer Controls - Only visible in dev mode for authorized devs */}
{import.meta.env.DEV && userData.data?.isDevAllowed && (
  <div className="bg-slate-900/70 dark:bg-slate-900/70 backdrop-blur-sm border border-slate-700/50 rounded-md transition-all duration-300 mx-4 lg:mx-0">
    <div className="p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-500/10 rounded-lg">
          <Wrench className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-white">Developer Controls</h2>
          <p className="text-sm text-slate-400">Development-only features</p>
        </div>
      </div>

      <div className="space-y-4">
        {/* Scraping Control Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <Label className="text-base font-medium text-white">
              Global Scraping
            </Label>
            <p className="text-sm text-slate-400 mt-1">
              Control scheduled scraping jobs. Stops gracefully between sources/articles.
            </p>
          </div>
          <Switch
            checked={scrapingEnabled}
            onCheckedChange={(checked) => {
              scrapingControlMutation.mutate(checked);
            }}
            disabled={scrapingControlMutation.isPending}
          />
        </div>
      </div>
    </div>
  </div>
)}
```

Add import:
```typescript
import { Wrench } from "lucide-react";
```

## Behavior & Edge Cases

### State Transitions

| Current State | Action | Result |
|--------------|--------|--------|
| Enabled, no job running | Disable | Immediately disabled, next scheduled run won't start |
| Enabled, job running | Disable | Job stops gracefully between sources/articles |
| Disabled | Enable | Next scheduled run will start normally |
| Server restart | - | Resets to `enabled: true` (safe default) |

### Graceful Stop Points

When disabled mid-scrape:
1. **Between sources**: Loop checks `getScrapingEnabled()` at line 363
2. **Between articles**: Loop checks `getScrapingEnabled()` at line 117
3. **Current article**: Completes processing (doesn't abort mid-article)

### Authorization Flow

```
User requests toggle
  ↓
Check NODE_ENV === 'development'
  ↓
Check email in devs_allowed_logs
  ↓
Update in-memory flag
  ↓
Return new state
```

## Testing Plan

1. **Visibility Test**:
   - Verify toggle only appears when `DEV=true` AND user in `devs_allowed_logs`
   - Verify toggle hidden in production or for non-dev users

2. **State Test**:
   - Toggle OFF → verify next scheduled scrape doesn't start
   - Toggle ON → verify scraping resumes on next schedule

3. **Graceful Stop Test**:
   - Start scrape manually
   - Toggle OFF while running
   - Verify stops between sources or articles (check logs)

4. **Server Restart Test**:
   - Disable scraping
   - Restart backend
   - Verify resets to enabled

## Future Enhancements

1. **Persistent State**: Store in database instead of in-memory
2. **Manual Trigger**: Add "Run Now" button for immediate scrape
3. **Schedule Override**: Temporarily change schedule intervals
4. **Per-App Control**: Separate toggles for News Radar vs Threat Tracker
5. **Activity Log**: Track who enabled/disabled and when

## References

- Existing scraping infrastructure: `backend/services/global-scraper.ts`
- Existing dev permissions: `backend/services/live-logs/permissions.ts`
- Scheduler metadata: `@shared/db/schema/scheduler-metadata`
- DevAllowedLogs table: `@shared/db/schema/devs-allowed-logs`
