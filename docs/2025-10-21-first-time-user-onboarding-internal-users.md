# First-Time User Onboarding & Internal User System

**Date**: October 21, 2025
**Status**: Planning / Not Yet Implemented

---

## Requirements

### First-Time User Onboarding
1. **Mandatory Pricing View**: New users must see pricing view on first login
2. **No Escape Route**: No back button - user must select a plan to proceed
3. **Limited Choices**: Only Free and Pro plans available (Team and Enterprise disabled)
4. **One-Time Flow**: After selecting plan, never show onboarding again

### Internal User System
1. **Unrestricted Access**: Internal users bypass all subscription restrictions
2. **Full App Access**: Can use entire app regardless of subscription tier
3. **Testing Capability**: Can subscribe/unsubscribe to test subscription flows
4. **Revert to Full Access**: Can always return to unrestricted state
5. **Environment Agnostic**: Works in dev, staging, and production

### Technical Context
- Authentication via Auth0
- New users caught in `auth0middleware.ts` during first login
- Existing subscription system in `subsUser` table
- Need to track onboarding completion state

---

## Database Schema Design

### 1. Update `users` Table

**File**: `shared/db/schema/user.ts`

Add two new boolean fields:

```typescript
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  organizationId: uuid("organization_id").references(() => organizations.id),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  verified: boolean("verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),

  // NEW FIELDS
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false),
  isInternalUser: boolean("is_internal_user").default(false),
});
```

**Field Descriptions**:

- **`hasCompletedOnboarding`**:
  - Default: `false`
  - Set to `true` after user selects their first subscription plan
  - Frontend checks this to decide whether to show onboarding
  - Internal users get `true` by default (skip onboarding)

- **`isInternalUser`**:
  - Default: `false`
  - Set to `true` for internal testers/admins
  - Used throughout app to bypass subscription checks
  - Determined by email/domain during account creation

### 2. Create `internal_user_emails` Table (Recommended)

**File**: `shared/db/schema/user.ts`

New table to manage internal user patterns:

```typescript
export const internalUserEmails = pgTable("internal_user_emails", {
  id: uuid("id").defaultRandom().primaryKey(),
  pattern: text("pattern").notNull().unique(), // email or domain pattern
  description: text("description"), // optional note about who/why
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
```

**Purpose**:
- Centralized management of who gets internal user status
- Supports specific emails: `alice@company.com`
- Supports domains: `altairtek.com` (all @altairtek.com users)
- No code changes needed to add/remove internal users

**Alternative**: Could use existing `allowedEmails` table with additional field, but separate table is cleaner.

---

## Backend Implementation

### 3. Update `auth0middleware.ts`

**File**: `backend/middleware/auth0middleware.ts`

**Current Flow**: Lines 83-101 handle new users who pass whitelist check

**Changes Needed**:

#### A. Add function to check if user is internal

```typescript
import { internalUserEmails } from '@shared/db/schema/user';

async function checkIfInternalUser(email: string, domain: string): Promise<boolean> {
  const [internalPattern] = await db
    .select()
    .from(internalUserEmails)
    .where(
      or(
        eq(internalUserEmails.pattern, email),
        eq(internalUserEmails.pattern, domain)
      )
    )
    .limit(1);

  return !!internalPattern;
}
```

#### B. Update user creation logic (around line 105-120)

```typescript
if (!userFromEmail) {
  // ... existing whitelist check ...

  if (!allowedUser) {
    res.status(401).json({ message: "User not whitelisted" })
    return
  }

  // NEW: Check if user should be internal
  const isInternal = await checkIfInternalUser(email, domain);

  let user: User | undefined;
  try {
    await db.transaction(async (tx) => {
      [user] = await tx
        .insert(users)
        .values({
          email: email,
          name: email,
          password: '',
          organizationId: organizationId && organizationId !== "Missing organization" ? organizationId as string : null,

          // NEW FIELDS
          hasCompletedOnboarding: isInternal, // Internal users skip onboarding
          isInternalUser: isInternal,
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: email,
            name: email,
            password: '',
            organizationId: organizationId && organizationId !== "Missing organization" ? organizationId as string : null,
            // Don't overwrite onboarding/internal status on conflict
          }
        })
        .returning()

      // ... rest of transaction (auth0Ids creation) ...
    })
    // ... rest of logic ...
```

