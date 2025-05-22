import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import { db } from '../db/db';
import { scrapedArticles, InsertScrapedArticle } from '../../shared/db/schema/news-scraper';
import { eq } from 'drizzle-orm';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Scrape content from a URL using Puppeteer
 */
export async function scrapeArticle(url: string): Promise<string> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    
    // Extract article content
    const content = await page.evaluate(() => {
      const articleSelectors = [
        'article', 
        '.article-content', 
        '.post-content', 
        '.entry-content',
        'main',
        '#content'
      ];
      
      // Try to find the main article content
      for (const selector of articleSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          return element.textContent || '';
        }
      }
      
      // If no specific selector matches, get the body content
      return document.body.textContent || '';
    });
    
    return content.trim();
  } finally {
    await browser.close();
  }
}

/**
 * Process article content with OpenAI to extract structured information
 */
export async function processArticleWithAI(url: string, content: string): Promise<InsertScrapedArticle> {
  // Extract domain for source
  const domain = new URL(url).hostname.replace('www.', '');
  const sourceName = formatSourceName(domain);
  
  // Create prompt for OpenAI
  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [
      {
        role: "system",
        content: `You are an expert at summarizing cybersecurity articles. Extract the following information in this exact format:
        
Title: [based on the article's actual title]
Threat Name(s): [identifying the vulnerability or exploit mentioned]
Summary: [maximum 80 words]
Impacts: [business and technical impacts]
OS Connection: [which operating systems are affected]
Source: [${sourceName}]

Be factual and concise. Only include information that's explicitly mentioned in the article.`
      },
      {
        role: "user",
        content: `Here's the article content from ${url}:\n\n${content}`
      }
    ],
    temperature: 0.3,
    max_tokens: 1000,
  });
  
  const aiResponse = completion.choices[0]?.message?.content || '';
  
  // Parse the AI response
  const extractField = (text: string, field: string): string => {
    const regex = new RegExp(`${field}:\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, 'i');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  
  // Extracting all required fields
  const title = extractField(aiResponse, 'Title') || 'Untitled Article';
  const threatName = extractField(aiResponse, 'Threat Name') || extractField(aiResponse, 'Threat Name\\(s\\)') || 'Unknown';
  const summary = extractField(aiResponse, 'Summary') || 'No summary available';
  const impacts = extractField(aiResponse, 'Impacts') || 'No impact information available';
  const osConnection = extractField(aiResponse, 'OS Connection') || 'Not specified';
  
  // Return complete object with all required fields
  return {
    title,
    threatName,
    summary,
    impacts,
    osConnection,
    source: sourceName,
    originalUrl: url,
    userId: '' // This will be set by the caller
  };
}

/**
 * Format source name from domain
 */
function formatSourceName(domain: string): string {
  // Map of common cybersecurity domains to their proper names
  const sourceNameMap: Record<string, string> = {
    'thehackernews.com': 'The Hacker News',
    'krebsonsecurity.com': 'Krebs on Security',
    'bleepingcomputer.com': 'Bleeping Computer',
    'zdnet.com': 'ZDNet',
    'darkreading.com': 'Dark Reading',
    'securityweek.com': 'Security Week',
    'threatpost.com': 'Threatpost',
    'theregister.com': 'The Register',
    'wired.com': 'Wired',
    'securitymagazine.com': 'Security Magazine',
    'scmagazine.com': 'SC Magazine',
    'infosecurity-magazine.com': 'Infosecurity Magazine',
    'cybersecuritynews.com': 'Cybersecurity News',
  };
  
  // Return mapped name if available, otherwise format the domain
  if (sourceNameMap[domain]) {
    return sourceNameMap[domain];
  }
  
  // Format domain name by capitalizing words and removing .com, .net, etc.
  return domain
    .split('.')
    .slice(0, -1)
    .join(' ')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Save an article to the database
 */
export async function saveArticle(article: InsertScrapedArticle): Promise<any> {
  return db.insert(scrapedArticles).values([article]).returning();
}

/**
 * Get all articles for a user
 */
export async function getArticles(userId: string): Promise<any[]> {
  return db.select().from(scrapedArticles).where(eq(scrapedArticles.userId, userId));
}

/**
 * Get a single article by ID
 */
export async function getArticleById(id: string): Promise<any | null> {
  const articles = await db.select().from(scrapedArticles).where(eq(scrapedArticles.id, id));
  return articles.length > 0 ? articles[0] : null;
}

/**
 * Process and store an article from URL
 */
export async function processAndStoreArticle(url: string, userId: string): Promise<any> {
  try {
    // Scrape the article content
    const content = await scrapeArticle(url);
    
    // Process with OpenAI
    const processedArticle = await processArticleWithAI(url, content);
    
    // Add user ID
    const articleWithUser = {
      ...processedArticle,
      userId
    };
    
    // Save to database
    const savedArticle = await saveArticle(articleWithUser);
    return savedArticle[0];
  } catch (error) {
    console.error('Error processing article:', error);
    throw error;
  }
}