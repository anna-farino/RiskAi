import { Router } from "express";
import multer from "multer";
import * as XLSX from "xlsx";
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
import { globalArticles } from "../../../../shared/db/schema/global-tables";
import {
  articleSoftware,
  articleHardware,
  articleCompanies,
} from "../../../../shared/db/schema/threat-tracker/entity-associations";
import { eq, and, sql } from "drizzle-orm";
import { log } from "../../../utils/log";
import { relevanceScorer } from "../services/relevance-scorer";
import { EntityManager } from "../../../services/entity-manager";
import { extractArticleEntities, openai } from "../../../services/openai";
import { UploadSecurity } from "../../../services/upload-security";
import { doubleCsrfProtection } from "../../../middleware/csrf";

const router = Router();

// GET /api/tech-stack/autocomplete - Search for entities to add to tech stack
router.get("/autocomplete", async (req: any, res) => {
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
});

// GET /api/tech-stack - Fetch user's tech stack with threat counts
router.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Fetch software with threat counts and company info
    const softwareResults = await db
      .select({
        id: software.id,
        name: software.name,
        version: usersSoftware.version,
        priority: usersSoftware.priority,
        company: companies.name,
        threatCount: sql<number>`COALESCE(COUNT(DISTINCT ${globalArticles.id}), 0)`,
        highestLevel: sql<string>`
          CASE 
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END) > 0 THEN 'critical'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'high' THEN 1 ELSE 0 END) > 0 THEN 'high'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'medium' THEN 1 ELSE 0 END) > 0 THEN 'medium'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'low' THEN 1 ELSE 0 END) > 0 THEN 'low'
            ELSE NULL
          END
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
          eq(globalArticles.isCybersecurity, true),
        ),
      )
      .where(
        and(eq(usersSoftware.userId, userId), eq(usersSoftware.isActive, true)),
      )
      .groupBy(
        software.id,
        software.name,
        usersSoftware.version,
        usersSoftware.priority,
        companies.name,
      );

    // Fetch hardware with threat counts
    const hardwareResults = await db
      .select({
        id: hardware.id,
        name: hardware.name,
        manufacturer: hardware.manufacturer,
        model: hardware.model,
        version: sql<string>`NULL`,
        priority: usersHardware.priority,
        threatCount: sql<number>`COALESCE(COUNT(DISTINCT ${globalArticles.id}), 0)`,
        highestLevel: sql<string>`
          CASE 
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END) > 0 THEN 'critical'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'high' THEN 1 ELSE 0 END) > 0 THEN 'high'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'medium' THEN 1 ELSE 0 END) > 0 THEN 'medium'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'low' THEN 1 ELSE 0 END) > 0 THEN 'low'
            ELSE NULL
          END
        `,
      })
      .from(usersHardware)
      .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
      .leftJoin(articleHardware, eq(articleHardware.hardwareId, hardware.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleHardware.articleId),
          eq(globalArticles.isCybersecurity, true),
        ),
      )
      .where(
        and(eq(usersHardware.userId, userId), eq(usersHardware.isActive, true)),
      )
      .groupBy(
        hardware.id,
        hardware.name,
        hardware.manufacturer,
        hardware.model,
        usersHardware.priority,
      );

    // Fetch vendors with threat counts
    const vendorResults = await db
      .select({
        id: companies.id,
        name: companies.name,
        version: sql<string>`NULL`,
        priority: usersCompanies.priority,
        metadata: usersCompanies.metadata,
        threatCount: sql<number>`COALESCE(COUNT(DISTINCT ${globalArticles.id}), 0)`,
        highestLevel: sql<string>`
          CASE 
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END) > 0 THEN 'critical'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'high' THEN 1 ELSE 0 END) > 0 THEN 'high'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'medium' THEN 1 ELSE 0 END) > 0 THEN 'medium'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'low' THEN 1 ELSE 0 END) > 0 THEN 'low'
            ELSE NULL
          END
        `,
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleCompanies.articleId),
          eq(globalArticles.isCybersecurity, true),
        ),
      )
      .where(
        and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.relationshipType, "vendor"),
          eq(usersCompanies.isActive, true),
        ),
      )
      .groupBy(
        companies.id,
        companies.name,
        usersCompanies.priority,
        usersCompanies.metadata,
      );

    // Fetch clients with threat counts
    const clientResults = await db
      .select({
        id: companies.id,
        name: companies.name,
        version: sql<string>`NULL`,
        priority: usersCompanies.priority,
        threatCount: sql<number>`COALESCE(COUNT(DISTINCT ${globalArticles.id}), 0)`,
        highestLevel: sql<string>`
          CASE 
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'critical' THEN 1 ELSE 0 END) > 0 THEN 'critical'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'high' THEN 1 ELSE 0 END) > 0 THEN 'high'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'medium' THEN 1 ELSE 0 END) > 0 THEN 'medium'
            WHEN SUM(CASE WHEN ${globalArticles.threatLevel} = 'low' THEN 1 ELSE 0 END) > 0 THEN 'low'
            ELSE NULL
          END
        `,
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(
        globalArticles,
        and(
          eq(globalArticles.id, articleCompanies.articleId),
          eq(globalArticles.isCybersecurity, true),
        ),
      )
      .where(
        and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.relationshipType, "client"),
          eq(usersCompanies.isActive, true),
        ),
      )
      .groupBy(companies.id, companies.name, usersCompanies.priority);

    // Format response
    const response = {
      software: softwareResults.map((s) => ({
        id: s.id,
        name: s.name,
        company: s.company,
        version: s.version,
        priority: s.priority,
        threats:
          parseInt(s.threatCount?.toString() || "0") > 0
            ? {
                count: parseInt(s.threatCount?.toString() || "0"),
                highestLevel: s.highestLevel || "low",
              }
            : null,
      })),
      hardware: hardwareResults.map((h) => ({
        id: h.id,
        name: h.name,
        manufacturer: h.manufacturer,
        model: h.model,
        version: h.version,
        priority: h.priority,
        threats:
          parseInt(h.threatCount?.toString() || "0") > 0
            ? {
                count: parseInt(h.threatCount?.toString() || "0"),
                highestLevel: h.highestLevel || "low",
              }
            : null,
      })),
      vendors: vendorResults.map((v) => ({
        id: v.id,
        name: v.name,
        version: v.version,
        priority: v.priority,
        source: (v.metadata as any)?.source || "manual", // Extract source from metadata
        threats:
          parseInt(v.threatCount?.toString() || "0") > 0
            ? {
                count: parseInt(v.threatCount?.toString() || "0"),
                highestLevel: v.highestLevel || "low",
              }
            : null,
      })),
      clients: clientResults.map((c) => ({
        id: c.id,
        name: c.name,
        version: c.version,
        priority: c.priority,
        threats:
          parseInt(c.threatCount?.toString() || "0") > 0
            ? {
                count: parseInt(c.threatCount?.toString() || "0"),
                highestLevel: c.highestLevel || "low",
              }
            : null,
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
});

// POST /api/tech-stack/add - Add item to tech stack using AI extraction
router.post("/add", async (req: any, res) => {
  try {
    const { type, name, version, priority } = req.body;
    const userId = req.user?.id;

    console.log("Tech stack ADD request:", {
      type,
      name,
      version,
      priority,
      userId,
    });

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!type || !name) {
      return res.status(400).json({ error: "Type and name are required" });
    }

    const entityManager = new EntityManager();
    let entityId: string;
    let processedName = name;
    let extractedVersion = version;

    try {
      // Use AI to extract entities from user input - treat it like a mini-article
      // This provides context hints to help the AI understand what type of entity we expect
      const contextHint =
        type === "software"
          ? `Software product: ${name}${version ? ` version ${version}` : ""}`
          : type === "hardware"
            ? `Hardware device: ${name}`
            : type === "vendor"
              ? `Vendor company: ${name}`
              : type === "client"
                ? `Client organization: ${name}`
                : name;

      console.log("Using AI extraction with context:", contextHint);

      const extracted = await extractArticleEntities({
        title: `Technology Stack Entry: ${contextHint}`,
        content: `User is adding the following to their technology stack: ${contextHint}. This is a ${type} entity that should be processed and normalized appropriately.`,
        url: "tech-stack-addition",
      });

      console.log("AI extraction results:", JSON.stringify(extracted, null, 2));

      // Process based on type and AI extraction results
      switch (type) {
        case "software":
          // Use AI-extracted software entity if found, otherwise fall back to direct processing
          if (extracted.software && extracted.software.length > 0) {
            const aiSoftware = extracted.software[0]; // Take the first/best match
            processedName = aiSoftware.name;
            extractedVersion =
              aiSoftware.version || aiSoftware.versionFrom || extractedVersion;

            // Create vendor company if AI identified one
            let companyId: string | null = null;
            if (aiSoftware.vendor) {
              console.log("AI identified vendor:", aiSoftware.vendor);
              companyId = await entityManager.findOrCreateCompany({
                name: aiSoftware.vendor,
                type: "vendor",
                createdBy: userId,
              });
            }

            // Create or find software
            entityId = await entityManager.findOrCreateSoftware({
              name: processedName,
              companyId,
              category: aiSoftware.category,
              createdBy: userId,
            });
          } else {
            // Fallback: Create software without AI enhancement
            console.log(
              "No AI extraction results for software, using direct input",
            );
            entityId = await entityManager.findOrCreateSoftware({
              name: processedName,
              createdBy: userId,
            });
          }

          // Add to user's software
          await db.transaction(async (tx) => {
            await tx
              .insert(usersSoftware)
              .values({
                userId,
                softwareId: entityId,
                version: extractedVersion || null,
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersSoftware.userId, usersSoftware.softwareId],
                set: {
                  version: extractedVersion || null,
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });

            // Auto-add vendor if we have a company from AI extraction
            if (extracted.software && extracted.software[0]?.vendor) {
              const companyId = await entityManager.findOrCreateCompany({
                name: extracted.software[0].vendor,
                type: "vendor",
                createdBy: userId,
              });

              // Add vendor relationship (reactivate if already exists but disabled)
              await tx
                .insert(usersCompanies)
                .values({
                  userId,
                  companyId,
                  relationshipType: "vendor",
                  metadata: { source: "auto-software" },
                  priority: 50, // Default priority for auto-added
                  isActive: true,
                  addedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [usersCompanies.userId, usersCompanies.companyId],
                  set: {
                    isActive: true, // Reactivate if previously disabled
                    metadata: { source: "auto-software" }, // Update source to show it's auto-added
                    addedAt: new Date(),
                  },
                });

              console.log(
                `Auto-added vendor ${extracted.software[0].vendor} for software ${processedName}`,
              );
            }
          });
          break;

        case "hardware":
          // Use AI-extracted hardware entity if found
          if (extracted.hardware && extracted.hardware.length > 0) {
            const aiHardware = extracted.hardware[0];
            processedName = aiHardware.name;

            entityId = await entityManager.findOrCreateHardware({
              name: processedName,
              model: aiHardware.model,
              manufacturer: aiHardware.manufacturer,
              category: aiHardware.category,
              createdBy: userId,
            });
          } else {
            // Fallback: Create hardware without AI enhancement
            console.log(
              "No AI extraction results for hardware, using direct input",
            );
            entityId = await entityManager.findOrCreateHardware({
              name: processedName,
              createdBy: userId,
            });
          }

          // Add to user's hardware
          await db.transaction(async (tx) => {
            await tx
              .insert(usersHardware)
              .values({
                userId,
                hardwareId: entityId,
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersHardware.userId, usersHardware.hardwareId],
                set: {
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });

            // Auto-add vendor if we have a manufacturer from AI extraction
            if (extracted.hardware && extracted.hardware[0]?.manufacturer) {
              const companyId = await entityManager.findOrCreateCompany({
                name: extracted.hardware[0].manufacturer,
                type: "vendor",
                createdBy: userId,
              });

              // Add vendor relationship (reactivate if already exists but disabled)
              await tx
                .insert(usersCompanies)
                .values({
                  userId,
                  companyId,
                  relationshipType: "vendor",
                  metadata: { source: "auto-hardware" },
                  priority: 50, // Default priority for auto-added
                  isActive: true,
                  addedAt: new Date(),
                })
                .onConflictDoUpdate({
                  target: [usersCompanies.userId, usersCompanies.companyId],
                  set: {
                    isActive: true, // Reactivate if previously disabled
                    metadata: { source: "auto-hardware" }, // Update source to show it's auto-added
                    addedAt: new Date(),
                  },
                });

              console.log(
                `Auto-added vendor ${extracted.hardware[0].manufacturer} for hardware ${processedName}`,
              );
            }
          });
          break;

        case "vendor":
        case "client":
          // Use AI-extracted company entity if found
          if (extracted.companies && extracted.companies.length > 0) {
            const aiCompany = extracted.companies[0];
            processedName = aiCompany.name;
          }

          // Always use EntityManager for companies (it has AI resolution built-in)
          entityId = await entityManager.findOrCreateCompany({
            name: processedName,
            type: type === "vendor" ? "vendor" : "client",
            createdBy: userId,
          });

          // Add to user's companies
          await db.transaction(async (tx) => {
            await tx
              .insert(usersCompanies)
              .values({
                userId,
                companyId: entityId,
                relationshipType: type === "vendor" ? "vendor" : "client",
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersCompanies.userId, usersCompanies.companyId],
                set: {
                  relationshipType: type === "vendor" ? "vendor" : "client",
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });
          });
          break;

        default:
          throw new Error("Invalid type");
      }
    } catch (aiError: any) {
      // If AI extraction fails, fall back to direct processing
      console.error(
        "AI extraction failed, falling back to direct processing:",
        aiError,
      );

      // Simple fallback logic without AI
      switch (type) {
        case "software":
          entityId = await entityManager.findOrCreateSoftware({
            name: processedName,
            createdBy: userId,
          });

          await db.transaction(async (tx) => {
            await tx
              .insert(usersSoftware)
              .values({
                userId,
                softwareId: entityId,
                version: extractedVersion || null,
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersSoftware.userId, usersSoftware.softwareId],
                set: {
                  version: extractedVersion || null,
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });
          });
          break;

        case "hardware":
          entityId = await entityManager.findOrCreateHardware({
            name: processedName,
            createdBy: userId,
          });

          await db.transaction(async (tx) => {
            await tx
              .insert(usersHardware)
              .values({
                userId,
                hardwareId: entityId,
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersHardware.userId, usersHardware.hardwareId],
                set: {
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });
          });
          break;

        case "vendor":
        case "client":
          entityId = await entityManager.findOrCreateCompany({
            name: processedName,
            type: type === "vendor" ? "vendor" : "client",
            createdBy: userId,
          });

          await db.transaction(async (tx) => {
            await tx
              .insert(usersCompanies)
              .values({
                userId,
                companyId: entityId,
                relationshipType: type === "vendor" ? "vendor" : "client",
                priority: priority || null,
                isActive: true,
                addedAt: new Date(),
              })
              .onConflictDoUpdate({
                target: [usersCompanies.userId, usersCompanies.companyId],
                set: {
                  relationshipType: type === "vendor" ? "vendor" : "client",
                  priority: priority || null,
                  isActive: true,
                  addedAt: new Date(),
                },
              });
          });
          break;

        default:
          throw new Error("Invalid type");
      }
    }

    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch((error) => {
      log(`Error triggering relevance recalculation: ${error}`, "error");
    });

    res.json({
      success: true,
      entityId: entityId!,
      processedName,
      extractedVersion,
      message: `Added ${processedName} to ${type} stack`,
    });
  } catch (error: any) {
    console.error("Tech stack ADD endpoint error:", error);
    console.error("Error stack:", error.stack);
    log(`Error adding tech stack item: ${error.message || error}`, "error");

    // Provide more specific error messages based on error type
    let userMessage = "Failed to add item to tech stack";
    let statusCode = 500;

    if (error.code === "23505") {
      // Duplicate key violation
      userMessage = `This item is already in your tech stack`;
      statusCode = 409;
    } else if (error.message?.includes("Invalid type")) {
      userMessage =
        "Invalid entity type. Must be 'software', 'hardware', 'vendor', or 'client'";
      statusCode = 400;
    } else if (error.message?.includes("OpenAI")) {
      userMessage =
        "AI processing temporarily unavailable. Your item has been added without AI enhancement.";
      statusCode = 200; // Still success, just without AI
    }

    res.status(statusCode).json({
      error: userMessage,
      details:
        process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// DELETE /api/tech-stack/:itemId - Hard delete - completely removes item from tech stack
router.delete("/:itemId", async (req: any, res) => {
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
});

// PUT /api/tech-stack/:itemId/toggle - Enable/disable item in tech stack (soft delete)
router.put("/:itemId/toggle", async (req: any, res) => {
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
});

// POST /api/tech-stack/trigger-relevance - Trigger relevance score calculation
router.post("/trigger-relevance", async (req: any, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    log(`Triggering relevance score calculation for user ${userId}`, "info");

    // Trigger relevance score calculation in background
    relevanceScorer.batchCalculateRelevance(userId).catch((error) => {
      log(`Error during relevance calculation: ${error}`, "error");
    });

    res.json({
      success: true,
      message: "Relevance score calculation triggered",
    });
  } catch (error) {
    log(`Error triggering relevance calculation: ${error}`, "error");
    res.status(500).json({ error: "Failed to trigger relevance calculation" });
  }
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
    ];
    if (
      allowedTypes.includes(file.mimetype) ||
      file.originalname.endsWith(".xlsx") ||
      file.originalname.endsWith(".xls") ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only Excel and CSV files are allowed."));
    }
  },
});

// Custom middleware to handle CSRF for multipart uploads
// This runs AFTER multer has parsed the fields
const validateCSRFFromMultipart = async (req: any, res: any, next: any) => {
  // Check if CSRF token is in header first (best case)
  if (req.headers["x-csrf-token"]) {
    // Token already in header, let the main CSRF middleware handle it
    return doubleCsrfProtection(req, res, next);
  }

  // For multipart, check the parsed body field
  const csrfToken = req.body?._csrf;
  if (csrfToken) {
    // Move token to header for validation
    req.headers["x-csrf-token"] = csrfToken;
    return doubleCsrfProtection(req, res, next);
  }

  // No token found
  return res.status(403).json({ error: "CSRF token missing" });
};

// POST /api/tech-stack/upload - Process spreadsheet file and extract entities
// Using single file upload with CSRF in field
// Multer processes multipart first, then validateCSRFFromMultipart handles CSRF
router.post(
  "/upload",
  upload.single("file"),
  validateCSRFFromMultipart,
  async (req: any, res) => {
    const userId = req.user?.id;
    let fileHash = "";
    let filename = "";

    console.log("[UPLOAD] Request received, userId:", userId);
    console.log("[UPLOAD] File:", req.file);

    try {
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      // Check rate limiting (5 uploads per minute)
      if (!UploadSecurity.checkRateLimit(userId, 5, 1)) {
        return res.status(429).json({
          error:
            "Too many upload attempts. Please wait a minute before trying again.",
        });
      }

      if (!req.file) {
        UploadSecurity.auditLog(
          userId,
          "unknown",
          "",
          false,
          "No file uploaded",
        );
        return res.status(400).json({ error: "No file uploaded" });
      }

      const uploadedFile = req.file;
      filename = uploadedFile.originalname;
      fileHash = UploadSecurity.generateFileHash(uploadedFile.buffer);

      // Verify file type using magic bytes
      if (!UploadSecurity.verifyFileType(uploadedFile.buffer, filename)) {
        UploadSecurity.auditLog(
          userId,
          filename,
          fileHash,
          false,
          "Invalid file signature",
        );
        return res.status(400).json({
          error: "Invalid file type. File signature verification failed.",
        });
      }

      // Parse the spreadsheet
      let data: any[][] = [];

      try {
        if (uploadedFile.originalname.endsWith(".csv")) {
          // Parse CSV
          const csvText = uploadedFile.buffer.toString("utf-8");
          const workbook = XLSX.read(csvText, { type: "string" });
          const sheetName = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
          });
        } else {
          // Parse Excel
          const workbook = XLSX.read(uploadedFile.buffer, { type: "buffer" });
          const sheetName = workbook.SheetNames[0];
          data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {
            header: 1,
          });
        }
      } catch (parseError) {
        UploadSecurity.auditLog(
          userId,
          filename,
          fileHash,
          false,
          `Parse error: ${parseError}`,
        );
        return res.status(400).json({
          error: "Failed to parse spreadsheet. File may be corrupted.",
        });
      }

      if (data.length === 0) {
        UploadSecurity.auditLog(
          userId,
          filename,
          fileHash,
          false,
          "Empty spreadsheet",
        );
        return res.status(400).json({ error: "Spreadsheet is empty" });
      }

      // Scan for suspicious content
      const scanResult = UploadSecurity.scanForSuspiciousContent(data);
      if (!scanResult.safe) {
        log(
          `Suspicious content detected in upload from user ${userId}: ${scanResult.warnings.join("; ")}`,
          "warn",
        );
        UploadSecurity.auditLog(
          userId,
          filename,
          fileHash,
          false,
          `Suspicious content: ${scanResult.warnings.join("; ")}`,
        );
        return res.status(400).json({
          error: "File contains suspicious content and cannot be processed.",
          warnings: scanResult.warnings,
        });
      }

      // Sanitize data to prevent formula injection
      data = UploadSecurity.sanitizeSpreadsheetData(data);

      // Convert spreadsheet data to text for AI processing
      const headers = data[0] || [];
      const rows = data.slice(1);

      // Debug: Log what we parsed
      console.log("[UPLOAD] Parsed data - Total rows:", data.length);
      console.log("[UPLOAD] Headers:", headers);
      console.log("[UPLOAD] First data row:", rows[0]);
      console.log("[UPLOAD] Data rows count:", rows.length);

      // Process in batches of 50 rows to handle large files
      const BATCH_SIZE = 50;
      let allEntities = [];
      
      console.log(`[UPLOAD] Processing ${rows.length} rows in batches of ${BATCH_SIZE}`);
      
      for (let batchStart = 0; batchStart < rows.length; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE, rows.length);
        const batchRows = rows.slice(batchStart, batchEnd);
        
        console.log(`[UPLOAD] Processing batch: rows ${batchStart + 1} to ${batchEnd}`);
        
        // Create a structured text representation for this batch
        let spreadsheetText = `Headers: ${headers.join(", ")}\n\n`;
        spreadsheetText += "Data rows:\n";

        batchRows.forEach((row, index) => {
          if (row.some((cell) => cell)) {
            // Skip empty rows
            const rowData = headers
              .map((header, i) => `${header}: ${row[i] || "N/A"}`)
              .join(", ");
            spreadsheetText += `Row ${batchStart + index + 1}: ${rowData}\n`;
          }
        });

        // Use OpenAI to intelligently extract entities from the spreadsheet batch
        const extractionPrompt = `Extract technology entities from this spreadsheet data. The spreadsheet may contain various formats and column names.

