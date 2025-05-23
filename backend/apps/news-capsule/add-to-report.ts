import { Request, Response } from 'express';
import { db } from '../../db/db';
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { and, eq, desc } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

export async function addToReport(req: Request, res: Response) {
  try {
    const { articleIds } = req.body;
    
    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'Article IDs are required' });
    }
    
    const userId = (req as FullRequest).user.id;
    
    // Create a new report for today with current date
    const currentDate = new Date();
    
    // Create a new report
    const [newReport] = await db
      .insert(reports)
      .values({
        userId,
        createdAt: currentDate
      })
      .returning();
    
    const reportId = newReport.id;
    
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