import { Router } from "express";
import { db } from "backend/db/db";
import { globalSources } from "@shared/db/schema/global-tables";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { verifyDevLogPermission } from "../services/permissions";
import { log } from "backend/utils/log";
import { User } from "@shared/db/schema/user";

export const adminSourceRouter = Router();

// Permission middleware - reuse live logs permission check
async function requireAdminPermission(req: any, res: any, next: any) {
  try {
    const user = req.user as User;
    if (!user || !user.email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    // Check if user has live logs permission (which grants admin access)
    const hasPermission = await verifyDevLogPermission(user.email);
    
    if (!hasPermission) {
      log(`Admin source management access denied for ${user.email}`, 'admin-sources');
      return res.status(403).json({ error: "You don't have permission to manage global sources" });
    }

    next();
  } catch (error: any) {
    log(`Error checking admin permission: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Permission check failed" });
  }
}

// Apply permission middleware to all routes
adminSourceRouter.use(requireAdminPermission);

// Validation schemas
const createSourceSchema = z.object({
  url: z.string().url("Invalid URL format"),
  name: z.string().min(1, "Name is required"),
  category: z.string().optional(),
});

const updateSourceSchema = z.object({
  url: z.string().url("Invalid URL format").optional(),
  name: z.string().min(1, "Name is required").optional(),
  category: z.string().optional(),
});

// GET all global sources
adminSourceRouter.get("/sources", async (req, res) => {
  try {
    const sources = await db
      .select()
      .from(globalSources)
      .orderBy(globalSources.addedAt);

    log(`Admin fetched ${sources.length} global sources`, 'admin-sources');
    res.json(sources);
  } catch (error: any) {
    log(`Error fetching global sources: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to fetch sources" });
  }
});

// GET single global source
adminSourceRouter.get("/sources/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    const [source] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!source) {
      return res.status(404).json({ error: "Source not found" });
    }

    res.json(source);
  } catch (error: any) {
    log(`Error fetching source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to fetch source" });
  }
});

// POST create new global source
adminSourceRouter.post("/sources", async (req, res) => {
  try {
    const user = req.user as User;
    const validatedData = createSourceSchema.parse(req.body);

    // Check if URL already exists
    const existing = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.url, validatedData.url))
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({ error: "A source with this URL already exists" });
    }

    // Create the source
    const [newSource] = await db
      .insert(globalSources)
      .values({
        url: validatedData.url,
        name: validatedData.name,
        category: validatedData.category || null,
        isActive: true,
        isDefault: false,
        addedBy: user.id,
      })
      .returning();

    log(`Admin ${user.email} created new global source: ${newSource.name}`, 'admin-sources');
    res.status(201).json(newSource);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    log(`Error creating source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to create source" });
  }
});

// PUT update global source
adminSourceRouter.put("/sources/:id", async (req, res) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const validatedData = updateSourceSchema.parse(req.body);

    // Check if source exists
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Source not found" });
    }

    // Prevent updating default sources
    if (existing.isDefault) {
      return res.status(403).json({ error: "Cannot modify default sources" });
    }

    // If URL is being updated, check for duplicates
    if (validatedData.url && validatedData.url !== existing.url) {
      const duplicate = await db
        .select()
        .from(globalSources)
        .where(eq(globalSources.url, validatedData.url))
        .limit(1);

      if (duplicate.length > 0) {
        return res.status(409).json({ error: "A source with this URL already exists" });
      }
    }

    // Update the source
    const [updated] = await db
      .update(globalSources)
      .set({
        ...(validatedData.url && { url: validatedData.url }),
        ...(validatedData.name && { name: validatedData.name }),
        ...(validatedData.category !== undefined && { category: validatedData.category }),
      })
      .where(eq(globalSources.id, id))
      .returning();

    log(`Admin ${user.email} updated global source: ${updated.name}`, 'admin-sources');
    res.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors[0].message });
    }
    log(`Error updating source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to update source" });
  }
});

// PUT toggle source active/inactive status
adminSourceRouter.put("/sources/:id/toggle", async (req, res) => {
  try {
    const user = req.user as User;
    const { id } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ error: "isActive must be a boolean" });
    }

    // Check if source exists
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Source not found" });
    }

    // Prevent toggling default sources
    if (existing.isDefault) {
      log(`Admin ${user.email} attempted to toggle default source: ${existing.name}`, 'admin-sources');
      return res.status(403).json({ error: "Cannot enable/disable default sources." });
    }

    // Update the source
    const [updated] = await db
      .update(globalSources)
      .set({ isActive })
      .where(eq(globalSources.id, id))
      .returning();

    log(`Admin ${user.email} ${isActive ? 'enabled' : 'disabled'} global source: ${updated.name}`, 'admin-sources');
    res.json(updated);
  } catch (error: any) {
    log(`Error toggling source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to toggle source" });
  }
});

// DELETE hard delete a global source
adminSourceRouter.delete("/sources/:id", async (req, res) => {
  try {
    const user = req.user as User;
    const { id } = req.params;

    // Check if source exists
    const [existing] = await db
      .select()
      .from(globalSources)
      .where(eq(globalSources.id, id))
      .limit(1);

    if (!existing) {
      return res.status(404).json({ error: "Source not found" });
    }

    // Prevent deleting default sources
    if (existing.isDefault) {
      return res.status(403).json({ error: "Cannot delete default sources. Default sources are protected and cannot be modified." });
    }

    // Delete the source
    await db
      .delete(globalSources)
      .where(eq(globalSources.id, id));

    log(`Admin ${user.email} deleted global source: ${existing.name}`, 'admin-sources');
    res.json({ success: true, message: "Source deleted successfully" });
  } catch (error: any) {
    log(`Error deleting source: ${error.message}`, 'admin-sources-error');
    res.status(500).json({ error: "Failed to delete source" });
  }
});
