import OpenAI from "openai";
import { log } from "backend/utils/log";

// Setup OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface ExtractedContent {
  title: string;
  content: string;
  author: string | null;
  publishDate: string | null; // ISO date string
}

/**
 * Uses OpenAI to extract and properly identify article content, author, and publish date
 * This approach eliminates field confusion by having AI analyze the full content
 */
export async function extractArticleContentWithAI(html: string, url: string): Promise<ExtractedContent> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key not configured");
    }

    // Clean and prepare HTML for analysis
    let processedHtml = html;
    
    // Extract body content if available
    const bodyMatch = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
    if (bodyMatch && bodyMatch[1]) {
      processedHtml = bodyMatch[1];
    }

    // Limit content size to stay within token limits
    const MAX_LENGTH = 50000;
    if (processedHtml.length > MAX_LENGTH) {
      processedHtml = processedHtml.substring(0, MAX_LENGTH) + "... [truncated]";
      log(`[ThreatTracker] Truncated HTML from ${html.length} to ${MAX_LENGTH} characters for OpenAI analysis`, "content-extractor");
    }

    const prompt = `
You are an expert content extractor. Analyze this HTML from ${url} and extract the following information:

1. **Article Title**: The main headline/title of the article
2. **Article Content**: The main body text of the article (clean text, no HTML)
3. **Author**: The person who wrote the article (MUST be a person's name, NOT a date)
4. **Publish Date**: When the article was published (MUST be a date, NOT a person's name)

CRITICAL RULES:
- Author field must ONLY contain actual human names (e.g., "John Smith", "Sarah Johnson")
- Publish Date field must ONLY contain dates (e.g., "2024-06-04", "June 4, 2024", "2 days ago")
- NEVER put dates in the author field
- NEVER put names in the publish date field
- If you cannot clearly identify an author name, return null for author
- If you cannot clearly identify a publish date, return null for publishDate
- Look for author indicators like "By [Name]", "Written by [Name]", bylines, etc.
- Look for date indicators in meta tags, time elements, date classes, etc.

Return your response in this exact JSON format:
{
  "title": "extracted title",
  "content": "extracted article content as clean text",
  "author": "author name or null",
  "publishDate": "date string or null"
}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are a precise content extraction assistant. Always follow the field separation rules exactly."
        },
        {
          role: "user",
          content: prompt + "\n\nHTML to analyze:\n" + processedHtml
        }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Lower temperature for more consistent extraction
    });

    const response = completion.choices[0].message.content;
    if (!response) {
      throw new Error("No response from OpenAI");
    }

    const extracted = JSON.parse(response);
    
    // Validate and clean the extracted data
    const result: ExtractedContent = {
      title: extracted.title?.trim() || "Untitled",
      content: extracted.content?.trim() || "",
      author: validateAuthor(extracted.author),
      publishDate: validateAndFormatDate(extracted.publishDate)
    };

    log(`[ThreatTracker] OpenAI extraction complete: title=${result.title ? 'found' : 'missing'}, content=${result.content.length} chars, author=${result.author ? 'found' : 'missing'}, date=${result.publishDate ? 'found' : 'missing'}`, "content-extractor");
    
    return result;

  } catch (error: any) {
    log(`[ThreatTracker] Error in OpenAI content extraction: ${error.message}`, "content-extractor-error");
    throw error;
  }
}

/**
 * Validates that the author field contains an actual name, not a date
 */
function validateAuthor(author: any): string | null {
  if (!author || typeof author !== 'string') {
    return null;
  }

  const cleanAuthor = author.trim();
  
  // Check if it looks like a date (should not be in author field)
  const datePatterns = [
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\b/i,
    /\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/,
    /\b\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}\b/,
    /\b\d{1,2}\s+(days?|weeks?|months?|years?)\s+ago\b/i,
    /\b(today|yesterday|tomorrow)\b/i
  ];

  for (const pattern of datePatterns) {
    if (pattern.test(cleanAuthor)) {
      log(`[ThreatTracker] Rejected author field containing date pattern: ${cleanAuthor}`, "content-extractor");
      return null;
    }
  }

  // Check if it looks like a reasonable author name
  if (cleanAuthor.length < 2 || cleanAuthor.length > 100) {
    return null;
  }

  return cleanAuthor;
}

/**
 * Validates and formats the publish date
 */
function validateAndFormatDate(publishDate: any): string | null {
  if (!publishDate || typeof publishDate !== 'string') {
    return null;
  }

  const cleanDate = publishDate.trim();
  
  // Check if it looks like a person's name (should not be in date field)
  const namePatterns = [
    /^[A-Z][a-z]+ [A-Z][a-z]+$/, // "John Smith" pattern
    /^(Dr|Mr|Ms|Mrs|Prof)\.\s+[A-Z]/i, // Title patterns
  ];

  for (const pattern of namePatterns) {
    if (pattern.test(cleanDate)) {
      log(`[ThreatTracker] Rejected date field containing name pattern: ${cleanDate}`, "content-extractor");
      return null;
    }
  }

  try {
    // Try to parse as a date
    const parsedDate = new Date(cleanDate);
    
    // Check if it's a valid date and within reasonable bounds
    if (!isNaN(parsedDate.getTime())) {
      const year = parsedDate.getFullYear();
      if (year >= 1990 && year <= 2030) {
        return parsedDate.toISOString();
      }
    }

    // Handle relative dates like "2 days ago"
    const relativeMatch = cleanDate.match(/(\d+)\s+(days?|weeks?|months?|years?)\s+ago/i);
    if (relativeMatch) {
      const amount = parseInt(relativeMatch[1]);
      const unit = relativeMatch[2].toLowerCase();
      const now = new Date();
      
      switch (unit.charAt(0)) {
        case 'd': // days
          now.setDate(now.getDate() - amount);
          break;
        case 'w': // weeks
          now.setDate(now.getDate() - (amount * 7));
          break;
        case 'm': // months
          now.setMonth(now.getMonth() - amount);
          break;
        case 'y': // years
          now.setFullYear(now.getFullYear() - amount);
          break;
      }
      
      return now.toISOString();
    }

    log(`[ThreatTracker] Could not parse date: ${cleanDate}`, "content-extractor");
    return null;

  } catch (error) {
    log(`[ThreatTracker] Error parsing date: ${cleanDate}`, "content-extractor-error");
    return null;
  }
}