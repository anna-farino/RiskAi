import { subscriptionTiers } from "@shared/db/schema/organizations";
import { subsUser } from "@shared/db/schema/subscriptions";
import { users } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";

export async function getUserTierLevel(userId: string): Promise<number> {
  // Check if user has sub_free enabled with no-sub mode
  const [user] = await db
    .select({
      subFree: users.subFree,
      noSubModeEnabled: users.noSubModeEnabled
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  // If user is sub_free and has no-sub mode enabled, return tier 9 (unlimited)
  if (user?.subFree && user?.noSubModeEnabled) {
    return 9;
  }

  // Otherwise, get their actual subscription tier
  const result = await db
    .select({ tierLevel: subscriptionTiers.tierLevel })
    .from(subsUser)
    .innerJoin(
      subscriptionTiers,
      eq(subsUser.tierId, subscriptionTiers.id)
    )
    .where(eq(subsUser.userId, userId))
    .limit(1);

  return result[0]?.tierLevel ?? 0;
}
