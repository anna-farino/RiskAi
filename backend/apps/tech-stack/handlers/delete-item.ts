import { Response } from "express";
import { db } from "../../../db/db";
import {
  usersSoftware,
  usersHardware,
  usersCompanies,
} from "../../../../shared/db/schema/threat-tracker/user-associations";
import {
  software,
  hardware,
  companies,
} from "../../../../shared/db/schema/threat-tracker/entities";
import { eq, and } from "drizzle-orm";
import { log } from "../../../utils/log";
import { relevanceScorer } from "../../threat-tracker/services/relevance-scorer";

// DELETE /api/tech-stack/:itemId - Hard delete - completely removes item from tech stack
export async function deleteItem(req: any, res: Response) {
  try {
    const { itemId } = req.params;
    const { type } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!type || !itemId) {
      return res.status(400).json({ error: "Type and itemId are required" });
    }

    // Hard delete from appropriate junction table based on type
    switch (type) {
      case "software":
        await db
          .delete(usersSoftware)
          .where(
            and(
              eq(usersSoftware.userId, userId),
              eq(usersSoftware.softwareId, itemId),
            ),
          );
        break;

      case "hardware":
        await db
          .delete(usersHardware)
          .where(
            and(
              eq(usersHardware.userId, userId),
              eq(usersHardware.hardwareId, itemId),
            ),
          );
        break;

      case "vendor":
      case "client":
        // Check if vendor is auto-added (warn user about dependent items)
        const vendorInfo = await db
          .select({
            metadata: usersCompanies.metadata,
          })
          .from(usersCompanies)
          .where(
            and(
              eq(usersCompanies.userId, userId),
              eq(usersCompanies.companyId, itemId),
            ),
          )
          .limit(1);

        const source = (vendorInfo[0]?.metadata as any)?.source;
        if (vendorInfo.length > 0 && source?.includes("auto-")) {
          // Check for dependent software/hardware
          const companyDetails = await db
            .select({
              name: companies.name,
            })
            .from(companies)
            .where(eq(companies.id, itemId))
            .limit(1);

          const dependentSoftware = await db
            .select({
              name: software.name,
            })
            .from(software)
            .innerJoin(usersSoftware, eq(usersSoftware.softwareId, software.id))
            .where(
              and(
                eq(usersSoftware.userId, userId),
                eq(software.companyId, itemId),
                eq(usersSoftware.isActive, true),
              ),
            );

          const dependentHardware = await db
            .select({
              name: hardware.name,
              manufacturer: hardware.manufacturer,
            })
            .from(hardware)
            .innerJoin(usersHardware, eq(usersHardware.hardwareId, hardware.id))
            .where(
              and(
                eq(usersHardware.userId, userId),
                eq(hardware.manufacturer, companyDetails[0]?.name),
                eq(usersHardware.isActive, true),
              ),
            );

          if (dependentSoftware.length > 0 || dependentHardware.length > 0) {
            console.log(
              `Warning: Removing auto-added vendor ${itemId} with dependencies:`,
              {
                software: dependentSoftware.map((s) => s.name),
                hardware: dependentHardware.map((h) => h.name),
              },
            );
          }
        }

        await db
          .delete(usersCompanies)
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
      message: `Permanently removed item from ${type} stack`,
    });
  } catch (error: any) {
    console.error("Tech stack DELETE error:", error);
    log(`Error removing tech stack item: ${error.message || error}`, "error");
    res.status(500).json({ error: "Failed to remove item from tech stack" });
  }
}
