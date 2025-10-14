import { Router } from "express";
import { db } from "../../../db/db";
import { 
  usersSoftware, 
  usersHardware, 
  usersCompanies 
} from "../../../../shared/db/schema/threat-tracker/user-associations";
import { 
  software, 
  hardware, 
  companies 
} from "../../../../shared/db/schema/threat-tracker/entities";
import { globalArticles } from "../../../../shared/db/schema/global-tables";
import { 
  articleSoftware, 
  articleHardware, 
  articleCompanies 
} from "../../../../shared/db/schema/threat-tracker/entity-associations";
import { eq, and, sql } from "drizzle-orm";
import { log } from "../../../utils/log";
import { relevanceScorer } from "../services/relevance-scorer";
import { EntityManager } from "../../../services/entity-manager";
import { extractArticleEntities } from "../../../services/openai";

const router = Router();

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
        `
      })
      .from(usersSoftware)
      .innerJoin(software, eq(usersSoftware.softwareId, software.id))
      .leftJoin(companies, eq(software.companyId, companies.id))
      .leftJoin(articleSoftware, eq(articleSoftware.softwareId, software.id))
      .leftJoin(globalArticles, and(
        eq(globalArticles.id, articleSoftware.articleId),
        eq(globalArticles.isCybersecurity, true)
      ))
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.isActive, true)
      ))
      .groupBy(software.id, software.name, usersSoftware.version, usersSoftware.priority, companies.name);
    
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
        `
      })
      .from(usersHardware)
      .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
      .leftJoin(articleHardware, eq(articleHardware.hardwareId, hardware.id))
      .leftJoin(globalArticles, and(
        eq(globalArticles.id, articleHardware.articleId),
        eq(globalArticles.isCybersecurity, true)
      ))
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.isActive, true)
      ))
      .groupBy(hardware.id, hardware.name, hardware.manufacturer, hardware.model, usersHardware.priority);
    
    // Fetch vendors with threat counts
    const vendorResults = await db
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
        `
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(globalArticles, and(
        eq(globalArticles.id, articleCompanies.articleId),
        eq(globalArticles.isCybersecurity, true)
      ))
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.relationshipType, 'vendor'),
        eq(usersCompanies.isActive, true)
      ))
      .groupBy(companies.id, companies.name, usersCompanies.priority);
    
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
        `
      })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .leftJoin(articleCompanies, eq(articleCompanies.companyId, companies.id))
      .leftJoin(globalArticles, and(
        eq(globalArticles.id, articleCompanies.articleId),
        eq(globalArticles.isCybersecurity, true)
      ))
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.relationshipType, 'client'),
        eq(usersCompanies.isActive, true)
      ))
      .groupBy(companies.id, companies.name, usersCompanies.priority);
    
    // Format response
    const response = {
      software: softwareResults.map(s => ({
        id: s.id,
        name: s.name,
        company: s.company,
        version: s.version,
        priority: s.priority,
        threats: parseInt(s.threatCount?.toString() || '0') > 0 ? {
          count: parseInt(s.threatCount?.toString() || '0'),
          highestLevel: s.highestLevel || 'low'
        } : null
      })),
      hardware: hardwareResults.map(h => ({
        id: h.id,
        name: h.name,
        manufacturer: h.manufacturer,
        model: h.model,
        version: h.version,
        priority: h.priority,
        threats: parseInt(h.threatCount?.toString() || '0') > 0 ? {
          count: parseInt(h.threatCount?.toString() || '0'),
          highestLevel: h.highestLevel || 'low'
        } : null
      })),
      vendors: vendorResults.map(v => ({
        id: v.id,
        name: v.name,
        version: v.version,
        priority: v.priority,
        threats: parseInt(v.threatCount?.toString() || '0') > 0 ? {
          count: parseInt(v.threatCount?.toString() || '0'),
          highestLevel: v.highestLevel || 'low'
        } : null
      })),
      clients: clientResults.map(c => ({
        id: c.id,
        name: c.name,
        version: c.version,
        priority: c.priority,
        threats: parseInt(c.threatCount?.toString() || '0') > 0 ? {
          count: parseInt(c.threatCount?.toString() || '0'),
          highestLevel: c.highestLevel || 'low'
        } : null
      }))
    };
    
    res.json(response);
    
  } catch (error: any) {
    console.error('Tech stack GET endpoint error details:', error);
    console.error('Error stack:', error.stack);
    log(`Error fetching tech stack: ${error.message || error}`, 'error');
    res.status(500).json({ 
      error: "Failed to fetch tech stack",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/tech-stack/add - Add item to tech stack using AI extraction
router.post("/add", async (req: any, res) => {
  try {
    const { type, name, version, priority } = req.body;
    const userId = req.user?.id;
    
    console.log('Tech stack ADD request:', { type, name, version, priority, userId });
    
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
      const contextHint = type === 'software' ? `Software product: ${name}${version ? ` version ${version}` : ''}` :
                          type === 'hardware' ? `Hardware device: ${name}` :
                          type === 'vendor' ? `Vendor company: ${name}` :
                          type === 'client' ? `Client organization: ${name}` : name;
      
      console.log('Using AI extraction with context:', contextHint);
      
      const extracted = await extractArticleEntities({
        title: `Technology Stack Entry: ${contextHint}`,
        content: `User is adding the following to their technology stack: ${contextHint}. This is a ${type} entity that should be processed and normalized appropriately.`,
        url: 'tech-stack-addition'
      });
      
      console.log('AI extraction results:', JSON.stringify(extracted, null, 2));
      
      // Process based on type and AI extraction results
      switch (type) {
        case 'software':
          // Use AI-extracted software entity if found, otherwise fall back to direct processing
          if (extracted.software && extracted.software.length > 0) {
            const aiSoftware = extracted.software[0]; // Take the first/best match
            processedName = aiSoftware.name;
            extractedVersion = aiSoftware.version || aiSoftware.versionFrom || extractedVersion;
            
            // Create vendor company if AI identified one
            let companyId: string | null = null;
            if (aiSoftware.vendor) {
              console.log('AI identified vendor:', aiSoftware.vendor);
              companyId = await entityManager.findOrCreateCompany({
                name: aiSoftware.vendor,
                type: 'vendor',
                createdBy: userId
              });
            }
            
            // Create or find software
            entityId = await entityManager.findOrCreateSoftware({
              name: processedName,
              companyId,
              category: aiSoftware.category,
              createdBy: userId
            });
          } else {
            // Fallback: Create software without AI enhancement
            console.log('No AI extraction results for software, using direct input');
            entityId = await entityManager.findOrCreateSoftware({
              name: processedName,
              createdBy: userId
            });
          }
          
          // Add to user's software
          await db.transaction(async (tx) => {
            await tx.insert(usersSoftware).values({
              userId,
              softwareId: entityId,
              version: extractedVersion || null,
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersSoftware.userId, usersSoftware.softwareId],
              set: {
                version: extractedVersion || null,
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        case 'hardware':
          // Use AI-extracted hardware entity if found
          if (extracted.hardware && extracted.hardware.length > 0) {
            const aiHardware = extracted.hardware[0];
            processedName = aiHardware.name;
            
            entityId = await entityManager.findOrCreateHardware({
              name: processedName,
              model: aiHardware.model,
              manufacturer: aiHardware.manufacturer,
              category: aiHardware.category,
              createdBy: userId
            });
          } else {
            // Fallback: Create hardware without AI enhancement
            console.log('No AI extraction results for hardware, using direct input');
            entityId = await entityManager.findOrCreateHardware({
              name: processedName,
              createdBy: userId
            });
          }
          
          // Add to user's hardware
          await db.transaction(async (tx) => {
            await tx.insert(usersHardware).values({
              userId,
              hardwareId: entityId,
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersHardware.userId, usersHardware.hardwareId],
              set: {
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        case 'vendor':
        case 'client':
          // Use AI-extracted company entity if found
          if (extracted.companies && extracted.companies.length > 0) {
            const aiCompany = extracted.companies[0];
            processedName = aiCompany.name;
          }
          
          // Always use EntityManager for companies (it has AI resolution built-in)
          entityId = await entityManager.findOrCreateCompany({
            name: processedName,
            type: type === 'vendor' ? 'vendor' : 'client',
            createdBy: userId
          });
          
          // Add to user's companies
          await db.transaction(async (tx) => {
            await tx.insert(usersCompanies).values({
              userId,
              companyId: entityId,
              relationshipType: type === 'vendor' ? 'vendor' : 'client',
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersCompanies.userId, usersCompanies.companyId],
              set: {
                relationshipType: type === 'vendor' ? 'vendor' : 'client',
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        default:
          throw new Error("Invalid type");
      }
      
    } catch (aiError: any) {
      // If AI extraction fails, fall back to direct processing
      console.error('AI extraction failed, falling back to direct processing:', aiError);
      
      // Simple fallback logic without AI
      switch (type) {
        case 'software':
          entityId = await entityManager.findOrCreateSoftware({
            name: processedName,
            createdBy: userId
          });
          
          await db.transaction(async (tx) => {
            await tx.insert(usersSoftware).values({
              userId,
              softwareId: entityId,
              version: extractedVersion || null,
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersSoftware.userId, usersSoftware.softwareId],
              set: {
                version: extractedVersion || null,
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        case 'hardware':
          entityId = await entityManager.findOrCreateHardware({
            name: processedName,
            createdBy: userId
          });
          
          await db.transaction(async (tx) => {
            await tx.insert(usersHardware).values({
              userId,
              hardwareId: entityId,
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersHardware.userId, usersHardware.hardwareId],
              set: {
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        case 'vendor':
        case 'client':
          entityId = await entityManager.findOrCreateCompany({
            name: processedName,
            type: type === 'vendor' ? 'vendor' : 'client',
            createdBy: userId
          });
          
          await db.transaction(async (tx) => {
            await tx.insert(usersCompanies).values({
              userId,
              companyId: entityId,
              relationshipType: type === 'vendor' ? 'vendor' : 'client',
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }).onConflictDoUpdate({
              target: [usersCompanies.userId, usersCompanies.companyId],
              set: {
                relationshipType: type === 'vendor' ? 'vendor' : 'client',
                priority: priority || null,
                isActive: true,
                addedAt: new Date()
              }
            });
          });
          break;
          
        default:
          throw new Error("Invalid type");
      }
    }
    
    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch(error => {
      log(`Error triggering relevance recalculation: ${error}`, 'error');
    });
    
    res.json({ 
      success: true, 
      entityId: entityId!,
      processedName,
      extractedVersion,
      message: `Added ${processedName} to ${type} stack` 
    });
    
  } catch (error: any) {
    console.error('Tech stack ADD endpoint error:', error);
    console.error('Error stack:', error.stack);
    log(`Error adding tech stack item: ${error.message || error}`, 'error');
    
    // Provide more specific error messages based on error type
    let userMessage = "Failed to add item to tech stack";
    let statusCode = 500;
    
    if (error.code === '23505') { // Duplicate key violation
      userMessage = `This item is already in your tech stack`;
      statusCode = 409;
    } else if (error.message?.includes('Invalid type')) {
      userMessage = "Invalid entity type. Must be 'software', 'hardware', 'vendor', or 'client'";
      statusCode = 400;
    } else if (error.message?.includes('OpenAI')) {
      userMessage = "AI processing temporarily unavailable. Your item has been added without AI enhancement.";
      statusCode = 200; // Still success, just without AI
    }
    
    res.status(statusCode).json({ 
      error: userMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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
      case 'software':
        await db.delete(usersSoftware)
          .where(and(
            eq(usersSoftware.userId, userId),
            eq(usersSoftware.softwareId, itemId)
          ));
        break;
        
      case 'hardware':
        await db.delete(usersHardware)
          .where(and(
            eq(usersHardware.userId, userId),
            eq(usersHardware.hardwareId, itemId)
          ));
        break;
        
      case 'vendor':
      case 'client':
        await db.delete(usersCompanies)
          .where(and(
            eq(usersCompanies.userId, userId),
            eq(usersCompanies.companyId, itemId)
          ));
        break;
        
      default:
        return res.status(400).json({ error: "Invalid type" });
    }
    
    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch(error => {
      log(`Error triggering relevance recalculation: ${error}`, 'error');
    });
    
    res.json({ 
      success: true,
      message: `Permanently removed item from ${type} stack` 
    });
    
  } catch (error: any) {
    console.error('Tech stack DELETE error:', error);
    log(`Error removing tech stack item: ${error.message || error}`, 'error');
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
      return res.status(400).json({ error: "Type, itemId, and isActive are required" });
    }
    
    // Toggle isActive status in appropriate junction table based on type
    switch (type) {
      case 'software':
        await db.update(usersSoftware)
          .set({ 
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined // Update addedAt when re-enabling
          })
          .where(and(
            eq(usersSoftware.userId, userId),
            eq(usersSoftware.softwareId, itemId)
          ));
        break;
        
      case 'hardware':
        await db.update(usersHardware)
          .set({ 
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined
          })
          .where(and(
            eq(usersHardware.userId, userId),
            eq(usersHardware.hardwareId, itemId)
          ));
        break;
        
      case 'vendor':
      case 'client':
        await db.update(usersCompanies)
          .set({ 
            isActive: isActive,
            addedAt: isActive ? new Date() : undefined
          })
          .where(and(
            eq(usersCompanies.userId, userId),
            eq(usersCompanies.companyId, itemId)
          ));
        break;
        
      default:
        return res.status(400).json({ error: "Invalid type" });
    }
    
    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch(error => {
      log(`Error triggering relevance recalculation: ${error}`, 'error');
    });
    
    res.json({ 
      success: true,
      message: `${isActive ? 'Enabled' : 'Disabled'} item in ${type} stack`,
      isActive: isActive
    });
    
  } catch (error: any) {
    console.error('Tech stack TOGGLE error:', error);
    log(`Error toggling tech stack item: ${error.message || error}`, 'error');
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
    
    log(`Triggering relevance score calculation for user ${userId}`, 'info');
    
    // Trigger relevance score calculation in background
    relevanceScorer.batchCalculateRelevance(userId).catch(error => {
      log(`Error during relevance calculation: ${error}`, 'error');
    });
    
    res.json({ 
      success: true,
      message: "Relevance score calculation triggered" 
    });
    
  } catch (error) {
    log(`Error triggering relevance calculation: ${error}`, 'error');
    res.status(500).json({ error: "Failed to trigger relevance calculation" });
  }
});

export default router;