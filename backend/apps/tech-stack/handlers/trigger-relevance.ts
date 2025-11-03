import { Response } from "express";
import { relevanceScorer } from "../../threat-tracker/services/relevance-scorer";
import { log } from "../../../utils/log";

// POST /api/tech-stack/trigger-relevance - Trigger relevance score calculation
export async function triggerRelevance(req: any, res: Response) {
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
}
