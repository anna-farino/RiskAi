import { Request, Response } from 'express';
import puppeteer from 'puppeteer-extra';
import { db } from '../../db/db';
import { capsuleArticles } from '../../../shared/db/schema/news-capsule';
import { openai } from '../../services/openai';
import { FullRequest } from '../../middleware';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import type { Browser, Page } from 'puppeteer';
import { execSync } from 'child_process';
import { log } from 'console';
import vanillaPuppeteer from 'puppeteer';
import * as fs from 'fs';
import { get } from 'http';


const PUPPETEER_EXECUTABLE_PATH = '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium'; // Use our installed Chromium unwrapped

// Add stealth plugin to bypass bot detection
puppeteer.use(StealthPlugin());

// Try to find the Chrome executable path
function findChromePath() {
  console.log("Database URL", process.env.DATABASE_URL)
  
  try {
    const chromePath = execSync('which chromium').toString().trim();
    return chromePath;
  } catch(e) {
    // Then try to find Chrome using which command
    try {
      const chromePath = execSync('which chrome').toString().trim();
      return chromePath;
    } catch (e) {
      console.log("[findChromePath] Using default path");
    }
  }
  // First try the known Replit Chromium unwrapped path (most likely to work)
  const replitChromiumUnwrapped = '/nix/store/l58kg6vnq5mp4618n3vxm6qm2qhra1zk-chromium-unwrapped-125.0.6422.141/libexec/chromium/chromium';
  try {
    if (fs.existsSync(replitChromiumUnwrapped)) {
      console.log(`[findChromePath] Using Replit's installed Chromium Unwrapped:`, replitChromiumUnwrapped);
      return replitChromiumUnwrapped;
    }
  } catch (err) {
    console.log(`[findChromePath] Error checking Replit Chromium Unwrapped:`, err);
  }
  
  // Try the wrapper script as a fallback
  const replitChromium = '/nix/store/zi4f80l169xlmivz8vja8wlphq74qqk0-chromium-125.0.6422.141/bin/chromium';
  try {
    if (fs.existsSync(replitChromium)) {
      console.log(`[findChromePath] Using Replit's installed Chromium wrapper:`, replitChromium);
      return replitChromium;
    }
  } catch (err) {
    console.log(`[findChromePath] Error checking Replit Chromium wrapper:`, err);
  }
  try {
    console.log("[Trying vanilla Puppeteer...]")
    const chrome = vanillaPuppeteer.executablePath();
    console.log(`[findChromePath] Puppeteer's bundled Chromium:`, chrome);
    return chrome;
  } catch (e) {
    console.log(`[findChromePath] Error getting puppeteer path:`, e);
  }
}

const CHROME_PATH = findChromePath();
console.log(`[Puppeteer] Using Chrome at: ${CHROME_PATH}`);

let browser: Browser | null = null;

async function getBrowser() {
  log(`[GET BROWSER] chrome_path, env_path`, CHROME_PATH, PUPPETEER_EXECUTABLE_PATH )
    try {
      // Use a more minimal configuration to avoid dependencies
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--disable-gpu',
          '--window-size=1920x1080',
          '--disable-features=site-per-process,AudioServiceOutOfProcess',  // For stability
          '--disable-software-rasterizer',
          '--disable-extensions',
          '--disable-gl-drawing-for-tests',  // Disable GPU usage
          '--mute-audio',  // No audio needed for scraping
          '--no-zygote',   // Run without zygote process
          '--no-first-run',  // Skip first run wizards
          '--no-default-browser-check',
          '--ignore-certificate-errors',
          '--allow-running-insecure-content',
          '--disable-web-security',
          '--disable-blink-features=AutomationControlled' // Avoid detection
        ],
        executablePath: CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH,
        // Set longer browser launch timeout
        timeout: 180000 // 3 minute timeout on browser launch
      });
      console.log("[getBrowser] Browser launched successfully");
    } catch (error) {
      console.error("[getBrowser] Failed to launch browser:", error);
      throw error;
    }
  console.log("[getBrowser] browser instance:", browser)
  return browser;
}

