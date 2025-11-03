import { Response } from "express";
import { db } from "../../../db/db";
import {
  usersSoftware,
  usersHardware,
  usersCompanies,
} from "../../../../shared/db/schema/threat-tracker/user-associations";
import { eq, and } from "drizzle-orm";
import { log } from "../../../utils/log";
import { relevanceScorer } from "../../threat-tracker/services/relevance-scorer";

// PUT /api/tech-stack/:itemId/toggle - Enable/disable item in tech stack (soft delete)
export async function toggleItem(req: any, res: Response) {
  try {
    const { itemId } = req.params;
    const { type, isActive } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!type || !itemId || isActive === undefined) {
      return res
        .status(400)
        .json({ error: "Type, itemId, and isActive are required" });
    }

    // Toggle isActive status in appropriate junction table based on type
    switch (type) {
      case "software":
        await db
          .update(usersSoftware)
          .set({
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined, // Update addedAt when re-enabling
          })
          .where(
            and(
              eq(usersSoftware.userId, userId),
              eq(usersSoftware.softwareId, itemId),
            ),
          );
        break;

      case "hardware":
        await db
          .update(usersHardware)
          .set({
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined,
          })
          .where(
            and(
              eq(usersHardware.userId, userId),
              eq(usersHardware.hardwareId, itemId),
            ),
          );
        break;

      case "vendor":
      case "client":
        await db
          .update(usersCompanies)
          .set({
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined,
          })
          .where(
            and(
              eq(usersCompanies.userId, userId),
              eq(usersCompanies.companyId, itemId),
            ),
          );
        break;

      default:
        return res.status(400).json({ error: "Invalid type" });
    }

    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch((error) => {
      log(`Error triggering relevance recalculation: ${error}`, "error");
    });

    res.json({
      success: true,
      message: `${isActive ? "Enabled" : "Disabled"} item in ${type} stack`,
      isActive: isActive,
    });
  } catch (error: any) {
    console.error("Tech stack TOGGLE error:", error);
    log(`Error toggling tech stack item: ${error.message || error}`, "error");
    res.status(500).json({ error: "Failed to toggle item in tech stack" });
  }
}
