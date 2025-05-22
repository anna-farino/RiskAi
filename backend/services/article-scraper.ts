import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import { db } from '../db/db';
import { scrapedArticles } from '../../shared/db/schema/news-scraper';
import { InsertScrapedArticle } from '../../shared/db/schema/news-scraper';
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
      // Try to find the main article content using common selectors
      const articleSelectors = [
        'article', 
        '.article-content', 
        '.post-content', 
        '.entry-content',
        'main',
        '#content'
      ];
      
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
  
  return {
    title: extractField(aiResponse, 'Title') || 'Untitled Article',
    threatName: extractField(aiResponse, 'Threat Name') || extractField(aiResponse, 'Threat Name\\(s\\)') || 'Unknown',
    summary: extractField(aiResponse, 'Summary') || 'No summary available',
    impacts: extractField(aiResponse, 'Impacts') || 'No impact information available',
    osConnection: extractField(aiResponse, 'OS Connection') || 'Not specified',
    source: sourceName,
    originalUrl: url
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
  try {
    const result = await db.insert(scrapedArticles).values(article).returning();
    return result[0];
  } catch (error) {
    console.error('Error saving article:', error);
    throw error;
  }
}

/**
 * Get all articles for a user
 */
export async function getArticles(userId: string): Promise<any[]> {
  try {
    const articles = await db.select().from(scrapedArticles)
      .where(eq(scrapedArticles.userId, userId))
      .orderBy(scrapedArticles.createdAt);
    return articles;
  } catch (error) {
    console.error('Error fetching articles:', error);
    throw error;
  }
}

/**
 * Get a single article by ID
 */
export async function getArticleById(id: string): Promise<any | null> {
  try {
    const articles = await db.select().from(scrapedArticles)
      .where(eq(scrapedArticles.id, id));
    
    if (articles.length === 0) {
      return null;
    }
    
    return articles[0];
  } catch (error) {
    console.error('Error fetching article by ID:', error);
    throw error;
  }
}

/**
 * Process and store an article from URL
 */
export async function processAndStoreArticle(url: string, userId: string): Promise<any> {
  try {
    // Step 1: Scrape the article content
    const content = await scrapeArticle(url);
    
    // Step 2: Process with OpenAI to extract information
    const processedArticle = await processArticleWithAI(url, content);
    
    // Step 3: Save to the database with user ID
    const articleWithUserId = {
      ...processedArticle,
      userId
    };
    
    const savedArticle = await saveArticle(articleWithUserId);
    return savedArticle;
  } catch (error) {
    console.error('Error processing and storing article:', error);
    throw error;
  }
}