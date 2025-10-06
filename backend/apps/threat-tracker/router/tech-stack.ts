import { Router } from 'express';
import { db } from 'backend/db/db';
import { eq, and, sql, or, ilike } from 'drizzle-orm';
import {
  software,
  hardware,
  companies,
  threatActors
} from '@shared/db/schema/threat-tracker/entities';
import {
  usersSoftware,
  usersHardware,
  usersCompanies
} from '@shared/db/schema/threat-tracker/user-associations';
import { entityManager } from 'backend/services/entity-manager';
import { User } from "@shared/db/schema/user";
import { reqLog } from "backend/utils/req-log";
import { globalArticles } from '@shared/db/schema/global-tables';
import { 
  articleSoftware,
  articleHardware,
  articleCompanies
} from '@shared/db/schema/threat-tracker/entity-associations';

export const techStackRouter = Router();

// Helper function to extract user ID from request
function getUserId(req: any): string | undefined {
  return (req.user as User)?.id;
}

// ==========================================
// SOFTWARE ENDPOINTS
// ==========================================

// Get user's software
techStackRouter.get('/software', async (req, res) => {
  reqLog(req, 'GET /tech-stack/software');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userSoftware = await db.select({
      softwareId: software.id,
      name: software.name,
      vendor: companies.name,
      version: usersSoftware.version,
      priority: usersSoftware.priority,
      isActive: usersSoftware.isActive,
      category: software.category,
      description: software.description,
      addedAt: usersSoftware.addedAt,
    })
      .from(usersSoftware)
      .innerJoin(software, eq(usersSoftware.softwareId, software.id))
      .leftJoin(companies, eq(software.companyId, companies.id))
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.isActive, true)
      ));
    
    res.json(userSoftware);
  } catch (error) {
    console.error('Error fetching user software:', error);
    res.status(500).json({ error: 'Failed to fetch software' });
  }
});

// Add software to user's stack
techStackRouter.post('/software', async (req, res) => {
  reqLog(req, 'POST /tech-stack/software');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    name, 
    vendor,
    version,
    priority = 50,
    category,
    description 
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Software name is required' });
  }

  try {
    // Find or create vendor company if specified
    let vendorId = null;
    if (vendor) {
      vendorId = await entityManager.findOrCreateCompany({
        name: vendor,
        normalizedName: vendor.toLowerCase().replace(/[^a-z0-9]/g, ''),
        type: 'vendor',
        createdBy: userId
      });
    }

    // Find or create software
    const softwareId = await entityManager.findOrCreateSoftware({
      name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      companyId: vendorId,
      category,
      description,
      createdBy: userId
    });

    // Check if already linked to user
    const existing = await db.select()
      .from(usersSoftware)
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.softwareId, softwareId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing link
      await db.update(usersSoftware)
        .set({
          version,
          priority,
          isActive: true,
        })
        .where(and(
          eq(usersSoftware.userId, userId),
          eq(usersSoftware.softwareId, softwareId)
        ));
      
      res.json({ message: 'Software updated in tech stack', softwareId });
    } else {
      // Create new link
      await db.insert(usersSoftware)
        .values({
          userId,
          softwareId,
          version,
          priority,
          isActive: true
        });
      
      res.json({ message: 'Software added to tech stack', softwareId });
    }
  } catch (error) {
    console.error('Error adding software:', error);
    res.status(500).json({ error: 'Failed to add software' });
  }
});

// Update software in user's stack
techStackRouter.put('/software/:softwareId', async (req, res) => {
  reqLog(req, 'PUT /tech-stack/software/:softwareId');
  const userId = getUserId(req);
  const { softwareId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { version, priority, isActive } = req.body;

  try {
    await db.update(usersSoftware)
      .set({
        version,
        priority,
        isActive,
      })
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.softwareId, softwareId)
      ));
    
    res.json({ message: 'Software updated successfully' });
  } catch (error) {
    console.error('Error updating software:', error);
    res.status(500).json({ error: 'Failed to update software' });
  }
});

