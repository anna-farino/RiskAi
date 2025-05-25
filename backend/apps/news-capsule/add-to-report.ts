import { Request, Response } from 'express';
import { db } from '../../db/db';
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { and, eq, desc } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

export async function addToReport(req: Request, res: Response) {
  try {
    const { articleIds, useExistingReport, existingReportId, versionNumber } = req.body;
    
    if (!articleIds || !Array.isArray(articleIds) || articleIds.length === 0) {
      return res.status(400).json({ error: 'Article IDs are required' });
    }
    
    const userId = (req as FullRequest).user.id;
    
    let reportId;
    let reportVersion = 1;
    
    // If user wants to use an existing report and provided a valid ID
    if (useExistingReport && existingReportId) {
      // Verify the report exists and belongs to this user
      const existingReport = await db
        .select()
        .from(reports)
        .where(
          and(
            eq(reports.id, existingReportId),
            eq(reports.userId, userId)
          )
        );
      
      if (existingReport.length === 0) {
        return res.status(404).json({ error: 'Report not found or access denied' });
      }
      
      reportId = existingReportId;
    } else {
      // Create a new report with current date and version info
      const currentDate = new Date();
      
      // Set version number if provided
      if (versionNumber && versionNumber > 1) {
        reportVersion = versionNumber;
      }
      
      // Store version info in JSON metadata
      const metadata = {
        version: reportVersion
      };
      
      // Create a new report (database schema doesn't have title field yet)
      const [newReport] = await db
        .insert(reports)
        .values({
          userId,
          createdAt: currentDate
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