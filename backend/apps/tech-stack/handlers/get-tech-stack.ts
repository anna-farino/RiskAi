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
import { globalArticles, globalSources } from "../../../../shared/db/schema/global-tables";
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
} from "../../../../shared/db/schema/threat-tracker/entity-associations";
import { eq, and, sql } from "drizzle-orm";
import { log } from "../../../utils/log";
import { getUserTierLevel } from "../../../services/unified-storage/utils/get-user-tier-level";

export async function getTechStack(req: any, res: Response) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userTierLevel = await getUserTierLevel(userId)

    // Fetch software with threat level breakdowns
    // Note: We can't filter by threat indicators in SQL as threat keywords are matched dynamically in memory
    const softwareResults = await db
      .select({
        id: software.id,
        name: software.name,
        version: usersSoftware.version,
        priority: usersSoftware.priority,
        company: companies.name,
        isActive: usersSoftware.isActive,
        createdAt: usersSoftware.createdAt,
        criticalCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical' AND ${usersSoftware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        highCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high' AND ${usersSoftware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        mediumCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'medium' AND ${usersSoftware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        lowCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'low' AND ${usersSoftware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
      })
      .from(usersSoftware)
      .innerJoin(software, eq(usersSoftware.softwareId, software.id))
      .leftJoin(companies, eq(software.companyId, companies.id))
      .leftJoin(articleSoftware, eq(articleSoftware.softwareId, software.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleSoftware.articleId),
          eq(globalArticles.isCybersecurity, true)
        ),
      )
      .leftJoin(globalSources, eq(globalSources.id,globalArticles.sourceId))
      .where(eq(usersSoftware.userId, userId))
      .groupBy(
        software.id,
        software.name,
        usersSoftware.version,
        usersSoftware.priority,
        usersSoftware.isActive,
        usersSoftware.createdAt,
        companies.name,
      );

    // Fetch hardware with threat level breakdowns
    // Note: We can't filter by threat indicators in SQL as threat keywords are matched dynamically in memory
    const hardwareResults = await db
      .select({
        id: hardware.id,
        name: hardware.name,
        manufacturer: hardware.manufacturer,
        model: hardware.model,
        version: sql<string>`NULL`,
        priority: usersHardware.priority,
        isActive: usersHardware.isActive,
        createdAt: usersHardware.createdAt,
        criticalCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical' AND ${usersHardware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        highCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high' AND ${usersHardware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        mediumCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'medium' AND ${usersHardware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        lowCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'low' AND ${usersHardware.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
      })
      .from(usersHardware)
      .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
      .leftJoin(articleHardware, eq(articleHardware.hardwareId, hardware.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleHardware.articleId),
          eq(globalArticles.isCybersecurity, true)
        ),
      )
      .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))
      .where(eq(usersHardware.userId, userId))
      .groupBy(
        hardware.id,
        hardware.name,
        hardware.manufacturer,
        hardware.model,
        usersHardware.priority,
        usersHardware.isActive,
        usersHardware.createdAt,
      );

    // Fetch vendors with threat level breakdowns
    // Note: We can't filter by threat indicators in SQL as threat keywords are matched dynamically in memory
    const vendorResults = await db
      .select({
        id: companies.id,
        name: companies.name,
        version: sql<string>`NULL`,
        priority: usersCompanies.priority,
        metadata: usersCompanies.metadata,
        isActive: usersCompanies.isActive,
        createdAt: usersCompanies.createdAt,
        criticalCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        highCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        mediumCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'medium' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        lowCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'low' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleCompanies.articleId),
          eq(globalArticles.isCybersecurity, true)
        ),
      )
      .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))
      .where(
        and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.relationshipType, "vendor")
        ),
      )
      .groupBy(
        companies.id,
        companies.name,
        usersCompanies.priority,
        usersCompanies.metadata,
        usersCompanies.isActive,
        usersCompanies.createdAt,
      );

    // Fetch clients with threat level breakdowns
    // Note: We can't filter by threat indicators in SQL as threat keywords are matched dynamically in memory
    const clientResults = await db
      .select({
        id: companies.id,
        name: companies.name,
        version: sql<string>`NULL`,
        priority: usersCompanies.priority,
        isActive: usersCompanies.isActive,
        createdAt: usersCompanies.createdAt,
        criticalCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'critical' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        highCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'high' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        mediumCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'medium' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
        lowCount: sql<number>`
          COALESCE(COUNT(*) FILTER (WHERE ${globalArticles.threatLevel} = 'low' AND ${usersCompanies.isActive} = true AND ${globalSources.requiredTierLevel} <= ${userTierLevel}), 0)
        `,
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleCompanies.articleId),
          eq(globalArticles.isCybersecurity, true)
        ),
      )
      .leftJoin(globalSources, eq(globalSources.id, globalArticles.sourceId))
      .where(
        and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.relationshipType, "client")
        ),
      )
      .groupBy(companies.id, companies.name, usersCompanies.priority, usersCompanies.isActive, usersCompanies.createdAt);

    // Format response with severity level counts
    const response = {
      software: softwareResults.map((s) => ({
        id: s.id,
        name: s.name,
        company: s.company,
        version: s.version,
        priority: s.priority,
        isActive: s.isActive,
        criticalCount: parseInt(s.criticalCount?.toString() || "0"),
        highCount: parseInt(s.highCount?.toString() || "0"),
        mediumCount: parseInt(s.mediumCount?.toString() || "0"),
        lowCount: parseInt(s.lowCount?.toString() || "0"),
        createdAt: s.createdAt
      })),
      hardware: hardwareResults.map((h) => ({
        id: h.id,
        name: h.name,
        manufacturer: h.manufacturer,
        model: h.model,
        version: h.version,
        priority: h.priority,
        isActive: h.isActive,
        criticalCount: parseInt(h.criticalCount?.toString() || "0"),
        highCount: parseInt(h.highCount?.toString() || "0"),
        mediumCount: parseInt(h.mediumCount?.toString() || "0"),
        lowCount: parseInt(h.lowCount?.toString() || "0"),
        createdAt: h.createdAt
      })),
      vendors: vendorResults.map((v) => ({
        id: v.id,
        name: v.name,
        version: v.version,
        priority: v.priority,
        isActive: v.isActive,
        source: (v.metadata as any)?.source || "manual", // Extract source from metadata
        criticalCount: parseInt(v.criticalCount?.toString() || "0"),
        highCount: parseInt(v.highCount?.toString() || "0"),
        mediumCount: parseInt(v.mediumCount?.toString() || "0"),
        lowCount: parseInt(v.lowCount?.toString() || "0"),
        createdAt: v.createdAt
      })),
      clients: clientResults.map((c) => ({
        id: c.id,
        name: c.name,
        version: c.version,
        priority: c.priority,
        isActive: c.isActive,
        criticalCount: parseInt(c.criticalCount?.toString() || "0"),
        highCount: parseInt(c.highCount?.toString() || "0"),
        mediumCount: parseInt(c.mediumCount?.toString() || "0"),
        lowCount: parseInt(c.lowCount?.toString() || "0"),
        createdAt: c.createdAt
      })),
    };

    res.json(response);
  } catch (error: any) {
    console.error("Tech stack GET endpoint error details:", error);
    console.error("Error stack:", error.stack);
    log(`Error fetching tech stack: ${error.message || error}`, "error");
    res.status(500).json({
      error: "Failed to fetch tech stack",
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
}