**Key Points**:
- Check internal status BEFORE creating user
- Set both fields during user creation
- Internal users get `hasCompletedOnboarding: true` immediately
- Don't overwrite these fields in `onConflictDoUpdate`

---

### 4. Update `auth-check.ts` Response

**File**: `backend/handlers/auth-check.ts`

**Current**: Lines 72-86 build user response

**Changes**: Add new fields to response

```typescript
const jsonResponse = {
  authenticated: true,
  user: [
    {
      ...user,
      subscription: subscriptionName,
      hasPromoCode,
      promoInfo,
      permissions: (req as unknown as FullRequest).user.permissions,
      role: (req as unknown as FullRequest).user.role,
      password: "hidden",
      organizationName: organizationName || undefined,

      // NEW FIELDS - expose to frontend
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      isInternalUser: user.isInternalUser,
    }
  ]
}
```

**Purpose**: Frontend needs these flags to control routing and features

---

### 5. Create Complete Onboarding Endpoint

**New File**: `backend/handlers/complete-onboarding.ts`

```typescript
import { Request, Response } from 'express';
import { db } from 'backend/db/db';
import { eq } from 'drizzle-orm';
import { users } from '@shared/db/schema/user';
import { subsUser } from '@shared/db/schema/subscriptions';
import { FullRequest } from '../middleware';

export async function handleCompleteOnboarding(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    const { tierId } = req.body; // Free or Pro tier ID

    if (!tierId) {
      return res.status(400).json({ error: "Tier ID required" });
    }

    // Use transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // 1. Mark onboarding as complete
      await tx
        .update(users)
        .set({ hasCompletedOnboarding: true })
        .where(eq(users.id, userId));

      // 2. Create subscription
      await tx.insert(subsUser).values({
        userId,
        tierId,
        status: 'active',
        startDate: new Date(),
        endDate: null, // Ongoing subscription
        stripeCustomerId: null, // Set later if user upgrades
        stripeSubscriptionId: null,
        metadata: {},
      });
    });

    res.json({
      success: true,
      message: "Onboarding completed successfully"
    });

  } catch (error) {
    console.error("Complete onboarding error:", error);
    res.status(500).json({
      error: "Failed to complete onboarding"
    });
  }
}
```

**Register Route** in `backend/router/index.ts`:

```typescript
import { handleCompleteOnboarding } from '../handlers/complete-onboarding';

// After auth middleware, before other routes
router.post("/onboarding/complete", handleCompleteOnboarding);
```

---

### 6. Create Subscription Check Utility

**New File**: `backend/utils/subscription-checks.ts`

```typescript
import { User } from '@shared/db/schema/user';

/**
 * Check if user should bypass subscription restrictions
 * Internal users always have full access
 */
export function bypassSubscriptionChecks(user: User): boolean {
  return user.isInternalUser === true;
}

/**
 * Check if user has access to a specific feature
 * @param user - User object
 * @param feature - Feature identifier (e.g., 'advanced_analytics')
 * @param userSubscription - User's subscription details
 */
export function hasFeatureAccess(
  user: User,
  feature: string,
  userSubscription?: any
): boolean {
  // Internal users bypass all checks
  if (bypassSubscriptionChecks(user)) {
    return true;
  }

  // Otherwise check subscription tier permissions
  // ... existing subscription logic here ...

  return false;
}
```

**Usage Throughout App**:

```typescript
// Example: In any protected route/endpoint
import { bypassSubscriptionChecks } from '../utils/subscription-checks';

if (!bypassSubscriptionChecks(user)) {
  // Check subscription tier
  if (user.subscription !== 'pro') {
    return res.status(403).json({ error: "Pro subscription required" });
  }
}

// Allow access
```

---

## Frontend Implementation

### 7. Update User Type Definition

