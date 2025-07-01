/**
 * Test the fixed extraction to verify it now finds links correctly
 */

import puppeteer from 'puppeteer';

async function testFixedExtraction() {
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
    console.log('Testing fixed extraction logic...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Apply the same logic as the fixed extractor
    const extractionResult = await page.evaluate(() => {
      // Get both <a> tags and potentially clickable elements that might be articles
      const allElements = Array.from(document.querySelectorAll('a, div[onclick], div[data-url], span[onclick], [data-href]'));
      
      const extracted = allElements.map(element => {
        // Try multiple ways to get the URL
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
        const context = element.parentElement?.textContent?.trim() || '';
        const parentClass = element.parentElement?.className || '';
        
        // Get more comprehensive context
        const fullContext = element.closest('article, .post, .item, .entry, .content, .card, .tdi_65')?.textContent?.trim() || context;
        
        return {
          href,
          text,
          context: fullContext.substring(0, 200),
          parentClass
        };
      }).filter(link => {
        const href = link.href;
        const text = link.text;
        
        // Keep links with meaningful text, even if href is empty initially
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
        totalElements: allElements.length,
        extractedCount: extracted.length,
        sampleExtracted: extracted.slice(0, 10).map(link => ({
          href: link.href,
          text: link.text,
          hasHref: !!link.href
        })),
        withHref: extracted.filter(link => link.href).length,
        withoutHref: extracted.filter(link => !link.href).length
      };
    });
    
    console.log('\nFixed Extraction Results:');
    console.log(`Total elements checked: ${extractionResult.totalElements}`);
    console.log(`Links extracted: ${extractionResult.extractedCount}`);
    console.log(`With href: ${extractionResult.withHref}`);
    console.log(`Without href: ${extractionResult.withoutHref}`);
    
    console.log('\nSample extracted links:');
    extractionResult.sampleExtracted.forEach((link, i) => {
      console.log(`${i+1}. ${link.hasHref ? 'URL' : 'NO-URL'}: "${link.text}" -> ${link.href || 'empty'}`);
    });
    
    if (extractionResult.extractedCount >= 15) {
      console.log('\nSUCCESS: Extracting 15+ links as required!');
    } else if (extractionResult.extractedCount >= 10) {
      console.log('\nPARTIAL SUCCESS: Extracting 10+ links (improvement but could be better)');
    } else {
      console.log('\nISSUE: Still extracting fewer than 10 links');
    }
    
    // Specifically look for article-like content
    const articleAnalysis = await page.evaluate(() => {
      const articleLikeElements = Array.from(document.querySelectorAll('*')).filter(el => {
        const text = el.textContent?.trim() || '';
        return text.length > 20 && text.split(' ').length >= 4 && 
               (text.includes('cyber') || text.includes('security') || text.includes('hack') || 
                text.includes('attack') || text.includes('data') || text.includes('threat'));
      });
      
      return {
        count: articleLikeElements.length,
        samples: articleLikeElements.slice(0, 5).map(el => ({
          tag: el.tagName,
          text: el.textContent?.trim().substring(0, 80),
          hasLink: !!el.querySelector('a'),
          hasHref: !!el.querySelector('a[href]')
        }))
      };
    });
    
    console.log(`\nArticle-like content found: ${articleAnalysis.count} elements`);
    console.log('Sample article content:');
    articleAnalysis.samples.forEach((item, i) => {
      console.log(`${i+1}. ${item.tag}: "${item.text}" (link: ${item.hasLink}, href: ${item.hasHref})`);
    });
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testFixedExtraction().catch(console.error);