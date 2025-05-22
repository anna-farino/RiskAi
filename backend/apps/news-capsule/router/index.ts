import { Router } from "express";
import { z } from "zod";
import { log } from "backend/utils/log";
import { User } from "@shared/db/schema/user";
import { storage } from "../queries/capsule";
import { createCapsule, getCurrentCapsule, generateCapsuleSummary } from "../services/capsule-manager";

export const capsuleRouter = Router();

// Get current active capsule
capsuleRouter.get("/capsule/current", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const currentCapsule = await getCurrentCapsule(userId);
    
    res.json({
      success: true,
      data: currentCapsule
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Create a new capsule
capsuleRouter.post("/capsule/create", async (req, res) => {
  try {
    const schema = z.object({
      title: z.string(),
      duration: z.number().optional(),
      sourcesToMonitor: z.array(z.string()).optional()
    });
    
    const userId = (req.user as User).id as string;
    const { title, duration, sourcesToMonitor } = schema.parse(req.body);
    
    const newCapsule = await createCapsule(userId, title, {
      duration,
      sourcesToMonitor
    });
    
    res.json({
      success: true,
      data: newCapsule
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Get capsule history
capsuleRouter.get("/capsule/history", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const capsules = await storage.getCapsulesByUser(userId);
    
    res.json({
      success: true,
      data: capsules
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Generate summary for a capsule
capsuleRouter.post("/capsule/summary/:id", async (req, res) => {
  try {
    const capsuleId = req.params.id;
    const userId = (req.user as User).id as string;
    
    const summary = await generateCapsuleSummary(userId, capsuleId);
    
    res.json({
      success: true,
      data: summary
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Update user preferences
capsuleRouter.post("/preferences", async (req, res) => {
  try {
    const schema = z.object({
      autoGenerateCapsules: z.boolean().optional(),
      frequencyHours: z.number().optional(),
      receiveNotifications: z.boolean().optional(),
      notifyOnKeywords: z.boolean().optional(),
      includeAnalytics: z.boolean().optional(),
      maxArticlesPerCapsule: z.number().optional()
    });
    
    const userId = (req.user as User).id as string;
    const preferences = schema.parse(req.body);
    
    const updatedPreferences = await storage.updateUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      data: updatedPreferences
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});

// Get user preferences
capsuleRouter.get("/preferences", async (req, res) => {
  try {
    const userId = (req.user as User).id as string;
    const preferences = await storage.getUserPreferences(userId);
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
});