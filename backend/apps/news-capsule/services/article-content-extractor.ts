import * as cheerio from 'cheerio';
import { log } from '../../../utils/log';

/**
 * Extracts information from an article URL
 */
export async function extractArticleContent(url: string) {
  try {
    log(`Fetching article content from: ${url}`, 'article-content-extractor');
    
    // Fetch the HTML content
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
    
    // Extract headline
    let headline = $('h1.headline').text().trim() || 
                  $('h1.title').text().trim() || 
                  $('.article-title').text().trim() ||
                  $('.headline').text().trim() ||
                  $('.entry-title').text().trim() ||
                  $('.post-title').text().trim();
    
    // If no specialized elements found, try the first h1
    if (!headline) {
      headline = $('h1').first().text().trim();
    }
    
    // If still no headline, try meta tags
    if (!headline) {
      headline = $('meta[property="og:title"]').attr('content') || 
                $('meta[name="twitter:title"]').attr('content') ||
                $('title').text();
    }
    
    // Extract article content
    // Look for common content containers
    let contentSelectors = [
      'article', '.article-content', '.post-content', '.entry-content', 
      '.content', '#content', '.story-body', '.story-content'
    ];
    
    let content = '';
    for (const selector of contentSelectors) {
      const element = $(selector);
      if (element.length > 0) {
        content = element.text().trim();
        break;
      }
    }
    
    // If no content found, try paragraphs
    if (!content) {
      content = $('p').map((_, el) => $(el).text().trim()).get().join(' ');
    }
    
    // Clean up the content
    content = content.replace(/\\s+/g, ' ').trim();
    
    // Determine threat name
    const threatNameKeywords = [
      'malware', 'ransomware', 'vulnerability', 'exploit', 'trojan', 
      'backdoor', 'phishing', 'zero-day', 'breach', 'attack', 'CVE', 'hack'
    ];
    
    let threatName = "Unknown Threat";
    
    // Try to find threat name in headline or content
    for (const keyword of threatNameKeywords) {
      const regex = new RegExp(keyword + '[\\w\\s\\-]+(threat|vulnerability|attack|malware|campaign|exploit)', 'i');
      const match = (headline + ' ' + content).match(regex);
      if (match) {
        threatName = match[0].trim();
        // Capitalize first letter of each word
        threatName = threatName.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        break;
      }
    }
    
    // If no specific threat name found, try to detect the type
    if (threatName === "Unknown Threat") {
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
      }
    }
    
    // Generate a summary (max 80 words)
    const sentences = content.replace(/([.!?])\\s+/g, "$1|").split("|");
    let summary = '';
    let wordCount = 0;
    
    for (const sentence of sentences) {
      const sentenceWords = sentence.trim().split(/\\s+/).length;
      if (wordCount + sentenceWords <= 80) {
        summary += sentence.trim() + ' ';
        wordCount += sentenceWords;
      } else {
        break;
      }
    }
    
    summary = summary.trim();
    
    // Determine OS impact
    const osKeywords = {
      'windows': ['windows', 'microsoft', 'win10', 'win11'],
      'linux': ['linux', 'ubuntu', 'debian', 'redhat', 'centos', 'fedora'],
      'macos': ['macos', 'mac os', 'apple', 'osx', 'macbook'],
      'android': ['android', 'google play'],
      'ios': ['ios', 'iphone', 'ipad']
    };
    
    let affectedOS: string[] = [];
    
    for (const [os, keywords] of Object.entries(osKeywords)) {
      for (const keyword of keywords) {
        if (content.toLowerCase().includes(keyword)) {
          if (os === 'windows') affectedOS.push('Windows');
          else if (os === 'linux') affectedOS.push('Linux');
          else if (os === 'macos') affectedOS.push('macOS');
          else if (os === 'android') affectedOS.push('Android');
          else if (os === 'ios') affectedOS.push('iOS');
          break;
        }
      }
    }
    
    const targetOS = affectedOS.length > 0 ? affectedOS.join(', ') : 'Multiple operating systems';
    
    // Determine impact
    let impacts = "Potential security risks for affected systems.";
    
    // Business impacts
    const businessImpactKeywords = [
      'data theft', 'financial', 'ransom', 'compliance', 'reputation', 
      'downtime', 'business', 'customer', 'regulatory', 'legal'
    ];
    
    let businessImpacts: string[] = [];
    for (const keyword of businessImpactKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        if (keyword === 'data theft') businessImpacts.push('data theft');
        else if (keyword === 'financial') businessImpacts.push('financial loss');
        else if (keyword === 'ransom') businessImpacts.push('ransom payments');
        else if (keyword === 'compliance') businessImpacts.push('compliance violations');
        else if (keyword === 'reputation') businessImpacts.push('reputational damage');
        else if (keyword === 'downtime') businessImpacts.push('service disruption');
        else if (keyword === 'regulatory' || keyword === 'legal') businessImpacts.push('legal consequences');
      }
    }
    
    // Technical impacts
    const technicalImpactKeywords = [
      'remote code', 'privilege', 'data breach', 'authentication', 'lateral movement',
      'credential', 'access control', 'integrity', 'availability'
    ];
    
    let technicalImpacts: string[] = [];
    for (const keyword of technicalImpactKeywords) {
      if (content.toLowerCase().includes(keyword)) {
        if (keyword === 'remote code') technicalImpacts.push('remote code execution');
        else if (keyword === 'privilege') technicalImpacts.push('privilege escalation');
        else if (keyword === 'data breach') technicalImpacts.push('data exposure');
        else if (keyword === 'authentication') technicalImpacts.push('authentication bypass');
        else if (keyword === 'lateral movement') technicalImpacts.push('lateral movement');
        else if (keyword === 'credential') technicalImpacts.push('credential theft');
        else if (keyword === 'access control') technicalImpacts.push('unauthorized access');
        else if (keyword === 'integrity') technicalImpacts.push('data integrity issues');
        else if (keyword === 'availability') technicalImpacts.push('service availability impact');
      }
    }
    
    if (businessImpacts.length > 0 || technicalImpacts.length > 0) {
      impacts = '';
      if (businessImpacts.length > 0) {
        impacts += `Business impacts include ${businessImpacts.join(', ')}. `;
      }
      if (technicalImpacts.length > 0) {
        impacts += `Technical impacts include ${technicalImpacts.join(', ')}.`;
      }
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
    log(`Error extracting article content: ${error}`, 'article-content-extractor');
    throw error;
  }
}