// Remove software from user's stack
techStackRouter.delete('/software/:softwareId', async (req, res) => {
  reqLog(req, 'DELETE /tech-stack/software/:softwareId');
  const userId = getUserId(req);
  const { softwareId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await db.delete(usersSoftware)
      .where(and(
        eq(usersSoftware.userId, userId),
        eq(usersSoftware.softwareId, softwareId)
      ));
    
    res.json({ message: 'Software removed from tech stack' });
  } catch (error) {
    console.error('Error removing software:', error);
    res.status(500).json({ error: 'Failed to remove software' });
  }
});

// ==========================================
// HARDWARE ENDPOINTS
// ==========================================

// Get user's hardware
techStackRouter.get('/hardware', async (req, res) => {
  reqLog(req, 'GET /tech-stack/hardware');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userHardware = await db.select({
      hardwareId: hardware.id,
      name: hardware.name,
      model: hardware.model,
      manufacturer: hardware.manufacturer,
      priority: usersHardware.priority,
      quantity: usersHardware.quantity,
      isActive: usersHardware.isActive,
      category: hardware.category,
      description: hardware.description,
      addedAt: usersHardware.addedAt,
    })
      .from(usersHardware)
      .innerJoin(hardware, eq(usersHardware.hardwareId, hardware.id))
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.isActive, true)
      ));
    
    res.json(userHardware);
  } catch (error) {
    console.error('Error fetching user hardware:', error);
    res.status(500).json({ error: 'Failed to fetch hardware' });
  }
});

// Add hardware to user's stack
techStackRouter.post('/hardware', async (req, res) => {
  reqLog(req, 'POST /tech-stack/hardware');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    name,
    model,
    manufacturer,
    quantity = 1,
    priority = 50,
    category,
    description 
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Hardware name is required' });
  }

  try {
    // Find or create hardware
    const hardwareId = await entityManager.findOrCreateHardware({
      name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      model,
      manufacturer,
      category,
      description,
      createdBy: userId
    });

    // Check if already linked to user
    const existing = await db.select()
      .from(usersHardware)
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.hardwareId, hardwareId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing link
      await db.update(usersHardware)
        .set({
          quantity,
          priority,
          isActive: true,
        })
        .where(and(
          eq(usersHardware.userId, userId),
          eq(usersHardware.hardwareId, hardwareId)
        ));
      
      res.json({ message: 'Hardware updated in tech stack', hardwareId });
    } else {
      // Create new link
      await db.insert(usersHardware)
        .values({
          userId,
          hardwareId,
          quantity,
          priority,
          isActive: true
        });
      
      res.json({ message: 'Hardware added to tech stack', hardwareId });
    }
  } catch (error) {
    console.error('Error adding hardware:', error);
    res.status(500).json({ error: 'Failed to add hardware' });
  }
});

// Update hardware in user's stack
techStackRouter.put('/hardware/:hardwareId', async (req, res) => {
  reqLog(req, 'PUT /tech-stack/hardware/:hardwareId');
  const userId = getUserId(req);
  const { hardwareId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { quantity, priority, isActive } = req.body;

  try {
    await db.update(usersHardware)
      .set({
        quantity,
        priority,
        isActive,
      })
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.hardwareId, hardwareId)
      ));
    
    res.json({ message: 'Hardware updated successfully' });
  } catch (error) {
    console.error('Error updating hardware:', error);
    res.status(500).json({ error: 'Failed to update hardware' });
  }
});

// Remove hardware from user's stack
techStackRouter.delete('/hardware/:hardwareId', async (req, res) => {
  reqLog(req, 'DELETE /tech-stack/hardware/:hardwareId');
  const userId = getUserId(req);
  const { hardwareId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await db.delete(usersHardware)
      .where(and(
        eq(usersHardware.userId, userId),
        eq(usersHardware.hardwareId, hardwareId)
      ));
    
    res.json({ message: 'Hardware removed from tech stack' });
  } catch (error) {
    console.error('Error removing hardware:', error);
    res.status(500).json({ error: 'Failed to remove hardware' });
  }
});

