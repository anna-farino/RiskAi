import express from 'express';
import { processAndStoreArticle, getArticles, getArticleById } from '../services/article-scraper';
import { z } from 'zod';

const router = express.Router();

// Schema for URL validation
const urlSchema = z.object({
  url: z.string().url("Please provide a valid URL")
});

// Process a new article URL
router.post('/process', async (req, res) => {
  try {
    // Validate the URL
    const validationResult = urlSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid URL format" 
      });
    }

    const { url } = validationResult.data;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required"
      });
    }

    // Process the article
    const article = await processAndStoreArticle(url, userId);

    return res.status(200).json({
      success: true,
      article
    });
  } catch (error) {
    console.error('Error processing article:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to process article"
    });
  }
});

// Get all articles for the authenticated user
router.get('/articles', async (req, res) => {
  try {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required"
      });
    }

    const articles = await getArticles(userId);
    return res.status(200).json({
      success: true,
      articles
    });
  } catch (error) {
    console.error('Error fetching articles:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch articles"
    });
  }
});

// Get a specific article by ID
router.get('/articles/:id', async (req, res) => {
  try {
    const userId = req.user?.id;
    const articleId = req.params.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "User authentication required"
      });
    }

    const article = await getArticleById(articleId);
    
    if (!article) {
      return res.status(404).json({
        success: false,
        error: "Article not found"
      });
    }

    // Check if the article belongs to the user
    if (article.userId !== userId) {
      return res.status(403).json({
        success: false,
        error: "You don't have permission to access this article"
      });
    }

    return res.status(200).json({
      success: true,
      article
    });
  } catch (error) {
    console.error('Error fetching article:', error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch article"
    });
  }
});

export default router;