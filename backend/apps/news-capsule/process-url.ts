import { Request, Response } from "express";
import { db } from "../../db/db";
import { capsuleArticles } from "../../../shared/db/schema/news-capsule";
import { openai } from "../../services/openai";
import { FullRequest } from "../../middleware";
import { log } from "../../utils/log";
import { unifiedScraper } from 'backend/services/scraping/scrapers/main-scraper';

// Use the unified scraper directly

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
          content: "You are an expert cybersecurity analyst creating executive-level threat summaries. Focus on security implications, threat assessment, and actionable intelligence."
        },
        {
          role: "user",
          content: `Analyze this cybersecurity article and extract threat intelligence:
          
Title: ${content.title}
Content: ${content.content}
Publication: ${content.publication || 'Unknown'}
Author: ${content.author || 'Unknown'}

Please provide a comprehensive threat analysis with:
1. Threat Name - A clear, concise name for the primary threat/vulnerability (e.g., "CVE-2024-1234 Remote Code Execution", "Ransomware Campaign", "Supply Chain Attack")
2. Executive Summary - 2-3 sentences highlighting the key threat
3. Impact Assessment - What damage this threat could cause to organizations
4. Attack Vector - How the threat operates or spreads
5. Microsoft Connection - Any connection to Microsoft products/services (if none, state "No direct Microsoft connection identified")
6. Vulnerability ID - CVE number if mentioned, otherwise "Unspecified"
7. Target OS - Primary operating system affected (default: "Microsoft / Windows")

Format as JSON with fields: threatName, summary, impacts, attackVector, microsoftConnection, vulnerabilityId, targetOS`
        }
      ],
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    return {
      title: content.title,
      threatName: result.threatName || 'Unspecified Security Threat',
      vulnerabilityId: result.vulnerabilityId || 'Unspecified',
      summary: result.summary || '',
      impacts: result.impacts || 'Impact assessment not available',
      attackVector: result.attackVector || 'Unknown attack vector',
      microsoftConnection: result.microsoftConnection || 'No direct Microsoft connection identified',
      sourcePublication: content.publication || new URL(content.originalUrl || '').hostname || 'Unknown',
      targetOS: result.targetOS || 'Microsoft / Windows'
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
    const content = await unifiedScraper.scrapeArticleUrl(url);
    
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

    // 3. Save to database with proper field mapping
    const userId = (req as FullRequest).user.id;
    log(`[NewsCapsule] Saving article to database for user: ${userId}`, "scraper");
    
    const articleData = {
      title: summary.title,
      threatName: summary.threatName,
      vulnerabilityId: summary.vulnerabilityId,
      summary: summary.summary,
      impacts: summary.impacts,
      attackVector: summary.attackVector,
      microsoftConnection: summary.microsoftConnection,
      sourcePublication: summary.sourcePublication,
      originalUrl: url,
      targetOS: summary.targetOS,
      userId,
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