// ==========================================
// COMPANIES ENDPOINTS
// ==========================================

// Get user's companies
techStackRouter.get('/companies', async (req, res) => {
  reqLog(req, 'GET /tech-stack/companies');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const userCompanies = await db.select({
      companyId: companies.id,
      name: companies.name,
      type: companies.type,
      industry: companies.industry,
      relationshipType: usersCompanies.relationshipType,
      priority: usersCompanies.priority,
      isActive: usersCompanies.isActive,
      description: companies.description,
      website: companies.website,
      addedAt: usersCompanies.addedAt,
    })
      .from(usersCompanies)
      .innerJoin(companies, eq(usersCompanies.companyId, companies.id))
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.isActive, true)
      ));
    
    res.json(userCompanies);
  } catch (error) {
    console.error('Error fetching user companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
});

// Add company to user's stack
techStackRouter.post('/companies', async (req, res) => {
  reqLog(req, 'POST /tech-stack/companies');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { 
    name,
    type = 'vendor',
    relationshipType,
    industry,
    priority = 50,
    description,
    website 
  } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Company name is required' });
  }

  try {
    // Find or create company
    const companyId = await entityManager.findOrCreateCompany({
      name,
      normalizedName: name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      type,
      industry,
      description,
      website,
      createdBy: userId
    });

    // Check if already linked to user
    const existing = await db.select()
      .from(usersCompanies)
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.companyId, companyId)
      ))
      .limit(1);

    if (existing.length > 0) {
      // Update existing link
      await db.update(usersCompanies)
        .set({
          relationshipType: relationshipType || type,
          priority,
          isActive: true,
        })
        .where(and(
          eq(usersCompanies.userId, userId),
          eq(usersCompanies.companyId, companyId)
        ));
      
      res.json({ message: 'Company updated in tech stack', companyId });
    } else {
      // Create new link
      await db.insert(usersCompanies)
        .values({
          userId,
          companyId,
          relationshipType: relationshipType || type,
          priority,
          isActive: true
        });
      
      res.json({ message: 'Company added to tech stack', companyId });
    }
  } catch (error) {
    console.error('Error adding company:', error);
    res.status(500).json({ error: 'Failed to add company' });
  }
});

// Update company in user's stack
techStackRouter.put('/companies/:companyId', async (req, res) => {
  reqLog(req, 'PUT /tech-stack/companies/:companyId');
  const userId = getUserId(req);
  const { companyId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { relationshipType, priority, isActive } = req.body;

  try {
    await db.update(usersCompanies)
      .set({
        relationshipType,
        priority,
        isActive,
      })
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.companyId, companyId)
      ));
    
    res.json({ message: 'Company updated successfully' });
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Failed to update company' });
  }
});

// Remove company from user's stack
techStackRouter.delete('/companies/:companyId', async (req, res) => {
  reqLog(req, 'DELETE /tech-stack/companies/:companyId');
  const userId = getUserId(req);
  const { companyId } = req.params;
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await db.delete(usersCompanies)
      .where(and(
        eq(usersCompanies.userId, userId),
        eq(usersCompanies.companyId, companyId)
      ));
    
    res.json({ message: 'Company removed from tech stack' });
  } catch (error) {
    console.error('Error removing company:', error);
    res.status(500).json({ error: 'Failed to remove company' });
  }
});

// ==========================================
// THREAT ACTORS ENDPOINTS
// ==========================================

// Get all threat actors
techStackRouter.get('/threat-actors', async (req, res) => {
  reqLog(req, 'GET /tech-stack/threat-actors');
  
  try {
    const actors = await db.select()
      .from(threatActors)
      .orderBy(threatActors.name);
    
    res.json(actors);
  } catch (error) {
    console.error('Error fetching threat actors:', error);
    res.status(500).json({ error: 'Failed to fetch threat actors' });
  }
});

