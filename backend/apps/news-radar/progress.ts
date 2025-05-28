import { Request, Response } from 'express';

let currentProgress = {
  isActive: false,
  articlesAdded: 0,
  articlesSkipped: 0,
  totalSources: 0,
  currentSourceIndex: 0,
  errors: []
};

// Function to update progress (can be called from scraping operations)
export function updateProgress(update: any) {
  currentProgress = { ...currentProgress, ...update };
}

export async function getProgress(_req: Request, res: Response) {
  try {
    res.json(currentProgress);
  } catch (error) {
    console.error('Progress endpoint error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
}