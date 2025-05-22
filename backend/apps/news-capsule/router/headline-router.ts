import { Request, Response } from 'express';
import { extractHeadlineFromURL } from '../services/headline-extractor';
import { extractArticleContent } from '../services/article-content-extractor';
import { extractRealArticleData } from '../services/real-article-extractor';

/**
 * Handles requests to extract a headline from a URL
 */
export async function handleExtractHeadline(req: Request, res: Response) {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL is required' 
      });
    }
    
    // Extract the headline from the URL
    const headline = await extractHeadlineFromURL(url);
    
    return res.status(200).json({
      success: true,
      headline
    });
    
  } catch (error) {
    console.error('Error extracting headline:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}

/**
 * Handles requests to extract full article content and analysis
 */
export async function handleExtractArticleContent(req: Request, res: Response) {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        message: 'URL is required' 
      });
    }
    
    // Extract and analyze the article content using real data extraction
    const articleContent = await extractRealArticleData(url);
    
    return res.status(200).json({
      success: true,
      article: articleContent
    });
    
  } catch (error) {
    console.error('Error extracting article content:', error);
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'An unknown error occurred'
    });
  }
}