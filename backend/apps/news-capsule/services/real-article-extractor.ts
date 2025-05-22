import * as cheerio from 'cheerio';
import { log } from '../../../utils/log';

/**
 * Extracts real article data from cybersecurity news websites
 */
export async function extractRealArticleData(url: string) {
  try {
    log(`Fetching data from: ${url}`, 'article-extractor');
    
    // Make an actual HTTP request to get the article
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
    }
    
    const html = await response.text();
    const $ = cheerio.load(html);
    
    // Extract the headline - prioritize meta tags for reliability
    let headline = $('meta[property="og:title"]').attr('content') || 
                  $('meta[name="twitter:title"]').attr('content');
    
    // If no meta tags, try specific heading elements
    if (!headline) {
      headline = $('h1.entry-title').text().trim() || 
                $('h1.post-title').text().trim() ||
                $('h1.article-title').text().trim() ||
                $('.entry-title').text().trim() ||
                $('.title').text().trim();
    }
    
    // If still no headline, try the first h1
    if (!headline) {
      // Avoid getting h1 elements from navigation or sidebars
      const contentArea = $('article, .content, .entry-content, .post-content, main');
      if (contentArea.length > 0) {
        headline = contentArea.find('h1').first().text().trim();
      } else {
        headline = $('h1').first().text().trim();
      }
    }
    
    // If still nothing, use the page title (but clean it up)
    if (!headline) {
      headline = $('title').text().replace(/\\s*[-–|]\\s*.+$/, '').trim();
    }
    
    // Extract article content
    let content = '';
    
    // Look for common content containers
    const contentSelectors = [
      'article', '.article-content', '.post-content', '.entry-content', 
      '.content', '#content', '.story-body', '.story-content'
    ];
    
    // Try finding content using common selectors
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        // Extract paragraphs from the content container
        const paragraphs = element.find('p').map((_, el) => $(el).text().trim()).get();
        content = paragraphs.join(' ');
        break;
      }
    }
    
    // If no content found via containers, try direct paragraph extraction
    if (!content) {
      const paragraphs = $('p').map((_, el) => $(el).text().trim()).get();
      content = paragraphs.join(' ');
    }
    
    // Clean up the content
    content = content.replace(/\\s+/g, ' ').trim();
    
    // Determine threat name by looking for specific patterns
    const threatPatterns = [
      /([A-Z][a-zA-Z0-9_-]+ (malware|ransomware|trojan|worm|exploit|vulnerability|campaign))/i,
      /(CVE-\\d{4}-\\d{4,})/i,
      /([A-Z][a-zA-Z0-9]+ (attack|breach|hack|threat))/i,
      /(Zero-day)/i
    ];
    
    let threatName = '';
    for (const pattern of threatPatterns) {
      const match = content.match(pattern);
      if (match && match[0]) {
        threatName = match[0];
        break;
      }
    }
    
    // If no specific threat name found, determine type from content
    if (!threatName) {
      if (content.toLowerCase().includes('malware')) {
        threatName = "Malware Campaign";
      } else if (content.toLowerCase().includes('ransomware')) {
        threatName = "Ransomware Attack";
      } else if (content.toLowerCase().includes('phishing')) {
        threatName = "Phishing Campaign";
      } else if (content.toLowerCase().includes('vulnerability') || content.toLowerCase().includes('exploit')) {
        threatName = "Security Vulnerability";
      } else if (content.toLowerCase().includes('breach') || content.toLowerCase().includes('leak')) {
        threatName = "Data Breach";
      } else {
        threatName = "Cybersecurity Threat";
      }
    }
    
    // Generate a summary of the content (max 80 words)
    const words = content.split(/\\s+/);
    const summary = words.slice(0, 80).join(' ');
    
    // Identify affected systems/OS
    const osPatterns = {
      'Windows': /Windows|Microsoft|Win10|Win11/i,
      'Linux': /Linux|Ubuntu|Debian|Red Hat|CentOS/i,
      'macOS': /macOS|Mac OS|Apple|OSX/i,
      'Android': /Android|Google Play/i,
      'iOS': /iOS|iPhone|iPad|Apple/i
    };
    
    const affectedOS = [];
    for (const [os, pattern] of Object.entries(osPatterns)) {
      if (pattern.test(content)) {
        affectedOS.push(os);
      }
    }
    
    const targetOS = affectedOS.length > 0 ? affectedOS.join(', ') : 'Multiple operating systems';
    
    // Identify business impacts
    const businessImpactKeywords = [
      { keyword: 'data theft', impact: 'data theft' },
      { keyword: 'financial', impact: 'financial loss' },
      { keyword: 'ransom', impact: 'ransom payments' },
      { keyword: 'compliance', impact: 'compliance violations' },
      { keyword: 'reputation', impact: 'reputational damage' },
      { keyword: 'downtime', impact: 'service disruption' },
      { keyword: 'regulatory', impact: 'regulatory consequences' }
    ];
    
    const businessImpacts = [];
    for (const { keyword, impact } of businessImpactKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        businessImpacts.push(impact);
      }
    }
    
    // Identify technical impacts
    const technicalImpactKeywords = [
      { keyword: 'remote code', impact: 'remote code execution' },
      { keyword: 'privilege', impact: 'privilege escalation' },
      { keyword: 'data breach', impact: 'data exposure' },
      { keyword: 'authentication', impact: 'authentication bypass' },
      { keyword: 'lateral movement', impact: 'lateral movement' },
      { keyword: 'credential', impact: 'credential theft' },
      { keyword: 'access control', impact: 'unauthorized access' }
    ];
    
    const technicalImpacts = [];
    for (const { keyword, impact } of technicalImpactKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        technicalImpacts.push(impact);
      }
    }
    
    // Combine impacts
    let impacts = '';
    
    if (businessImpacts.length > 0) {
      impacts += `Business impacts include ${businessImpacts.join(', ')}. `;
    }
    
    if (technicalImpacts.length > 0) {
      impacts += `Technical impacts include ${technicalImpacts.join(', ')}.`;
    }
    
    if (!impacts) {
      impacts = 'Potential security impacts for affected systems and organizations.';
    }
    
    // Get source publication from hostname
    const hostname = new URL(url).hostname.replace('www.', '');
    const sourceName = hostname.split('.')[0];
    const sourcePublication = sourceName.charAt(0).toUpperCase() + sourceName.slice(1);
    
    return {
      title: headline,
      threatName,
      summary,
      impacts,
      targetOS,
      sourcePublication,
      originalUrl: url,
    };
  } catch (error) {
    log(`Error extracting article data: ${error}`, 'article-extractor');
    
    // Handle extraction errors
    const hostname = new URL(url).hostname.replace('www.', '');
    const sourceName = hostname.split('.')[0];
    
    return {
      title: `Security Article from ${sourceName}`,
      threatName: "Security Vulnerability",
      summary: `This article contains cybersecurity information that could not be automatically extracted. Please visit the original source for details.`,
      impacts: "Potential security impacts for affected systems and organizations.",
      targetOS: "Multiple operating systems",
      sourcePublication: sourceName.charAt(0).toUpperCase() + sourceName.slice(1),
      originalUrl: url
    };
  }
}