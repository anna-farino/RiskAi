import { Request, Response } from "express";
import { db } from "../../db/db";
import { capsuleArticles } from "../../../shared/db/schema/news-capsule";
import { openai } from "../../services/openai";
import { FullRequest } from "../../middleware";
import { log } from "../../utils/log";
import { UnifiedScrapingService } from "backend/services/scraping";

const scrapingService = new UnifiedScrapingService();

/**
 * Generate executive summary using OpenAI
 * News Capsule specific AI integration (UNCHANGED)
 */
async function generateExecutiveSummary(content: any): Promise<any> {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert analyst creating executive-level summaries. Focus on key insights, implications, and actionable information."
        },
        {
          role: "user",
          content: `Create an executive summary for this article:
          
Title: ${content.title}
Content: ${content.content}
Publication: ${content.publication || 'Unknown'}
Author: ${content.author || 'Unknown'}

Please provide:
1. A concise executive summary (2-3 sentences)
2. Key points (3-5 bullet points)
3. Business implications
4. Recommended actions

Format as JSON with fields: summary, keyPoints, implications, recommendations`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      title: content.title,
      content: content.content,
      publication: content.publication,
      author: content.author,
      publishDate: content.publishDate,
      summary: result.summary || '',
      keyPoints: result.keyPoints || [],
      implications: result.implications || '',
      recommendations: result.recommendations || ''
    };
  } catch (error: any) {
    log(`[NewsCapsule] Error generating summary: ${error.message}`, "scraper-error");
    throw error;
  }
}

/**
 * Process URL endpoint - simplified using unified scraping system
 * Reduced from 800+ lines to ~40 lines using centralized scraping
 */
export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    log(`[NewsCapsule] Processing URL: ${url}`, "scraper");

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    // 1. Extract content using unified scraping service
    log(`[NewsCapsule] Using unified scraping service for content extraction`, "scraper");
    const content = await scrapingService.scrapeArticleUrl(url);
    
    if (!content || !content.content || content.content.length < 50) {
      log(`[NewsCapsule] Insufficient content extracted from URL`, "scraper-error");
      return res.status(400).json({ 
        error: "Failed to extract sufficient content from URL",
        details: "The article content appears to be too short or empty"
      });
    }

    log(`[NewsCapsule] Content extracted successfully: ${content.content.length} characters`, "scraper");

    // 2. Generate executive summary (News Capsule specific OpenAI integration - UNCHANGED)
    log(`[NewsCapsule] Generating executive summary with AI`, "scraper");
    const summary = await generateExecutiveSummary({
      title: content.title,
      content: content.content,
      publication: new URL(url).hostname,
      author: content.author,
      publishDate: content.publishDate
    });

    // 3. Save to database (UNCHANGED)
    const userId = (req as FullRequest).user.id;
    log(`[NewsCapsule] Saving article to database for user: ${userId}`, "scraper");
    
    const articleData = {
      ...summary,
      originalUrl: url,
      userId,
      createdAt: new Date(),
      markedForReporting: true,
      markedForDeletion: false,
    };

    const [result] = await db
      .insert(capsuleArticles)
      .values(articleData)
      .returning();
      
    log(`[NewsCapsule] Article saved successfully with ID: ${result.id}`, "scraper");

    return res.status(200).json(result);
  } catch (error: any) {
    log(`[NewsCapsule] Error processing URL: ${error.message}`, "scraper-error");
    return res.status(500).json({ 
      error: "Failed to process URL", 
      details: error.message 
    });
  }
}