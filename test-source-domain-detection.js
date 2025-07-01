/**
 * Test script to verify source domain detection for aggregated content
 */

import puppeteer from 'puppeteer';

async function testSourceDomainDetection() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-blink-features=AutomationControlled'
    ]
  });

  const page = await browser.newPage();
  
  try {
    console.log('Testing source domain detection on Foorilla...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Apply the enhanced extraction logic with source domain detection
    const extractionResult = await page.evaluate(() => {
      const allElements = Array.from(document.querySelectorAll('a, div[onclick], div[data-url], span[onclick], [data-href]'));
      
      const extracted = allElements.map(element => {
        let href = element.getAttribute('href') || 
                  element.getAttribute('data-url') || 
                  element.getAttribute('data-href') || '';
        
        // For onclick elements, try to extract URL from onclick
        if (!href && element.getAttribute('onclick')) {
          const onclick = element.getAttribute('onclick');
          const urlMatch = onclick.match(/['"]([^'"]*\/[^'"]*)['"]/);
          if (urlMatch) href = urlMatch[1];
        }
        
        const text = element.textContent?.trim() || '';
        
        // For elements without href, try to construct URL from context
        if (!href && text && text.length > 10) {
          // Look for parent containers that might have URL information
          const parent = element.closest('[data-url], [data-link], [data-post-id]');
          if (parent) {
            href = parent.getAttribute('data-url') || 
                  parent.getAttribute('data-link') || 
                  (parent.getAttribute('data-post-id') ? `/post/${parent.getAttribute('data-post-id')}` : '');
          }
          
          // If still no href and this looks like an article title, construct a URL
          if (!href && text.split(' ').length >= 4) {
            // Generate a slug from the title for URL construction
            const slug = text.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, '-')
              .substring(0, 50);
            
            // Try to detect source domain from context first
            const articleContainer = element.closest('article, .post, .item, .entry, .content, .card, .tdi_65');
            let tempSourceDomain = '';
            if (articleContainer) {
              const sourceElement = articleContainer.querySelector('.text-end small') || 
                                   articleContainer.querySelector('.source') ||
                                   articleContainer.querySelector('[class*="source"]') ||
                                   articleContainer.querySelector('small:last-child');
              if (sourceElement) {
                const sourceText = sourceElement.textContent?.trim() || '';
                const domainMatch = sourceText.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
                if (domainMatch) {
                  tempSourceDomain = domainMatch[1];
                }
              }
            }
            
            // Construct URL with source domain if available
            if (tempSourceDomain) {
              href = `https://${tempSourceDomain}/${slug}`;
            } else {
              href = `/article/${slug}`;
            }
          }
        }
        
        const context = element.parentElement?.textContent?.trim() || '';
        const parentClass = element.parentElement?.className || '';
        
        // Get more comprehensive context
        const fullContext = element.closest('article, .post, .item, .entry, .content, .card, .tdi_65')?.textContent?.trim() || context;
        
        // Extract source domain for aggregated content
        let sourceDomain = '';
        const articleContainer = element.closest('article, .post, .item, .entry, .content, .card, .tdi_65');
        if (articleContainer) {
          // Look for source domain in various common patterns
          const sourceElement = articleContainer.querySelector('.text-end small') || 
                               articleContainer.querySelector('.source') ||
                               articleContainer.querySelector('.domain') ||
                               articleContainer.querySelector('[class*="source"]') ||
                               articleContainer.querySelector('small:last-child') ||
                               articleContainer.querySelector('.attribution');
          
          if (sourceElement) {
            const sourceText = sourceElement.textContent?.trim() || '';
            // Extract domain from text (look for domain patterns)
            const domainMatch = sourceText.match(/([a-zA-Z0-9-]+\.[a-zA-Z]{2,})/);
            if (domainMatch) {
              sourceDomain = domainMatch[1];
            }
          }
          
          // If no source found yet, look for other indicators
          if (!sourceDomain) {
            const contextText = articleContainer.textContent || '';
            // Look for domain patterns in the full context
            const domains = contextText.match(/\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b/g);
            if (domains) {
              // Filter out common non-source domains
              const filteredDomains = domains.filter(d => 
                !d.includes('foorilla') && 
                !d.includes('google') && 
                !d.includes('facebook') && 
                !d.includes('twitter') &&
                d.length > 5
              );
              if (filteredDomains.length > 0) {
                sourceDomain = filteredDomains[0];
              }
            }
          }
        }
        
        return {
          href,
          text,
          context: fullContext.substring(0, 200),
          parentClass,
          sourceDomain: sourceDomain || ''
        };
      }).filter(link => {
        const text = link.text;
        
        // Keep links with meaningful text
        if (!text || text.length < 3) return false;
        
        // Skip navigation and utility links
        const textLower = text.toLowerCase();
        if (textLower.includes('login') || textLower.includes('register') || 
            textLower.includes('contact') || textLower.includes('about') ||
            textLower.includes('privacy') || textLower.includes('terms') ||
            textLower.includes('menu')) {
          return false;
        }
        
        // Skip very short navigation text
        if (text.length < 3 || ['top', 'new', 'old', 'all'].includes(textLower)) {
          return false;
        }
        
        return true;
      });
      
      return {
        extractedCount: extracted.length,
        withSourceDomain: extracted.filter(link => link.sourceDomain).length,
        sampleWithDomains: extracted.filter(link => link.sourceDomain).slice(0, 10).map(link => ({
          text: link.text,
          href: link.href,
          sourceDomain: link.sourceDomain
        })),
        allSources: [...new Set(extracted.filter(link => link.sourceDomain).map(link => link.sourceDomain))]
      };
    });
    
    console.log('\nSource Domain Detection Results:');
    console.log(`Total links extracted: ${extractionResult.extractedCount}`);
    console.log(`Links with detected source domains: ${extractionResult.withSourceDomain}`);
    console.log(`Unique source domains found: ${extractionResult.allSources.length}`);
    
    console.log('\nDetected source domains:');
    extractionResult.allSources.forEach((domain, i) => {
      console.log(`${i+1}. ${domain}`);
    });
    
    console.log('\nSample articles with source domains:');
    extractionResult.sampleWithDomains.forEach((link, i) => {
      console.log(`${i+1}. Source: ${link.sourceDomain}`);
      console.log(`   Title: "${link.text}"`);
      console.log(`   URL: ${link.href}`);
      console.log('');
    });
    
    if (extractionResult.withSourceDomain >= 5) {
      console.log('SUCCESS: Source domain detection working correctly!');
    } else {
      console.log('ISSUE: Limited source domain detection');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testSourceDomainDetection().catch(console.error);