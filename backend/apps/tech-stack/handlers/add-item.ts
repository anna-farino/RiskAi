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
import { EntityManager } from "../../../services/entity-manager";
import { extractArticleEntities } from "../../../services/openai";
import getNumOfUsersTechStackKeywords from "../../threat-tracker/router/get-num-keywords";
import { getUserTierLevel } from "../../../services/unified-storage/utils/get-user-tier-level";
import { getMaxNumKeywords } from "../../../services/unified-storage/utils/get-max-num-of-keywords";

// Helper functions to check if user already has associations (regardless of isActive status)
async function userHasSoftware(userId: string, softwareId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(usersSoftware)
    .where(and(eq(usersSoftware.userId, userId), eq(usersSoftware.softwareId, softwareId)))
    .limit(1);
  return existing.length > 0;
}

async function userHasHardware(userId: string, hardwareId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(usersHardware)
    .where(and(eq(usersHardware.userId, userId), eq(usersHardware.hardwareId, hardwareId)))
    .limit(1);
  return existing.length > 0;
}

async function userHasCompany(userId: string, companyId: string): Promise<boolean> {
  const existing = await db
    .select()
    .from(usersCompanies)
    .where(and(eq(usersCompanies.userId, userId), eq(usersCompanies.companyId, companyId)))
    .limit(1);
  return existing.length > 0;
}