**File**: `frontend/src/hooks/use-auth.ts`

```typescript
export type Role = 'admin' | 'user'
export type UserWithPerm = User
  & { permissions: string[] }
  & { role: Role }
  & { subscription: string }
  & { hasPromoCode?: boolean }
  & { promoInfo?: { description?: string } }
  & { hasCompletedOnboarding: boolean }  // NEW
  & { isInternalUser: boolean }          // NEW
```

---

### 8. Add Onboarding Check to Dashboard Layout

**File**: `frontend/src/components/layout/DashboardLayout.tsx`

**Location**: After `useAuth()` hook, add routing logic

```typescript
import { useNavigate } from 'react-router-dom';

export default function DashboardLayout() {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { data: userData, isLoading: userDataLoading, error: userDataError } = useAuth();
  const { logout } = useLogout();
  const navigate = useNavigate();

  // NEW: Check onboarding completion
  useEffect(() => {
    if (userData && !userDataLoading) {
      // Skip check for internal users
      if (userData.isInternalUser) {
        return;
      }

      // Redirect to onboarding if not completed
      if (!userData.hasCompletedOnboarding) {
        navigate('/onboarding/pricing', { replace: true });
      }
    }
  }, [userData, userDataLoading, navigate]);

  // ... rest of component ...
}
```

**Key Points**:
- Use `replace: true` so user can't go back
- Check happens after auth is loaded
- Internal users skip this check entirely

---

### 9. Create Onboarding Pricing Component

**New File**: `frontend/src/pages/onboarding/PricingOnboarding.tsx`

```typescript
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFetch } from '@/hooks/use-fetch';
import { useToast } from '@/hooks/use-toast';

export default function PricingOnboarding() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const fetchWithAuth = useFetch();
  const { toast } = useToast();

  const handleSelectPlan = async (tierId: string) => {
    setIsSubmitting(true);

    try {
      const response = await fetchWithAuth('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tierId }),
      });

      if (!response.ok) {
        throw new Error('Failed to complete onboarding');
      }

      toast({
        title: "Welcome!",
        description: "Your account has been set up successfully.",
      });

      // Navigate to dashboard
      navigate('/dashboard', { replace: true });

    } catch (error) {
      console.error('Onboarding error:', error);
      toast({
        title: "Error",
        description: "Failed to complete setup. Please try again.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-slate-400">
            Select a plan to get started with your account
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Free Plan */}
          <div className="bg-slate-900 rounded-lg p-8 border border-slate-700">
            <h3 className="text-2xl font-bold text-white mb-4">Free</h3>
            <p className="text-slate-400 mb-6">Perfect for getting started</p>

            {/* Features list */}
            <ul className="space-y-3 mb-8">
              <li className="text-slate-300">Basic features</li>
              <li className="text-slate-300">Limited usage</li>
            </ul>

            <button
              onClick={() => handleSelectPlan('free-tier-id')}
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-slate-700 hover:bg-slate-600 text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Setting up...' : 'Select Free Plan'}
            </button>
          </div>

          {/* Pro Plan */}
          <div className="bg-[#BF00FF]/10 rounded-lg p-8 border-2 border-[#BF00FF]">
            <h3 className="text-2xl font-bold text-white mb-4">Pro</h3>
            <p className="text-slate-400 mb-6">For power users</p>

            {/* Features list */}
            <ul className="space-y-3 mb-8">
              <li className="text-slate-300">All features</li>
              <li className="text-slate-300">Unlimited usage</li>
            </ul>

            <button
              onClick={() => handleSelectPlan('pro-tier-id')}
              disabled={isSubmitting}
              className="w-full py-3 px-6 bg-[#BF00FF] hover:bg-[#BF00FF]/80 text-white rounded-lg disabled:opacity-50"
            >
              {isSubmitting ? 'Setting up...' : 'Select Pro Plan'}
            </button>
          </div>
        </div>

        {/* Note: No back button - user must choose */}
      </div>
    </div>
  );
}
```

**Add Route** in `frontend/src/App.tsx` or router config:

