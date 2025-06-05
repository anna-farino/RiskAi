import { Router } from 'express';
import { processUrl } from './process-url';
import { addToReport } from './add-to-report';
import { getReports } from './get-reports';
import { deleteReport } from './delete-report';
import { db } from '../../db/db';
import { capsuleArticles } from '../../../shared/db/schema/news-capsule';
import { reports, capsuleArticlesInReports } from '../../../shared/db/schema/reports';
import { eq, desc, and, sql } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

const router = Router();

// Process a URL to generate an article summary
router.post('/process-url', processUrl);

// Add article(s) to a report
router.post('/add-to-report', addToReport);

// Get all reports with their articles
router.get('/reports', getReports);

// Delete a report
router.delete('/reports/:id', deleteReport);

// Remove article from report
router.delete('/reports/:reportId/articles/:articleId', async (req, res) => {
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
});

// Get all capsule articles for the current user
router.get('/articles', async (req, res) => {
  try {
    const userId = (req as FullRequest).user.id;
    const articles = await db
      .select()
      .from(capsuleArticles)
      .where(
        and(
          eq(capsuleArticles.userId, userId),
          eq(capsuleArticles.markedForDeletion, false)
        )
      )
      .orderBy(desc(capsuleArticles.createdAt));
    
    res.json(articles);
  } catch (error) {
    console.error('Error fetching capsule articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Delete a capsule article
router.delete('/articles/:id', async (req, res) => {
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
    
    await db
      .delete(capsuleArticles)
      .where(eq(capsuleArticles.id, articleId));
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting capsule article:', error);
    res.status(500).json({ error: 'Failed to delete article' });
  }
});

export { router as newsCapsuleRouter };