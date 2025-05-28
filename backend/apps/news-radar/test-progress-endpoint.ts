import { Request, Response } from 'express';

// Simple endpoint to test the progress component
export async function testProgress(_req: Request, res: Response) {
  try {
    // Manually set progress to active for testing
    const fs = require('fs');
    const path = require('path');
    
    // Create a simple progress state file
    const progressData = {
      isActive: true,
      currentSource: "CNN Breaking News",
      currentArticle: "Major cybersecurity vulnerability discovered",
      totalSources: 5,
      currentSourceIndex: 2,
      articlesAdded: 8,
      articlesSkipped: 3,
      errors: [],
      startTime: new Date().toISOString()
    };
    
    // Write to a temporary file that the progress endpoint can read
    const progressFile = path.join(__dirname, '../../temp-progress.json');
    fs.writeFileSync(progressFile, JSON.stringify(progressData, null, 2));
    
    res.json({ success: true, message: "Progress activated - check the component!" });
  } catch (error) {
    console.error("Test progress error:", error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    res.status(500).json({ success: false, message: errorMessage });
  }
}