export async function processUrl(req: Request, res: Response) {
  try {
    const { url } = req.body;
    console.log('Processing URL:', url);
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    // Extract the content from the URL using Puppeteer
    console.log('Starting content extraction...');
    const content = await scrapeArticleContent(url);
    console.log('Content extracted successfully');
    
    if (!content) {
      console.log('No content extracted from URL');
      return res.status(400).json({ error: 'Failed to extract content from URL' });
    }
    
    // Generate a summary using OpenAI
    console.log('Starting AI summary generation...');
    const summary = await generateArticleSummary(content, url);
    console.log('AI summary generated successfully');
    
    // Save to database
    const userId = (req as FullRequest).user.id;
    console.log('Saving to database for user:', userId);
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
      createdAt: new Date(),
      markedForReporting: true,
      markedForDeletion: false
    };
    
    const [result] = await db.insert(capsuleArticles).values(articleData).returning();
    console.log('Article saved successfully with ID:', result.id);
    
    return res.status(200).json(result);
  } catch (error) {
    console.error('Error processing URL:', error);
    console.error('Error stack:', error.stack);
    return res.status(500).json({ error: 'Failed to process URL', details: error.message });
  }
}

async function scrapeArticleContent(url: string): Promise<string | null> {
  let browser;
  
  try {
    // Launch Puppeteer with stealth plugin to avoid detection
    browser = await getBrowser();
    
    const page = await browser.newPage();
    
    // Enhanced anti-detection measures
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1366, height: 768 });
    
    // Set additional headers to appear more like a real browser
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9',
      'Accept-Encoding': 'gzip, deflate, br',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    });
    
    // Navigate to the URL with longer timeout and different wait strategy
    console.log(`Navigating to: ${url}`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded', 
      timeout: 45000 
    });
    
    // Wait for content to load with fallback for different Puppeteer versions
    try {
      await page.waitForDelay(2000);
    } catch (e) {
      // Fallback for older Puppeteer versions or use setTimeout
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    // Try multiple selectors for better content extraction
    const content = await page.evaluate(() => {
      // Get the article title with multiple fallbacks
      const title = 
        document.querySelector('h1')?.innerText ||
        document.querySelector('.entry-title')?.innerText ||
        document.querySelector('.post-title')?.innerText ||
        document.querySelector('title')?.innerText ||
        '';
      
      // Get content with multiple selectors for different site structures
      let articleContent = '';
      
      // Try article tag first
      const articleElement = document.querySelector('article');
      if (articleElement) {
        const paragraphs = Array.from(articleElement.querySelectorAll('p')).map(p => p.innerText);
        articleContent = paragraphs.join(' ');
      }
      
      // Fallback to common content selectors
      if (!articleContent || articleContent.length < 100) {
        const contentSelectors = [
          '.entry-content p',
          '.post-content p',
          '.article-content p',
          '.content p',
          '.story-body p',
          'main p',
          'p'
        ];
        
        for (const selector of contentSelectors) {
          const paragraphs = Array.from(document.querySelectorAll(selector))
            .map(p => p.innerText)
            .filter(text => text.length > 20); // Filter out short paragraphs
          
          if (paragraphs.length > 0) {
            articleContent = paragraphs.join(' ');
            break;
          }
        }
      }
      
      // Get publication name with multiple fallbacks
      const publication = 
        document.querySelector('meta[property="og:site_name"]')?.getAttribute('content') ||
        document.querySelector('meta[name="site_name"]')?.getAttribute('content') ||
        document.querySelector('.site-name')?.innerText ||
        new URL(window.location.href).hostname;
      
      return {
        title: title.trim(),
        content: articleContent.trim(),
        publication: publication.trim()
      };
    });
    
    // Validate that we got meaningful content
    if (!content.title || !content.content || content.content.length < 50) {
      console.log('Insufficient content extracted:', { 
        titleLength: content.title?.length || 0, 
        contentLength: content.content?.length || 0 
      });
      throw new Error('Insufficient content extracted from page');
    }
    
    console.log(`Successfully extracted content: ${content.title.substring(0, 50)}...`);
    return JSON.stringify(content);
    
  } catch (error) {
    console.error('Error scraping article:', error.message);
    throw new Error(`Failed to scrape article content: ${error.message}`);
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
      1. Title (The headline of the article)
      2. Threat Name (what is the main threat discussed in the article)
      3. Vulnerability ID (if mentioned, otherwise "Unspecified")
      4. Summary (a 2-3 sentence summary of the main points)
      5. Impacts (what are the potential impacts of this threat, 1-2 sentences)
      6. Attack Vector (how the attack is performed, 1 sentence)
      7. Target OS (identify all operating systems mentioned or affected, including Windows, macOS, Linux, Android, iOS; list ALL operating systems mentioned, or state "Multiple operating systems" or "OS-independent" if none specifically mentioned)
      
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
        microsoftConnection: "Not applicable",
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: parsedResult["Target OS"] || "Unspecified"
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
        microsoftConnection: "Not applicable",
        sourcePublication: content.publication || new URL(url).hostname,
        targetOS: "Unspecified"
      };
    }
  } catch (error) {
    console.error('Error generating article summary:', error);
    throw error;
  }
}