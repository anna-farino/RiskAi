import { Request, Response } from "express";
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
import { eq, and, sql } from "drizzle-orm";

// GET /api/tech-stack/autocomplete - Search for entities to add to tech stack
export async function autocomplete(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { type, query } = req.query;

    if (!type || !query) {
      return res
        .status(400)
        .json({ error: "Type and query parameters required" });
    }

    const searchQuery = `%${query.toLowerCase()}%`;
    const limit = 10;

    let results = [];

    if (type === "software") {
      // Search for software with company names
      const softwareItems = await db
        .select({
          id: software.id,
          name: software.name,
          normalizedName: software.normalizedName,
          category: software.category,
          companyName: companies.name,
        })
        .from(software)
        .leftJoin(companies, eq(software.companyId, companies.id))
        .where(
          sql`LOWER(${software.name}) LIKE ${searchQuery} OR LOWER(COALESCE(${companies.name}, '')) LIKE ${searchQuery}`,
        )
        .orderBy(
          sql`
          CASE
            WHEN LOWER(${software.name}) LIKE ${query.toLowerCase() + "%"} THEN 1
            WHEN LOWER(COALESCE(${companies.name}, '')) LIKE ${query.toLowerCase() + "%"} THEN 2
            WHEN LOWER(${software.name}) LIKE ${"% " + query.toLowerCase() + "%"} THEN 3
            ELSE 4
          END,
          ${software.name}
        `,
        )
        .limit(limit);

      // Get existing user software to filter out
      const existingSoftware = await db
        .select({ softwareId: usersSoftware.softwareId })
        .from(usersSoftware)
        .where(
          and(
            eq(usersSoftware.userId, userId),
            eq(usersSoftware.isActive, true),
          ),
        );

      const existingIds = new Set(existingSoftware.map((s) => s.softwareId));

      results = softwareItems
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          company: item.companyName,
          category: item.category,
          type: "software",
        }));
    } else if (type === "hardware") {
      // Search for hardware
      const hardwareItems = await db
        .select({
          id: hardware.id,
          name: hardware.name,
          manufacturer: hardware.manufacturer,
          model: hardware.model,
          category: hardware.category,
        })
        .from(hardware)
        .where(
          sql`LOWER(${hardware.name}) LIKE ${searchQuery} OR LOWER(${hardware.manufacturer}) LIKE ${searchQuery}`,
        )
        .orderBy(
          sql`
          CASE
            WHEN LOWER(${hardware.name}) LIKE ${query.toLowerCase() + "%"} THEN 1
            WHEN LOWER(${hardware.manufacturer}) LIKE ${query.toLowerCase() + "%"} THEN 2
            WHEN LOWER(${hardware.name}) LIKE ${"% " + query.toLowerCase() + "%"} THEN 3
            ELSE 4
          END,
          ${hardware.name}
        `,
        )
        .limit(limit);

      // Get existing user hardware to filter out
      const existingHardware = await db
        .select({ hardwareId: usersHardware.hardwareId })
        .from(usersHardware)
        .where(
          and(
            eq(usersHardware.userId, userId),
            eq(usersHardware.isActive, true),
          ),
        );

      const existingIds = new Set(existingHardware.map((h) => h.hardwareId));

      results = hardwareItems
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          manufacturer: item.manufacturer,
          model: item.model,
          category: item.category,
          type: "hardware",
        }));
    } else if (type === "vendor" || type === "client") {
      // Search for companies
      const companyItems = await db
        .select({
          id: companies.id,
          name: companies.name,
          normalizedName: companies.normalizedName,
        })
        .from(companies)
        .where(sql`LOWER(${companies.name}) LIKE ${searchQuery}`)
        .orderBy(
          sql`
          CASE
            WHEN LOWER(${companies.name}) LIKE ${query.toLowerCase() + "%"} THEN 1
            WHEN LOWER(${companies.name}) LIKE ${"% " + query.toLowerCase() + "%"} THEN 2
            ELSE 3
          END,
          ${companies.name}
        `,
        )
        .limit(limit);

      // Get existing user companies for this relationship type
      const existingCompanies = await db
        .select({ companyId: usersCompanies.companyId })
        .from(usersCompanies)
        .where(
          and(
            eq(usersCompanies.userId, userId),
            eq(
              usersCompanies.relationshipType,
              type === "vendor" ? "vendor" : "client",
            ),
            eq(usersCompanies.isActive, true),
          ),
        );

      const existingIds = new Set(existingCompanies.map((c) => c.companyId));

      results = companyItems
        .filter((item) => !existingIds.has(item.id))
        .map((item) => ({
          id: item.id,
          name: item.name,
          type: type,
        }));
    }

    res.json({ results });
  } catch (error: any) {
    console.error("Autocomplete endpoint error:", error);
    res.status(500).json({
      error: "Failed to fetch autocomplete suggestions",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
