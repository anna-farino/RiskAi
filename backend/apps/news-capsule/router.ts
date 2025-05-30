import { Router } from 'express';
import { processUrl } from './process-url';
import { addToReport } from './add-to-report';
import { getReports } from './get-reports';
import { db } from '../../db/db';
import { capsuleArticles } from '../../../shared/db/schema/news-capsule';
import { eq, desc } from 'drizzle-orm';
import { FullRequest } from '../../middleware';

const router = Router();

// Process a URL to generate an article summary
router.post('/process-url', processUrl);

// Add article(s) to a report
router.post('/add-to-report', addToReport);

// Get all reports with their articles
router.get('/reports', getReports);

// Get all capsule articles for the current user
router.get('/articles', async (req, res) => {
  try {
    const userId = (req as FullRequest).user.id;
    const articles = await db
      .select()
      .from(capsuleArticles)
      .where(eq(capsuleArticles.userId, userId))
      .orderBy(desc(capsuleArticles.createdAt));
    
    res.json(articles);
  } catch (error) {
    console.error('Error fetching capsule articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
});

// Delete all capsule articles for the current user
router.delete('/articles', async (req, res) => {
  try {
    const userId = (req as FullRequest).user.id;
    console.log('Attempting to delete all articles for user:', userId);
    
    // First, delete all article references from reports for this user
    await db.execute(`
      DELETE FROM capsule_articles_in_reports 
      WHERE article_id IN (
        SELECT id FROM capsule_articles WHERE user_id = '${userId}'
      )
    `);
    
    // Then delete the articles themselves
    const result = await db.execute(`DELETE FROM capsule_articles WHERE user_id = '${userId}'`);
    
    console.log('Delete result:', result);
    res.json({ success: true, message: 'All articles and their references deleted' });
  } catch (error) {
    console.error('Error deleting all capsule articles:', error);
    console.error('Error details:', error.message);
    res.status(500).json({ error: 'Failed to delete all articles', details: error.message });
  }
});

// Delete a capsule article
router.delete('/articles/:id', async (req, res) => {
  try {
    const userId = (req as FullRequest).user.id;
    const articleId = req.params.id;
    
    console.log(`Attempting to delete article ${articleId} for user ${userId}`);
    
    // Verify the article belongs to the user before deleting
    const existingArticle = await db
      .select()
      .from(capsuleArticles)
      .where(eq(capsuleArticles.id, articleId))
      .limit(1);
    
    if (existingArticle.length === 0) {
      console.log(`Article ${articleId} not found`);
      return res.status(404).json({ error: 'Article not found' });
    }
    
    if (existingArticle[0].userId !== userId) {
      console.log(`User ${userId} not authorized to delete article ${articleId}`);
      return res.status(403).json({ error: 'Not authorized to delete this article' });
    }
    
    // Hard delete the article from the database
    const deleteResult = await db
      .delete(capsuleArticles)
      .where(eq(capsuleArticles.id, articleId));
    
    console.log(`Delete result for article ${articleId}:`, deleteResult);
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting capsule article:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to delete article', details: error.message });
  }
});

export { router as newsCapsuleRouter };