/**
 * Debug the relationship between article titles and source domains
 */

import puppeteer from 'puppeteer';

async function debugArticleDomainRelationship() {
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
    console.log('Analyzing article-domain relationship structure...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Look for the overall structure containing both titles and domains
    const analysis = await page.evaluate(() => {
      // Find containers that have both text content and domain small elements
      const potentialArticleContainers = Array.from(document.querySelectorAll('div')).filter(div => {
        const hasSmallDomain = div.querySelector('small') && 
          div.querySelector('small').textContent?.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/);
        const hasLongText = div.textContent && div.textContent.trim().length > 20;
        return hasSmallDomain && hasLongText;
      });
      
      const articleAnalysis = potentialArticleContainers.slice(0, 10).map(container => {
        const smallDomain = container.querySelector('small');
        const domain = smallDomain ? smallDomain.textContent?.trim() : '';
        
        // Get all text content, but try to identify the main title
        const fullText = container.textContent?.trim() || '';
        
        // Look for potential article titles (longer text elements)
        const textElements = Array.from(container.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim() || '';
          return text.length > 10 && text.length < 200 && 
                 el.children.length === 0 && // leaf elements only
                 !text.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/); // not domain
        });
        
        // Try to find clickable elements or article titles
        const clickableElements = Array.from(container.querySelectorAll('*')).filter(el => {
          const text = el.textContent?.trim() || '';
          return text.length > 10 && (
            el.tagName === 'A' || 
            el.hasAttribute('onclick') ||
            el.hasAttribute('data-url') ||
            el.hasAttribute('data-href') ||
            (text.split(' ').length >= 4 && text.length < 200)
          );
        });
        
        return {
          domain,
          containerClass: container.className,
          fullText: fullText.substring(0, 300),
          textElements: textElements.slice(0, 3).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 100),
            className: el.className
          })),
          clickableElements: clickableElements.slice(0, 3).map(el => ({
            tag: el.tagName,
            text: el.textContent?.trim().substring(0, 100),
            href: el.getAttribute('href') || el.getAttribute('data-url') || '',
            onclick: el.getAttribute('onclick') || ''
          })),
          containerHTML: container.outerHTML.substring(0, 500)
        };
      });
      
      return {
        totalContainers: potentialArticleContainers.length,
        analysis: articleAnalysis
      };
    });
    
    console.log(`\nFound ${analysis.totalContainers} containers with both text and domains`);
    
    console.log('\nDetailed container analysis:');
    analysis.analysis.forEach((item, i) => {
      console.log(`\n${i+1}. Domain: ${item.domain}`);
      console.log(`   Container class: ${item.containerClass}`);
      console.log(`   Full text: "${item.fullText}"`);
      
      console.log(`   Text elements (${item.textElements.length}):`);
      item.textElements.forEach((text, j) => {
        console.log(`     ${j+1}. ${text.tag}.${text.className}: "${text.text}"`);
      });
      
      console.log(`   Clickable elements (${item.clickableElements.length}):`);
      item.clickableElements.forEach((click, j) => {
        console.log(`     ${j+1}. ${click.tag}: "${click.text}"`);
        if (click.href) console.log(`        href: ${click.href}`);
        if (click.onclick) console.log(`        onclick: ${click.onclick.substring(0, 50)}`);
      });
      
      console.log(`   Container HTML: ${item.containerHTML}`);
    });
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugArticleDomainRelationship().catch(console.error);