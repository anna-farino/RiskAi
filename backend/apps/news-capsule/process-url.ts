import { Request, Response } from 'express';
import puppeteer from 'puppeteer';
import { db } from '../../db/db';
import { capsuleArticles } from '../../../shared/db/schema/news-capsule';
import { openai } from '../../services/openai';
import { FullRequest } from '../../middleware';

export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Extract the content from the URL using Puppeteer
    const content = await scrapeArticleContent(url);
    
    if (!content) {
      return res.status(400).json({ error: 'Failed to extract content from URL' });
    }
    
    // Generate a summary using OpenAI
    const summary = await generateArticleSummary(content, url);
    
    // Save to database
    const userId = (req as FullRequest).user.id;
    const articleData = {
      ...summary,
      originalUrl: url,
      userId,
      createdAt: new Date(),
      markedForReporting: true,
      markedForDeletion: false
    };
    
    const [result] = await db.insert(capsuleArticles).values(articleData).returning();
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing URL:', error);
    return res.status(500).json({ error: 'Failed to process URL' });
  }
}

async function scrapeArticleContent(url: string): Promise<string | null> {
  let browser;
  
  try {
    // Launch Puppeteer with stealth plugin to avoid detection
    browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid being detected as a bot
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4758.102 Safari/537.36');
    
    // Navigate to the URL
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Extract the relevant content from the page
    const content = await page.evaluate(() => {
      // Get the article title
      const title = document.querySelector('h1')?.innerText || '';
      
      // Get the content of the article
      // This is a basic implementation and might need customization based on the structure of target sites
      const paragraphs = Array.from(document.querySelectorAll('p')).map(p => p.innerText).join(' ');
      
      // Get the publication name
      const publication = document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') || 
                          new URL(window.location.href).hostname;
      
      return {
        title,
        content: paragraphs,
        publication
      };
    });
    
    return JSON.stringify(content);
  } catch (error) {
    console.error('Error scraping article:', error);
    return null;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function generateArticleSummary(contentJson: string, url: string) {
  try {
    const content = JSON.parse(contentJson);
    
    const prompt = `
      Analyze the following cybersecurity article and generate a structured summary:
      
      Title: ${content.title}
      Publication: ${content.publication}
      URL: ${url}
      
      Content: ${content.content.substring(0, 4000)} ${content.content.length > 4000 ? '...[truncated]' : ''}
      
      Generate a structured summary with the following fields:
      1. Title (keep it concise but informative)
      2. Threat Name (what is the main threat discussed in the article)
      3. Vulnerability ID (if mentioned, otherwise "Unspecified")
      4. Summary (a 2-3 sentence summary of the main points)
      5. Impacts (what are the potential impacts of this threat, 1-2 sentences)
      6. Attack Vector (how the attack is performed, 1 sentence)
      7. Microsoft Connection (how this relates to Microsoft or Windows, if at all, 1 sentence)
      8. Target OS (what operating systems are targeted, default to "Microsoft / Windows" if unclear)
      
      Format your response as a JSON object with these exact field names.
    `;
    
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "gpt-3.5-turbo",
    });
    
    const result = completion.choices[0].message.content;
    
    try {
      // Parse the JSON response
      const parsedResult = JSON.parse(result || '{}');
      
      // Ensure all required fields are present
      return {
        title: parsedResult.Title || content.title,
        threatName: parsedResult.threatName || parsedResult["Threat Name"] || "Unknown Threat",
        vulnerabilityId: parsedResult.vulnerabilityId || parsedResult["Vulnerability ID"] || "Unspecified",
        summary: parsedResult.Summary || "No summary available.",
        impacts: parsedResult.Impacts || "No impacts specified.",
        attackVector: parsedResult.attackVector || parsedResult["Attack Vector"] || "Unknown attack vector",
        microsoftConnection: parsedResult.microsoftConnection || parsedResult["Microsoft Connection"] || "No direct Microsoft connection identified.",
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: parsedResult.targetOS || parsedResult["Target OS"] || "Microsoft / Windows"
      };
    } catch (error) {
      console.error('Error parsing AI response:', error);
      
      // Fallback to basic summary
      return {
        title: content.title,
        threatName: "Unknown Threat",
        vulnerabilityId: "Unspecified",
        summary: "Failed to generate summary. Please review the original article.",
        impacts: "Impacts could not be determined.",
        attackVector: "Unknown attack vector",
        microsoftConnection: "No direct Microsoft connection identified.",
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: "Microsoft / Windows"
      };
    }
  } catch (error) {
    console.error('Error generating article summary:', error);
    throw error;
  }
}