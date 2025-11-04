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

// PUT /api/tech-stack/bulk-toggle - Enable/disable all items of a type or across all types
export async function bulkToggle(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    const { type, isActive } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (isActive === undefined) {
      return res.status(400).json({ error: "isActive is required" });
    }

    // If no type specified, toggle all items across all categories
    if (!type || type === "all") {
      await db.transaction(async (tx) => {
        await Promise.all([
          // Toggle all software
          tx
            .update(usersSoftware)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(eq(usersSoftware.userId, userId)),
          
          // Toggle all hardware
          tx
            .update(usersHardware)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(eq(usersHardware.userId, userId)),
          
          // Toggle all companies (vendors and clients)
          tx
            .update(usersCompanies)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(eq(usersCompanies.userId, userId)),
        ]);
      });
      
      res.json({
        success: true,
        message: `${isActive ? "Enabled" : "Disabled"} all items in tech stack`,
      });
    } else {
      // Toggle specific category
      switch (type) {
        case "software":
          await db
            .update(usersSoftware)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(eq(usersSoftware.userId, userId));
          break;

        case "hardware":
          await db
            .update(usersHardware)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(eq(usersHardware.userId, userId));
          break;

        case "vendor":
          await db
            .update(usersCompanies)
            .set({
              isActive: isActive,
              addedAt: isActive ? new Date() : undefined,
            })
            .where(
              and(
                eq(usersCompanies.userId, userId),
                eq(usersCompanies.relationshipType, "vendor")
              )
            );
          break;

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
                eq(usersCompanies.relationshipType, "client")
              )
            );
          break;

        default:
          return res.status(400).json({ error: "Invalid type" });
      }
      
      res.json({
        success: true,
        message: `${isActive ? "Enabled" : "Disabled"} all ${type} items`,
      });
    }

    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch((error) => {
      log(`Error triggering relevance recalculation: ${error}`, "error");
    });
  } catch (error: any) {
    console.error("Tech stack bulk toggle error:", error);
    log(`Error bulk toggling tech stack items: ${error.message || error}`, "error");
    res.status(500).json({ error: "Failed to bulk toggle tech stack items" });
  }
}
