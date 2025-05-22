import { Request, Response } from 'express';
import { db } from '../../db/db';
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { and, eq } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

export async function addToReport(req: Request, res: Response) {
  try {
    const { articleIds } = req.body;
    
    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'Article IDs are required' });
    }
    
    const userId = (req as FullRequest).user.id;
    
    // Check if there's a report for today, or create a new one
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Look for existing report for today
    const existingReports = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.userId, userId),
          // Filter for reports created today
          // Note: This checks if created_at is between today at 00:00:00 and tomorrow at 00:00:00
          // You might need to adjust the timezone handling based on your requirements
        )
      );
    
    let reportId;
    
    if (existingReports.length > 0) {
      // Use the most recent report from today
      reportId = existingReports[0].id;
    } else {
      // Create a new report for today
      const [newReport] = await db
        .insert(reports)
        .values({
          userId,
          createdAt: new Date()
        })
        .returning();
      
      reportId = newReport.id;
    }
    
    // Add articles to the report
    const articlesToAdd = articleIds.map(articleId => ({
      articleId,
      reportId
    }));
    
    // Use a transaction to ensure all or nothing is added
    await db.transaction(async (tx) => {
      for (const article of articlesToAdd) {
        // Check if this article is already in the report
        const existing = await tx
          .select()
          .from(capsuleArticlesInReports)
          .where(
            and(
              eq(capsuleArticlesInReports.articleId, article.articleId),
              eq(capsuleArticlesInReports.reportId, article.reportId)
            )
          );
        
        // Only insert if it doesn't exist already
        if (existing.length === 0) {
          await tx
            .insert(capsuleArticlesInReports)
            .values(article);
        }
      }
    });
    
    return res.status(200).json({ 
      success: true, 
      message: 'Articles added to report',
      reportId
    });
    
  } catch (error) {
    console.error('Error adding to report:', error);
    return res.status(500).json({ error: 'Failed to add articles to report' });
  }
}