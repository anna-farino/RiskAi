import { Request, Response } from 'express';
import { db } from '../../db/db';
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { capsuleArticles } from '../../../shared/db/schema/news-capsule';
import { eq, desc, inArray } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

export async function getReports(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    
    // Get all reports for this user, ordered by creation date (newest first)
    const userReports = await db
      .select()
      .from(reports)
      .where(eq(reports.userId, userId))
      .orderBy(desc(reports.createdAt));
    
    // For each report, get the associated articles
    const reportsWithArticles = await Promise.all(
      userReports.map(async (report) => {
        // Get the article IDs for this report from the join table
        const articlesJoin = await db
          .select({
            articleId: capsuleArticlesInReports.articleId
          })
          .from(capsuleArticlesInReports)
          .where(eq(capsuleArticlesInReports.reportId, report.id));
        
        // Get the full article details for each article ID
        const articleIds = articlesJoin.map(join => join.articleId);
        
        let articles = [];
        if (articleIds.length > 0) {
          articles = await db
            .select()
            .from(capsuleArticles)
            .where(
              articleIds.length === 1 
                ? eq(capsuleArticles.id, articleIds[0])
                : inArray(capsuleArticles.id, articleIds)
            );
        }
        
        return {
          ...report,
          articles
        };
      })
    );
    
    return res.status(200).json(reportsWithArticles);
  } catch (error) {
    console.error('Error retrieving reports:', error);
    return res.status(500).json({ error: 'Failed to retrieve reports' });
  }
}