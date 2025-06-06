import { db } from "../../db/db";
import { FullRequest } from "../../middleware";
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { and, eq } from "drizzle-orm";
import { Request, Response } from "express";


export async function removeArticleFromReport (req: Request, res: Response) {
  console.log("Delete artile from report route hit")
  try {
    const userId = (req as FullRequest).user.id;
    const { reportId, articleId } = req.params;
    
    // Verify the report belongs to the user
    const existingReport = await db
      .select()
      .from(reports)
      .where(
        and(
          eq(reports.id, reportId),
          eq(reports.userId, userId)
        )
      )
      .limit(1);
    
    if (existingReport.length === 0) {
      return res.status(404).json({ error: 'Report not found or access denied' });
    }
    
    // Remove the article from the report
    await db
      .delete(capsuleArticlesInReports)
      .where(
        and(
          eq(capsuleArticlesInReports.reportId, reportId),
          eq(capsuleArticlesInReports.articleId, articleId)
        )
      );
    
    res.json({ 
      success: true,
      message: 'Article removed from report successfully'
    });
  } catch (error) {
    console.error('Error removing article from report:', error);
    res.status(500).json({ error: 'Failed to remove article from report' });
  }
}