// Search threat actors
techStackRouter.get('/threat-actors/search', async (req, res) => {
  reqLog(req, 'GET /tech-stack/threat-actors/search');
  const { q } = req.query;
  
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'Search query is required' });
  }

  try {
    const actors = await db.select()
      .from(threatActors)
      .where(or(
        ilike(threatActors.name, `%${q}%`),
        sql`${threatActors.aliases}::text ILIKE ${`%${q}%`}`
      ))
      .limit(20);
    
    res.json(actors);
  } catch (error) {
    console.error('Error searching threat actors:', error);
    res.status(500).json({ error: 'Failed to search threat actors' });
  }
});

// ==========================================
// AI-DISCOVERED ENTITIES
// ==========================================

// Get AI-discovered entities from articles
techStackRouter.get('/discovered-entities', async (req, res) => {
  reqLog(req, 'GET /tech-stack/discovered-entities');
  const userId = getUserId(req);
  
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Get entities frequently found in articles but not in user's tech stack
    const discoveredSoftware = await db.execute(sql`
      WITH article_software_counts AS (
        SELECT 
          s.id,
          s.name,
          c.name as vendor,
          COUNT(DISTINCT ars.article_id) as article_count,
          MAX(ga.published_at) as last_seen
        FROM article_software ars
        JOIN software s ON ars.software_id = s.id
        LEFT JOIN companies c ON s.company_id = c.id
        JOIN global_articles ga ON ars.article_id = ga.id
        WHERE ga.published_at > NOW() - INTERVAL '30 days'
        GROUP BY s.id, s.name, c.name
      ),
      user_software AS (
        SELECT software_id FROM users_software WHERE user_id = ${userId} AND is_active = true
      )
      SELECT 
        id,
        name,
        vendor,
        article_count,
        last_seen
      FROM article_software_counts
      WHERE id NOT IN (SELECT software_id FROM user_software)
      ORDER BY article_count DESC
      LIMIT 10
    `);

    const discoveredHardware = await db.execute(sql`
      WITH article_hardware_counts AS (
        SELECT 
          h.id,
          h.name,
          h.manufacturer,
          h.model,
          COUNT(DISTINCT arh.article_id) as article_count,
          MAX(ga.published_at) as last_seen
        FROM article_hardware arh
        JOIN hardware h ON arh.hardware_id = h.id
        JOIN global_articles ga ON arh.article_id = ga.id
        WHERE ga.published_at > NOW() - INTERVAL '30 days'
        GROUP BY h.id, h.name, h.manufacturer, h.model
      ),
      user_hardware AS (
        SELECT hardware_id FROM users_hardware WHERE user_id = ${userId} AND is_active = true
      )
      SELECT 
        id,
        name,
        manufacturer,
        model,
        article_count,
        last_seen
      FROM article_hardware_counts
      WHERE id NOT IN (SELECT hardware_id FROM user_hardware)
      ORDER BY article_count DESC
      LIMIT 10
    `);

    const discoveredCompanies = await db.execute(sql`
      WITH article_company_counts AS (
        SELECT 
          c.id,
          c.name,
          c.type,
          c.industry,
          COUNT(DISTINCT arc.article_id) as article_count,
          MAX(ga.published_at) as last_seen
        FROM article_companies arc
        JOIN companies c ON arc.company_id = c.id
        JOIN global_articles ga ON arc.article_id = ga.id
        WHERE ga.published_at > NOW() - INTERVAL '30 days'
        GROUP BY c.id, c.name, c.type, c.industry
      ),
      user_companies AS (
        SELECT company_id FROM users_companies WHERE user_id = ${userId} AND is_active = true
      )
      SELECT 
        id,
        name,
        type,
        industry,
        article_count,
        last_seen
      FROM article_company_counts
      WHERE id NOT IN (SELECT company_id FROM user_companies)
      ORDER BY article_count DESC
      LIMIT 10
    `);
    
    res.json({
      software: discoveredSoftware.rows,
      hardware: discoveredHardware.rows,
      companies: discoveredCompanies.rows
    });
  } catch (error) {
    console.error('Error fetching discovered entities:', error);
    res.status(500).json({ error: 'Failed to fetch discovered entities' });
  }
});