// POST /api/tech-stack/add - Add item to tech stack using AI extraction
export async function addItem(req: any, res: Response) {
  try {
    const { type, name, version, priority } = req.body;
    const userId = req.user?.id;

    const numUserKeywords = await getNumOfUsersTechStackKeywords(userId)
    const userTierLevel = await getUserTierLevel(userId)
    const maxNumOfKeywords = getMaxNumKeywords(userTierLevel)

    // Note: We don't block here if at limit because reactivating existing entries is allowed
    // The detailed checks later will distinguish between adding NEW entries vs reactivating existing ones

    console.log("Number of tech stack keywords: ", numUserKeywords)

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
    let vendorSkipped = false;
    let skippedVendorName: string | null = null;

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

      // OPTIMIZATION: For software type, run AI extraction and relationship detection in parallel
      // This saves 1-3 seconds by avoiding sequential waits for independent AI operations
      const { detectCompanyProductRelationship } = await import('../../../services/openai');

      const [extracted, softwareRelationship] = await Promise.all([
        extractArticleEntities({
          title: `Technology Stack Entry: ${contextHint}`,
          content: `User is adding the following to their technology stack: ${contextHint}. This is a ${type} entity that should be processed and normalized appropriately.`,
          url: "tech-stack-addition",
        }),
        // Only run relationship detection for software type (used in fallback case)
        type === "software"
          ? detectCompanyProductRelationship(
              processedName,
              `User adding ${processedName} to their tech stack`
            )
          : Promise.resolve(null)
      ]);

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
            // Fallback: Use the pre-fetched relationship detection result
            console.log(
              "No AI extraction results for software, checking for product relationships",
            );

            // Use the relationship already fetched in parallel above
            const relationship = softwareRelationship;
            
            // Apply heuristic fallback for obvious company-product patterns
            let finalRelationship = relationship;
            if (!relationship.isProduct || !relationship.parentCompany) {
              // Check for common patterns like "Company Product" or "Company [A-Z]"
              const companyProductPattern = /^(Google|Microsoft|Amazon|AWS|IBM|Oracle|Adobe|Meta|Facebook|Apple|Cisco|Dell|HP|VMware|Salesforce|SAP|Twitter|X|Netflix|Uber|Spotify|Zoom|Slack|GitHub|GitLab|Atlassian|JetBrains|Cloudflare|Fastly|Akamai|DataDog|NewRelic|Splunk|Elastic|MongoDB|Redis|PostgreSQL|MySQL|MariaDB|Snowflake|Databricks|Palantir|OpenAI|Anthropic|Cohere|Hugging Face)\s+(.+)$/i;
              const match = processedName.match(companyProductPattern);
              
              if (match) {
                console.log(`[HEURISTIC] Detected company-product pattern: "${match[1]}" + "${match[2]}"`);
                finalRelationship = {
                  isProduct: true,
                  parentCompany: match[1],
                  productName: processedName, // Keep full name
                  confidence: 0.8,
                  reasoning: `Heuristic pattern match: Company name "${match[1]}" followed by product "${match[2]}"`
                };
              }
            }
            
            if (finalRelationship.isProduct && finalRelationship.parentCompany && finalRelationship.confidence >= 0.6) {
              console.log(`[MANUAL INPUT RECLASSIFICATION] "${processedName}" detected as product of ${finalRelationship.parentCompany} (confidence: ${finalRelationship.confidence})`);
              console.log(`[MANUAL INPUT RECLASSIFICATION] Reason: ${finalRelationship.reasoning}`);

              // Create parent company first
              const companyId = await entityManager.findOrCreateCompany({
                name: finalRelationship.parentCompany,
                type: "vendor",
                createdBy: userId,
              });

              // Create software with full product name linked to parent
              entityId = await entityManager.findOrCreateSoftware({
                name: finalRelationship.productName || processedName,
                companyId,
                category: 'service',
                createdBy: userId,
              });

              // Store vendor info for auto-add logic (mimic extracted.software structure)
              if (!extracted.software || extracted.software.length === 0) {
                extracted.software = [{
                  name: finalRelationship.productName || processedName,
                  vendor: finalRelationship.parentCompany,
                  category: 'service',
                }];
              }
            } else {
              // Regular software without vendor
              entityId = await entityManager.findOrCreateSoftware({
                name: processedName,
                createdBy: userId,
              });
            }
          }

          // Check if user already has this software association
          const softwareExists = await userHasSoftware(userId, entityId);

          // Prepare vendor company ID if vendor should be auto-added
          let vendorCompanyId: string | null = null;
          let vendorExists = false;
          if (extracted.software && extracted.software[0]?.vendor) {
            vendorCompanyId = await entityManager.findOrCreateCompany({
              name: extracted.software[0].vendor,
              type: "vendor",
              createdBy: userId,
            });
            vendorExists = await userHasCompany(userId, vendorCompanyId);
          }

          // Calculate how many NEW associations we're adding
          const newAssociationsCount =
            (softwareExists ? 0 : 1) + // Software association
            (vendorCompanyId && !vendorExists ? 1 : 0); // Vendor association (if applicable)

          // Check if adding new associations would exceed limit
          const currentCount = await getNumOfUsersTechStackKeywords(userId);
          if (currentCount + newAssociationsCount > maxNumOfKeywords) {
            // Determine what to skip
            if (!softwareExists && vendorCompanyId && !vendorExists) {
              // Both are new - skip the vendor, allow the software
              vendorSkipped = true;
              skippedVendorName = extracted.software[0].vendor;
              vendorCompanyId = null; // Don't add vendor
              console.log(
                `Skipping vendor auto-add for ${extracted.software[0].vendor}: would exceed keyword limit (${currentCount + 2}/${maxNumOfKeywords})`,
              );
            } else {
              // Software itself would exceed limit (shouldn't happen due to initial check, but be safe)
              const msg = `Cannot add software: would exceed keyword limit (${currentCount + 1}/${maxNumOfKeywords})`;
              console.error(msg);
              return res.status(400).json({ error: msg });
            }
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

            // Auto-add vendor if we have a companyId and limit allows
            if (vendorCompanyId && extracted.software && extracted.software[0]?.vendor) {
              // Add vendor relationship (reactivate if already exists but disabled)
              await tx
                .insert(usersCompanies)
                .values({
                  userId,
                  companyId: vendorCompanyId,
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

          // Check if user already has this hardware association
          const hardwareExists = await userHasHardware(userId, entityId);

          // Prepare vendor company ID if manufacturer should be auto-added
          let vendorCompanyIdHardware: string | null = null;
          let vendorExistsHardware = false;
          if (extracted.hardware && extracted.hardware[0]?.manufacturer) {
            vendorCompanyIdHardware = await entityManager.findOrCreateCompany({
              name: extracted.hardware[0].manufacturer,
              type: "vendor",
              createdBy: userId,
            });
            vendorExistsHardware = await userHasCompany(userId, vendorCompanyIdHardware);
          }

          // Calculate how many NEW associations we're adding
          const newAssociationsCountHardware =
            (hardwareExists ? 0 : 1) + // Hardware association
            (vendorCompanyIdHardware && !vendorExistsHardware ? 1 : 0); // Vendor association (if applicable)

          // Check if adding new associations would exceed limit
          const currentCountHardware = await getNumOfUsersTechStackKeywords(userId);
          if (currentCountHardware + newAssociationsCountHardware > maxNumOfKeywords) {
            // Determine what to skip
            if (!hardwareExists && vendorCompanyIdHardware && !vendorExistsHardware) {
              // Both are new - skip the vendor, allow the hardware
              vendorSkipped = true;
              skippedVendorName = extracted.hardware[0].manufacturer;
              vendorCompanyIdHardware = null; // Don't add vendor
              console.log(
                `Skipping vendor auto-add for ${extracted.hardware[0].manufacturer}: would exceed keyword limit (${currentCountHardware + 2}/${maxNumOfKeywords})`,
              );
            } else {
              // Hardware itself would exceed limit (shouldn't happen due to initial check, but be safe)
              const msg = `Cannot add hardware: would exceed keyword limit (${currentCountHardware + 1}/${maxNumOfKeywords})`;
              console.error(msg);
              return res.status(400).json({ error: msg });
            }
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

            // Auto-add vendor if we have a companyId and limit allows
            if (vendorCompanyIdHardware && extracted.hardware && extracted.hardware[0]?.manufacturer) {
              // Add vendor relationship (reactivate if already exists but disabled)
              await tx
                .insert(usersCompanies)
                .values({
                  userId,
                  companyId: vendorCompanyIdHardware,
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

          // Check if this is a new entry or reactivation
          const softwareExistsFallback = await userHasSoftware(userId, entityId);
          if (!softwareExistsFallback) {
            // This is a NEW entry - check limit
            const currentCountFallback = await getNumOfUsersTechStackKeywords(userId);
            if (currentCountFallback + 1 > maxNumOfKeywords) {
              const msg = `Cannot add software: would exceed keyword limit (${currentCountFallback + 1}/${maxNumOfKeywords})`;
              console.error(msg);
              return res.status(400).json({ error: msg });
            }
          }

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

          // Check if this is a new entry or reactivation
          const hardwareExistsFallback = await userHasHardware(userId, entityId);
          if (!hardwareExistsFallback) {
            // This is a NEW entry - check limit
            const currentCountFallbackHw = await getNumOfUsersTechStackKeywords(userId);
            if (currentCountFallbackHw + 1 > maxNumOfKeywords) {
              const msg = `Cannot add hardware: would exceed keyword limit (${currentCountFallbackHw + 1}/${maxNumOfKeywords})`;
              console.error(msg);
              return res.status(400).json({ error: msg });
            }
          }

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

          // Check if this is a new entry or reactivation
          const companyExistsFallback = await userHasCompany(userId, entityId);
          if (!companyExistsFallback) {
            // This is a NEW entry - check limit
            const currentCountFallbackCo = await getNumOfUsersTechStackKeywords(userId);
            if (currentCountFallbackCo + 1 > maxNumOfKeywords) {
              const msg = `Cannot add ${type}: would exceed keyword limit (${currentCountFallbackCo + 1}/${maxNumOfKeywords})`;
              console.error(msg);
              return res.status(400).json({ error: msg });
            }
          }

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
      vendorSkipped,
      vendorSkippedName: skippedVendorName,
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
}
