import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// URL of a cybersecurity article to test
const TEST_URL = 'https://thehackernews.com/2023/03/new-stealth-backdoor-malware-targeting.html';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function scrapeArticle(url) {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    console.log(`Navigating to ${url}...`);
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

async function processArticleWithAI(url, content) {
  // Extract domain for source
  const domain = new URL(url).hostname.replace('www.', '');
  const sourceName = formatSourceName(domain);
  
  console.log('Processing with OpenAI...');
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
  console.log('OpenAI processing complete!');
  
  // Parse the AI response
  const extractField = (text, field) => {
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

// Format source name from domain
function formatSourceName(domain) {
  // Map of common cybersecurity domains to their proper names
  const sourceNameMap = {
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

async function testNewsScraper() {
  try {
    console.log(`Testing news scraper with URL: ${TEST_URL}`);
    
    // Step 1: Scrape the article content
    console.log('Scraping article content...');
    const content = await scrapeArticle(TEST_URL);
    console.log(`Successfully scraped ${content.length} characters of content`);
    
    // Step 2: Process with OpenAI to extract information
    console.log('Processing article with OpenAI...');
    const processedArticle = await processArticleWithAI(TEST_URL, content);
    
    // Step 3: Display the processed article
    console.log('\nProcessed Article Summary:');
    console.log('==========================');
    console.log(`Title: ${processedArticle.title}`);
    console.log(`Threat Name: ${processedArticle.threatName}`);
    console.log(`Summary: ${processedArticle.summary}`);
    console.log(`Impacts: ${processedArticle.impacts}`);
    console.log(`OS Connection: ${processedArticle.osConnection}`);
    console.log(`Source: ${processedArticle.source}`);
    console.log(`Original URL: ${processedArticle.originalUrl}`);
    console.log('==========================');
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testNewsScraper();