Identify and extract:
1. Software products (applications, platforms, tools, etc.)
2. Hardware devices (servers, routers, computers, etc.)
3. Vendor companies (technology vendors, suppliers)
4. Client companies (customers, partners)

For each entity, determine:
- Type: software, hardware, vendor, or client
- Name: The specific product/company name
- Version: Software version if available
- Manufacturer/Company: For hardware or software
- Model: For hardware devices

Be smart about interpreting the data - column names may vary (e.g., "Product", "Tool", "Application", "Device", "Vendor", "Supplier", "Customer", "Client", etc.)

IMPORTANT: Only extract specific products and companies, not very generic items like single word "laptop", "firewall", "database", etc. The name should be specific enough to identify a unique product or company but be inclusive, we want to try to utilize every line the user inputs and not exclude things unless we have to.

Spreadsheet Data:
${spreadsheetText}

Return a JSON array of extracted entities with this structure:
[
  {
    "type": "software|hardware|vendor|client",
    "name": "Entity Name",
    "version": "version if applicable",
    "manufacturer": "manufacturer/company if applicable",
    "model": "model if applicable"
  }
]`;

        const completion = await openai.chat.completions.create({
          messages: [
            {
              role: "system",
              content:
                "You are an expert at extracting technology entities from spreadsheets. Return only valid JSON.",
            },
            {
              role: "user",
              content: extractionPrompt,
            },
          ],
          model: "gpt-3.5-turbo-16k", // Using 16K context model for better handling of large batches
          response_format: { type: "json_object" },
          max_tokens: 4000,
        });

        const extractedData = completion.choices[0].message.content || "{}";
        let batchEntities = [];

        try {
          const parsed = JSON.parse(extractedData);
          // Handle both array and object with entities property
          if (Array.isArray(parsed)) {
            batchEntities = parsed;
          } else if (parsed.entities && Array.isArray(parsed.entities)) {
            batchEntities = parsed.entities;
          } else {
            batchEntities = [];
          }
          
          console.log(`[UPLOAD] Batch extracted ${batchEntities.length} entities`);
          allEntities = allEntities.concat(batchEntities);
        } catch (e) {
          log(`Failed to parse extracted entities for batch ${batchStart}-${batchEnd}: ${e}`, "error");
          // Continue with other batches even if one fails
        }
      }
      
      console.log(`[UPLOAD] Total entities extracted: ${allEntities.length}`);
      let entities = allEntities;

      // Process entities through EntityManager to match with existing database
      const entityManager = new EntityManager();
      const processedEntities = [];

      for (const entity of entities) {
        let matchedEntity = null;
        let isNew = true;

        if (entity.type === "software") {
          // First, find or create the vendor company if provided
          let vendorId = null;
          if (entity.manufacturer) {
            console.log(
              `[UPLOAD] Finding/creating vendor: ${entity.manufacturer} for software: ${entity.name}`,
            );
            vendorId = await entityManager.findOrCreateCompany({
              name: entity.manufacturer,
              type: "vendor",
            });
          }

          // Try to find existing software with the vendor
          const existingSoftwareId = await entityManager.findOrCreateSoftware({
            name: entity.name,
            companyId: vendorId, // Use the vendor ID instead of null
            category: null,
          });

          if (existingSoftwareId) {
            matchedEntity = { id: existingSoftwareId };
            isNew = false;
          }
        } else if (entity.type === "hardware") {
          // Try to find existing hardware
          const existingHardwareId = await entityManager.findOrCreateHardware({
            name: entity.name,
            manufacturer: entity.manufacturer || null,
            model: entity.model || null,
            category: null,
          });

          if (existingHardwareId) {
            matchedEntity = { id: existingHardwareId };
            isNew = false;
          }
        } else if (entity.type === "vendor" || entity.type === "client") {
          // Try to find existing company
          const existingCompanyId = await entityManager.findOrCreateCompany({
            name: entity.name,
            type: entity.type === "vendor" ? "vendor" : "client",
          });

          if (existingCompanyId) {
            matchedEntity = { id: existingCompanyId };
            isNew = false;
          }
        }

        processedEntities.push({
          type: entity.type,
          name: entity.name,
          version: entity.version,
          manufacturer: entity.manufacturer,
          model: entity.model,
          isNew: isNew,
          matchedId: matchedEntity?.id || null,
        });
      }

      // Log successful upload
      UploadSecurity.auditLog(
        userId,
        filename,
        fileHash,
        true,
        `Extracted ${processedEntities.length} entities`,
      );

      res.json({
        success: true,
        entities: processedEntities,
      });
    } catch (error: any) {
      log(
        `Error processing spreadsheet upload: ${error.message || error}`,
        "error",
      );
      if (fileHash) {
        UploadSecurity.auditLog(
          userId || "unknown",
          filename,
          fileHash,
          false,
          `Processing error: ${error.message}`,
        );
      }
      res.status(500).json({ error: "Failed to process spreadsheet" });
    }
  },
);

// POST /api/tech-stack/import - Import selected entities to user's tech stack
router.post("/import", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { entities } = req.body;

    if (!entities || !Array.isArray(entities)) {
      return res.status(400).json({ error: "Invalid entities data" });
    }

    const entityManager = new EntityManager();
    let imported = 0;

    for (const entity of entities) {
      try {
        if (entity.type === "software") {
          // Add to user's software stack
          let softwareId = entity.matchedId;

          if (!softwareId || entity.isNew) {
            // Create new software entity
            softwareId = await entityManager.findOrCreateSoftware({
              name: entity.name,
              companyId: null,
              category: null,
            });
          }

          if (softwareId) {
            // Check if already in user's stack
            const existing = await db
              .select()
              .from(usersSoftware)
              .where(
                and(
                  eq(usersSoftware.userId, userId),
                  eq(usersSoftware.softwareId, softwareId),
                ),
              )
              .limit(1);

            if (existing.length === 0) {
              await db.insert(usersSoftware).values({
                userId,
                softwareId,
                version: entity.version || null,
                priority: 5,
                isActive: true,
              });
              imported++;
            }
          }
        } else if (entity.type === "hardware") {
          // Add to user's hardware stack
          let hardwareId = entity.matchedId;

          if (!hardwareId || entity.isNew) {
            // Create new hardware entity
            hardwareId = await entityManager.findOrCreateHardware({
              name: entity.name,
              manufacturer: entity.manufacturer || null,
              model: entity.model || null,
              category: null,
            });
          }

          if (hardwareId) {
            // Check if already in user's stack
            const existing = await db
              .select()
              .from(usersHardware)
              .where(
                and(
                  eq(usersHardware.userId, userId),
                  eq(usersHardware.hardwareId, hardwareId),
                ),
              )
              .limit(1);

            if (existing.length === 0) {
              await db.insert(usersHardware).values({
                userId,
                hardwareId,
                priority: 5,
                isActive: true,
              });
              imported++;
            }
          }
        } else if (entity.type === "vendor" || entity.type === "client") {
          // Add to user's companies stack
          let companyId = entity.matchedId;

          if (!companyId || entity.isNew) {
            // Create new company entity
            companyId = await entityManager.findOrCreateCompany({
              name: entity.name,
              type: entity.type === "vendor" ? "vendor" : "client",
            });
          }

          if (companyId) {
            // Check if already in user's stack
            const existing = await db
              .select()
              .from(usersCompanies)
              .where(
                and(
                  eq(usersCompanies.userId, userId),
                  eq(usersCompanies.companyId, companyId),
                ),
              )
              .limit(1);

            if (existing.length === 0) {
              await db.insert(usersCompanies).values({
                userId,
                companyId,
                relationshipType:
                  entity.type === "vendor" ? "vendor" : "client",
                priority: 5,
                isActive: true,
              });
              imported++;
            }
          }
        }
      } catch (err) {
        log(`Error importing entity ${entity.name}: ${err}`, "error");
      }
    }

    res.json({
      success: true,
      imported,
      message: `Successfully imported ${imported} items to your tech stack`,
    });
  } catch (error: any) {
    log(`Error importing entities: ${error.message || error}`, "error");
    res.status(500).json({ error: "Failed to import entities" });
  }
});

export default router;