```typescript
<Route path="/onboarding/pricing" element={<PricingOnboarding />} />
```

---

### 10. Add Frontend Subscription Check Utility

**New File**: `frontend/src/utils/subscription-checks.ts`

```typescript
import { UserWithPerm } from '@/hooks/use-auth';

/**
 * Check if user is internal and bypasses restrictions
 */
export function isInternalUser(user: UserWithPerm | null): boolean {
  return user?.isInternalUser === true;
}

/**
 * Check if user has access to a feature
 */
export function hasFeatureAccess(
  user: UserWithPerm | null,
  requiredTier: 'free' | 'pro' | 'team' | 'enterprise'
): boolean {
  if (!user) return false;

  // Internal users always have access
  if (isInternalUser(user)) return true;

  // Check subscription tier
  const tierHierarchy = ['free', 'pro', 'team', 'enterprise'];
  const userTierIndex = tierHierarchy.indexOf(user.subscription);
  const requiredTierIndex = tierHierarchy.indexOf(requiredTier);

  return userTierIndex >= requiredTierIndex;
}
```

**Usage in Components**:

```typescript
import { hasFeatureAccess, isInternalUser } from '@/utils/subscription-checks';
import { useAuth } from '@/hooks/use-auth';

function AdvancedFeature() {
  const { data: user } = useAuth();

  if (!hasFeatureAccess(user, 'pro')) {
    return <div>Pro subscription required</div>;
  }

  // Show feature
  return <div>Advanced feature content</div>;
}
```

---

## Database Migration

### 11. Generate and Apply Migration

```bash
# Option 1: Direct push (dev/staging)
npm run db:push

# Option 2: Generate migration file (production)
drizzle-kit generate
drizzle-kit migrate
```

### 12. Seed Internal Users Table

**SQL to run after migration**:

```sql
-- Add internal user patterns
INSERT INTO internal_user_emails (pattern, description) VALUES
  ('altairtek.com', 'All Altair Tek internal staff'),
  ('admin@company.com', 'Main admin account');

-- Verify
SELECT * FROM internal_user_emails;
```

**Or via backend script** `backend/scripts/seed-internal-users.ts`:

```typescript
import { db } from '../db/db';
import { internalUserEmails } from '@shared/db/schema/user';

async function seedInternalUsers() {
  const patterns = [
    { pattern: 'altairtek.com', description: 'Altair Tek internal staff' },
    { pattern: 'admin@company.com', description: 'Main admin' },
  ];

  for (const p of patterns) {
    await db.insert(internalUserEmails).values(p).onConflictDoNothing();
  }

  console.log('✅ Internal users seeded');
}

seedInternalUsers();
```

---

## Testing Plan

### Test Scenarios

#### 1. First-Time Regular User
- **Setup**: New email not in `internal_user_emails`
- **Expected**:
  1. User logs in with Auth0
  2. Passes whitelist check
  3. User created with `hasCompletedOnboarding: false`, `isInternalUser: false`
  4. Redirected to `/onboarding/pricing`
  5. Cannot navigate away (no back button)
  6. Selects Free or Pro plan
  7. Redirected to dashboard
  8. Future logins go straight to dashboard

#### 2. First-Time Internal User
- **Setup**: Email matches pattern in `internal_user_emails` (e.g., `@altairtek.com`)
- **Expected**:
  1. User logs in with Auth0
  2. Passes whitelist check
  3. User created with `hasCompletedOnboarding: true`, `isInternalUser: true`
  4. Goes straight to dashboard (skips onboarding)
  5. Has full app access regardless of subscription

#### 3. Internal User Testing Subscriptions
- **Setup**: Internal user wants to test subscription flow
- **Expected**:
  1. Internal user can subscribe to any plan
  2. Subscription shows in UI
  3. Still has full app access (not restricted)
  4. Can cancel subscription
  5. Still has full app access after cancellation

#### 4. Regular User Returning
- **Setup**: User already completed onboarding
- **Expected**:
  1. User logs in
  2. `hasCompletedOnboarding: true` in database
  3. Goes straight to dashboard
  4. No onboarding shown

