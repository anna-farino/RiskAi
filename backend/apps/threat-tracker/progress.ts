import { Request, Response } from 'express';
import { getThreatTrackerProgress, updateThreatTrackerProgress, ScrapingProgress } from 'backend/utils/scraping-progress';

export function updateProgress(update: Partial<ScrapingProgress>) {
  updateThreatTrackerProgress(update);
}

export async function getProgress(_req: Request, res: Response) {
  try {
    const progress = getThreatTrackerProgress();
    res.json(progress);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
}