/**
 * Debug script to analyze Foorilla page structure and find source domains
 */

import puppeteer from 'puppeteer';

async function debugFoorillaStructure() {
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
    console.log('Analyzing Foorilla page structure...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Find the article that contains "North Korea's covert coders caught"
    const articleAnalysis = await page.evaluate(() => {
      const targetText = "North Korea's covert coders caught";
      const allElements = Array.from(document.querySelectorAll('*'));
      
      // Find elements containing the target text
      const matchingElements = allElements.filter(el => 
        el.textContent && el.textContent.includes(targetText)
      );
      
      if (matchingElements.length === 0) {
        return { error: 'Target article not found' };
      }
      
      // Analyze the first matching element
      const targetElement = matchingElements[0];
      
      // Find the closest article container
      const articleContainer = targetElement.closest('article, .post, .item, .entry, .content, .card, div[class*="tdi"]');
      
      if (!articleContainer) {
        return { error: 'No article container found' };
      }
      
      // Get the full HTML structure of the article container
      const articleHTML = articleContainer.outerHTML;
      
      // Look for all small elements in the container
      const smallElements = Array.from(articleContainer.querySelectorAll('small'));
      const smallTexts = smallElements.map(el => ({
        text: el.textContent?.trim(),
        className: el.className,
        parentClassName: el.parentElement?.className
      }));
      
      // Look for elements with 'text-end' class
      const textEndElements = Array.from(articleContainer.querySelectorAll('.text-end'));
      const textEndTexts = textEndElements.map(el => ({
        text: el.textContent?.trim(),
        innerHTML: el.innerHTML,
        className: el.className
      }));
      
      // Look for any elements containing domain patterns
      const domainElements = allElements.filter(el => {
        const text = el.textContent?.trim() || '';
        return text.match(/\b[a-zA-Z0-9-]+\.[a-zA-Z]{2,}\b/) && 
               articleContainer.contains(el);
      });
      
      const domainTexts = domainElements.map(el => ({
        text: el.textContent?.trim(),
        tagName: el.tagName,
        className: el.className,
        parentClassName: el.parentElement?.className
      }));
      
      return {
        containerClass: articleContainer.className,
        containerTag: articleContainer.tagName,
        smallElements: smallTexts,
        textEndElements: textEndTexts,
        domainElements: domainTexts,
        articleStructure: articleHTML.substring(0, 1000) // First 1000 chars
      };
    });
    
    if (articleAnalysis.error) {
      console.log('Error:', articleAnalysis.error);
      return;
    }
    
    console.log('\nArticle Container Analysis:');
    console.log(`Container: ${articleAnalysis.containerTag}.${articleAnalysis.containerClass}`);
    
    console.log('\nSmall elements found:');
    articleAnalysis.smallElements.forEach((el, i) => {
      console.log(`${i+1}. Text: "${el.text}"`);
      console.log(`   Class: ${el.className}`);
      console.log(`   Parent Class: ${el.parentClassName}`);
      console.log('');
    });
    
    console.log('\nText-end elements found:');
    articleAnalysis.textEndElements.forEach((el, i) => {
      console.log(`${i+1}. Text: "${el.text}"`);
      console.log(`   HTML: ${el.innerHTML}`);
      console.log(`   Class: ${el.className}`);
      console.log('');
    });
    
    console.log('\nDomain-containing elements:');
    articleAnalysis.domainElements.forEach((el, i) => {
      console.log(`${i+1}. Text: "${el.text}"`);
      console.log(`   Tag: ${el.tagName}`);
      console.log(`   Class: ${el.className}`);
      console.log(`   Parent Class: ${el.parentClassName}`);
      console.log('');
    });
    
    console.log('\nArticle HTML Structure (first 1000 chars):');
    console.log(articleAnalysis.articleStructure);
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugFoorillaStructure().catch(console.error);