---

## Implementation Checklist

### Database
- [ ] Add `hasCompletedOnboarding` field to `users` table
- [ ] Add `isInternalUser` field to `users` table
- [ ] Create `internal_user_emails` table
- [ ] Run migration
- [ ] Seed internal user patterns

### Backend
- [ ] Add `checkIfInternalUser()` function to `auth0middleware.ts`
- [ ] Update user creation to set new fields
- [ ] Update `auth-check.ts` to return new fields
- [ ] Create `handleCompleteOnboarding` endpoint
- [ ] Register onboarding route
- [ ] Create `subscription-checks.ts` utility
- [ ] Apply internal user checks throughout app

### Frontend
- [ ] Update `UserWithPerm` type with new fields
- [ ] Add onboarding check to `DashboardLayout`
- [ ] Create `PricingOnboarding` component
- [ ] Add onboarding route
- [ ] Create frontend `subscription-checks.ts` utility
- [ ] Apply feature checks in components
- [ ] Test navigation flow
- [ ] Ensure no back button escape route

### Testing
- [ ] Test first-time regular user flow
- [ ] Test first-time internal user flow
- [ ] Test internal user with subscription
- [ ] Test returning user flow
- [ ] Test all environments (dev, staging, prod)

---

## Edge Cases & Considerations

### What if user closes browser during onboarding?
- `hasCompletedOnboarding` remains `false`
- Next login redirects back to onboarding
- This is desired behavior (must complete onboarding)

### What if internal user is removed from `internal_user_emails`?
- Their `isInternalUser` flag remains `true` in database
- They keep internal status (doesn't retroactively change)
- To revoke: manually update user record or add script

### What about users created before this feature?
- Existing users have `hasCompletedOnboarding: false` by default
- But they already have subscriptions in `subsUser`
- **Solution**: Run migration script to set `hasCompletedOnboarding: true` for all existing users

```sql
-- Mark existing users as having completed onboarding
UPDATE users
SET has_completed_onboarding = true
WHERE created_at < NOW() - INTERVAL '1 hour'; -- All users created before this feature
```

### Can internal users see subscription in UI?
- Yes, if they subscribe for testing
- UI should show subscription tier
- But shouldn't restrict features
- Consider adding badge: "Internal User - Full Access"

---

## Future Enhancements

### Phase 2 Features
1. **Admin Panel**: Manage internal users via UI instead of SQL
2. **Temporary Internal Access**: Set expiration dates for testers
3. **Feature Flags**: More granular control beyond binary internal/external
4. **Onboarding Analytics**: Track completion rates, plan selection
5. **Custom Onboarding**: Different flows for different user types
6. **Trial Period**: 14-day Pro trial for all new users

---

## Related Documentation

- [GitHub Actions Backend Deployment](./github-actions-backend-deployment.md)
- Subscription Schema: `shared/db/schema/subscriptions.ts`
- Auth0 Middleware: `backend/middleware/auth0middleware.ts`
- User Schema: `shared/db/schema/user.ts`

---

## Questions to Resolve Before Implementation

1. **Tier IDs**: What are the actual UUIDs for Free and Pro tiers in `subscription_tiers` table?
2. **UI Design**: Final design for onboarding pricing view?
3. **Analytics**: Do we track onboarding completion in analytics?
4. **Email Notifications**: Send welcome email after onboarding completion?
5. **Stripe Integration**: Does Free tier need Stripe customer creation?
6. **Internal User Badge**: Show visual indicator in UI for internal users?

---

## Implementation Priority

### Must Have (MVP)
- Database schema changes
- Auth0 middleware updates
- Complete onboarding endpoint
- Frontend routing and onboarding component
- Internal user bypass logic

### Should Have
- Frontend subscription check utility
- Internal user emails table (vs hardcoding)
- Proper error handling
- Loading states in UI

### Nice to Have
- Admin panel for managing internal users
- Onboarding analytics
- Welcome email
- Internal user badge in UI

---

**End of Document**

_Last Updated: October 21, 2025_
