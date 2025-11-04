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

// DELETE /api/tech-stack/bulk-delete - Delete all items of a type or across all types
export async function bulkDelete(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    const { type } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // If no type specified, delete all items across all categories
    if (!type || type === "all") {
      await db.transaction(async (tx) => {
        await Promise.all([
          // Delete all software
          tx
            .delete(usersSoftware)
            .where(eq(usersSoftware.userId, userId)),
          
          // Delete all hardware
          tx
            .delete(usersHardware)
            .where(eq(usersHardware.userId, userId)),
          
          // Delete all companies (vendors and clients)
          tx
            .delete(usersCompanies)
            .where(eq(usersCompanies.userId, userId)),
        ]);
      });
      
      res.json({
        success: true,
        message: "Deleted all items from tech stack",
      });
    } else {
      // Delete specific category
      switch (type) {
        case "software":
          await db
            .delete(usersSoftware)
            .where(eq(usersSoftware.userId, userId));
          break;

        case "hardware":
          await db
            .delete(usersHardware)
            .where(eq(usersHardware.userId, userId));
          break;

        case "vendor":
          await db
            .delete(usersCompanies)
            .where(
              and(
                eq(usersCompanies.userId, userId),
                eq(usersCompanies.relationshipType, "vendor")
              )
            );
          break;

        case "client":
          await db
            .delete(usersCompanies)
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
        message: `Deleted all ${type} items`,
      });
    }

    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch((error) => {
      log(`Error triggering relevance recalculation: ${error}`, "error");
    });
  } catch (error: any) {
    console.error("Tech stack bulk delete error:", error);
    log(`Error bulk deleting tech stack items: ${error.message || error}`, "error");
    res.status(500).json({ error: "Failed to bulk delete tech stack items" });
  }
}
