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
import { extractVersion, findSoftwareCompany } from "../../../utils/entity-processing";

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
      .groupBy(hardware.id, hardware.name, usersHardware.priority);
    
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

// POST /api/tech-stack/add - Add item to tech stack
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
    
    // Process entity creation outside transaction first (EntityManager handles its own transactions)
    switch (type) {
      case 'software':
        console.log('Processing software entity:', name);
        
        // Extract version from name if not provided separately
        let finalName = name;
        let finalVersion = version;
        
        if (!version) {
          const extracted = extractVersion(name);
          finalName = extracted.name;
          finalVersion = extracted.version;
          console.log('Extracted version:', { original: name, name: finalName, version: finalVersion });
        }
        
        // Find associated company
        let companyId: string | null = null;
        const companyName = findSoftwareCompany(finalName);
        
        if (companyName) {
          console.log('Found company association:', { software: finalName, company: companyName });
          companyId = await entityManager.findOrCreateCompany({
            name: companyName,
            type: 'vendor',
            createdBy: userId
          });
        }
        
        // Create or find software with company association
        entityId = await entityManager.findOrCreateSoftware({
          name: finalName,
          companyId: companyId,
          createdBy: userId
        });
        console.log('Software entity created/found with ID:', entityId);
        
        // Add to user's software with extracted version in a transaction
        await db.transaction(async (tx) => {
          await tx.insert(usersSoftware).values({
            userId,
            softwareId: entityId,
            version: finalVersion || null,
            priority: priority || null,
            isActive: true,
            addedAt: new Date()
          }).onConflictDoUpdate({
            target: [usersSoftware.userId, usersSoftware.softwareId],
            set: {
              version: finalVersion || null,
              priority: priority || null,
              isActive: true,
              addedAt: new Date()
            }
          });
        });
        break;
        
      case 'hardware':
        entityId = await entityManager.findOrCreateHardware({
          name: name,
          createdBy: userId
        });
        
        // Add to user's hardware in a transaction
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
        console.log(`Processing ${type}:`, name);
        
        // Use EntityManager's findOrCreateCompany which handles normalization and AI resolution
        entityId = await entityManager.findOrCreateCompany({
          name: name,
          type: type === 'vendor' ? 'vendor' : 'client',
          createdBy: userId
        });
        console.log(`Processed company: ${name} (ID: ${entityId})`);
        
        // Add to user's companies in a transaction
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
    
    // Trigger relevance score recalculation
    relevanceScorer.onTechStackChange(userId).catch(error => {
      log(`Error triggering relevance recalculation: ${error}`, 'error');
    });
    
    res.json({ 
      success: true, 
      entityId: entityId,
      message: `Added ${name} to ${type} stack` 
    });
    
  } catch (error: any) {
    console.error('Tech stack ADD endpoint error:', error);
    console.error('Error stack:', error.stack);
    log(`Error adding tech stack item: ${error.message || error}`, 'error');
    res.status(500).json({ 
      error: "Failed to add item to tech stack",
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