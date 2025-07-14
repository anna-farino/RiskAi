import { log } from "backend/utils/log";
import { ArticleContent } from './selector-utilities';
import { cleanAndNormalizeContent } from './content-cleaner';

/**
 * Handle pre-processed content from Puppeteer scraper
 * Detects and parses structured content format
 */
export function handlePreProcessedContent(html: string): ArticleContent | null {
  // Check if this is already processed content from Puppeteer scraper
  if (html.includes('Title:') && html.includes('Author:') && html.includes('Content:')) {
    log(`[ContentExtractor] Detected pre-processed content from Puppeteer, parsing directly`, "scraper");
    
    const lines = html.split('\n');
    let title = '';
    let author = '';
    let content = '';
    let currentSection = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Title:')) {
        title = trimmedLine.replace('Title:', '').trim();
        currentSection = 'title';
      } else if (trimmedLine.startsWith('Author:')) {
        author = trimmedLine.replace('Author:', '').trim();
        currentSection = 'author';
      } else if (trimmedLine.startsWith('Date:')) {
        currentSection = 'date';
      } else if (trimmedLine.startsWith('Content:')) {
        content = trimmedLine.replace('Content:', '').trim();
        currentSection = 'content';
      } else if (currentSection === 'content' && trimmedLine) {
        content += ' ' + trimmedLine;
      }
    }
    
    // Clean up extracted values
    title = title === '(No title found)' ? '' : title;
    author = author === '(No author found)' ? undefined : author;
    content = content === '(No content found)' ? '' : content;
    
    log(`[ContentExtractor] Parsed pre-processed content - Title: ${title.length} chars, Content: ${content.length} chars`, "scraper");
    
    return {
      title: cleanAndNormalizeContent(title),
      content: cleanAndNormalizeContent(content),
      author,
      publishDate: null, // Will be extracted separately if needed
      extractionMethod: "pre_processed",
      confidence: 0.9
    };
  }
  
  return null;
}