import { db } from "../../db/db";
import { FullRequest } from "../../middleware";
import { capsuleArticles } from '../../../shared/db/schema/news-capsule/index';
import { capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { eq } from "drizzle-orm";
import { Request, Response } from "express";


export async function deleteCapsuleArticle(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    const articleId = req.params.id;
    
    // Verify the article belongs to the user before deleting
    const existingArticle = await db
      .select()
      .from(capsuleArticles)
      .where(eq(capsuleArticles.id, articleId))
      .limit(1);
    
    if (existingArticle.length === 0) {
      return res.status(404).json({ error: 'Article not found' });
    }
    
    if (existingArticle[0].userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this article' });
    }
    
    // Use a transaction to ensure both operations succeed or fail together
    await db.transaction(async (tx) => {
      // First, remove the article from all reports
      await tx
        .delete(capsuleArticlesInReports)
        .where(eq(capsuleArticlesInReports.articleId, articleId));
      
      // Then, delete the article itself
      await tx
        .delete(capsuleArticles)
        .where(eq(capsuleArticles.id, articleId));
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting capsule article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
}
