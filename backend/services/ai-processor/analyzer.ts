// AI Article Analyzer - Handles cybersecurity detection and content analysis
import { db } from "backend/db/db";
import { eq, or, isNull, ne } from "drizzle-orm";
import { globalArticles } from "@shared/db/schema/global";
import { log } from "backend/utils/log";
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Analysis configuration
const ANALYSIS_VERSION = "v1.0"; // Increment when analysis logic changes

interface AnalysisResult {
  isCybersecurity: boolean;
  securityScore: number; // 0-100
  threatCategories: string[];
  summary: string;
  detectedKeywords: string[];
}

/**
 * Main function to analyze an article with AI
 */
export async function analyzeArticleWithAI(articleId: string): Promise<void> {
  const startTime = Date.now();
  
  try {
    log(`[AIAnalyzer] Starting analysis for article ${articleId}`, 'ai-analyzer');

    // Get article from database
    const [article] = await db.select()
      .from(globalArticles)
      .where(eq(globalArticles.id, articleId))
      .limit(1);

    if (!article) {
      throw new Error(`Article ${articleId} not found`);
    }

    // Check if already analyzed with current version
    if (article.lastAnalyzedAt && article.analysisVersion === ANALYSIS_VERSION) {
      log(`[AIAnalyzer] Article ${articleId} already analyzed with current version`, 'ai-analyzer');
      return;
    }

    // Perform AI analysis
    const analysisResult = await performAIAnalysis(article.title, article.content);

    // Update article in database with analysis results
    await db.update(globalArticles)
      .set({
        summary: analysisResult.summary,
        isCybersecurity: analysisResult.isCybersecurity,
        securityScore: analysisResult.securityScore,
        threatCategories: analysisResult.threatCategories,
        detectedKeywords: analysisResult.detectedKeywords,
        lastAnalyzedAt: new Date(),
        analysisVersion: ANALYSIS_VERSION
      })
      .where(eq(globalArticles.id, articleId));

    const duration = Math.round((Date.now() - startTime) / 1000);
    log(`[AIAnalyzer] Completed analysis for article ${articleId} in ${duration}s - Cybersecurity: ${analysisResult.isCybersecurity} (Score: ${analysisResult.securityScore})`, 'ai-analyzer');

  } catch (error) {
    log(`[AIAnalyzer] Failed to analyze article ${articleId}: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Perform the actual AI analysis using OpenAI
 */
async function performAIAnalysis(title: string, content: string): Promise<AnalysisResult> {
  try {
    // Truncate content if too long (OpenAI has token limits)
    const maxContentLength = 15000; // Roughly 4000 tokens
    const truncatedContent = content.length > maxContentLength 
      ? content.substring(0, maxContentLength) + "..."
      : content;

    const prompt = `Analyze this news article for cybersecurity relevance:

Title: ${title}

Content: ${truncatedContent}

Please provide a JSON response with the following structure:
{
  "isCybersecurity": boolean, // true if this article is related to cybersecurity, data breaches, hacking, malware, etc.
  "securityScore": number, // 0-100 score indicating cybersecurity relevance (0=not relevant, 100=highly relevant)
  "threatCategories": string[], // array of threat categories if applicable (e.g., "malware", "data breach", "ransomware", "phishing", "vulnerability")
  "summary": string, // 2-3 sentence summary of the article
  "detectedKeywords": string[] // important cybersecurity keywords found in the article
}

Guidelines:
- Only mark as cybersecurity if clearly related to information security, data breaches, cyber attacks, malware, vulnerabilities, etc.
- Security score should reflect both relevance and severity/impact
- Threat categories should use standard cybersecurity taxonomy
- Summary should be concise but informative
- Keywords should be actual cybersecurity terms found in the content

Respond only with valid JSON:`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use cost-effective model for analysis
      messages: [
        {
          role: "system",
          content: "You are a cybersecurity expert analyzing news articles. Always respond with valid JSON only, no additional text."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.1, // Low temperature for consistent analysis
      max_tokens: 1000
    });

    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse JSON response
    let analysisResult: AnalysisResult;
    try {
      analysisResult = JSON.parse(response);
    } catch (parseError) {
      log(`[AIAnalyzer] Failed to parse OpenAI response: ${response}`, 'error');
      throw new Error("Invalid JSON response from OpenAI");
    }

    // Validate response structure
    if (typeof analysisResult.isCybersecurity !== 'boolean' ||
        typeof analysisResult.securityScore !== 'number' ||
        !Array.isArray(analysisResult.threatCategories) ||
        typeof analysisResult.summary !== 'string' ||
        !Array.isArray(analysisResult.detectedKeywords)) {
      throw new Error("Invalid response structure from OpenAI");
    }

    // Sanitize values
    analysisResult.securityScore = Math.max(0, Math.min(100, Math.round(analysisResult.securityScore)));
    analysisResult.threatCategories = analysisResult.threatCategories.filter(cat => 
      typeof cat === 'string' && cat.length > 0
    ).slice(0, 10); // Limit to 10 categories
    analysisResult.detectedKeywords = analysisResult.detectedKeywords.filter(kw => 
      typeof kw === 'string' && kw.length > 0
    ).slice(0, 20); // Limit to 20 keywords

    return analysisResult;

  } catch (error) {
    if (error.code === 'insufficient_quota' || error.code === 'rate_limit_exceeded') {
      throw new Error(`OpenAI API error: ${error.message}`);
    }
    throw error;
  }
}

/**
 * Batch analyze multiple articles (for migration or bulk processing)
 */
export async function batchAnalyzeArticles(articleIds: string[], batchSize: number = 10): Promise<void> {
  log(`[AIAnalyzer] Starting batch analysis of ${articleIds.length} articles`, 'ai-analyzer');

  for (let i = 0; i < articleIds.length; i += batchSize) {
    const batch = articleIds.slice(i, i + batchSize);
    log(`[AIAnalyzer] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(articleIds.length/batchSize)}`, 'ai-analyzer');

    // Process batch with small delays to avoid rate limits
    const batchPromises = batch.map(async (articleId, index) => {
      // Small staggered delay to avoid hitting rate limits
      await new Promise(resolve => setTimeout(resolve, index * 1000));
      return analyzeArticleWithAI(articleId);
    });

    // Wait for batch to complete
    const results = await Promise.allSettled(batchPromises);
    
    // Log batch results
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.length - successful;
    log(`[AIAnalyzer] Batch completed: ${successful} successful, ${failed} failed`, 'ai-analyzer');

    // Delay between batches
    if (i + batchSize < articleIds.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  log(`[AIAnalyzer] Batch analysis completed`, 'ai-analyzer');
}

/**
 * Re-analyze articles when analysis version changes
 */
export async function reanalyzeOutdatedArticles(): Promise<void> {
  log(`[AIAnalyzer] Starting re-analysis of outdated articles`, 'ai-analyzer');

  try {
    // Get articles that need re-analysis
    const outdatedArticles = await db.select({ id: globalArticles.id })
      .from(globalArticles)
      .where(
        or(
          isNull(globalArticles.analysisVersion),
          ne(globalArticles.analysisVersion, ANALYSIS_VERSION)
        )
      );

    if (outdatedArticles.length === 0) {
      log(`[AIAnalyzer] No outdated articles found`, 'ai-analyzer');
      return;
    }

    log(`[AIAnalyzer] Found ${outdatedArticles.length} articles needing re-analysis`, 'ai-analyzer');

    const articleIds = outdatedArticles.map(a => a.id);
    await batchAnalyzeArticles(articleIds);

  } catch (error) {
    log(`[AIAnalyzer] Failed to re-analyze outdated articles: ${error.message}`, 'error');
    throw error;
  }
}