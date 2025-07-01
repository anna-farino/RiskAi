/**
 * Debug script to specifically analyze small elements and their relationship to articles
 */

import puppeteer from 'puppeteer';

async function debugSmallElements() {
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
    console.log('Debugging small elements relationship to articles...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Debug small elements and their relationship to articles
    const analysis = await page.evaluate(() => {
      // Find all small elements containing domains
      const smallElements = Array.from(document.querySelectorAll('small'));
      const domainSmalls = smallElements.filter(small => {
        const text = small.textContent?.trim() || '';
        return text.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/);
      });
      
      // For each domain small, find its article container and nearby text
      const smallAnalysis = domainSmalls.map(small => {
        const domain = small.textContent?.trim();
        
        // Find possible article containers
        const containers = [
          small.closest('article'),
          small.closest('.post'),
          small.closest('.item'),
          small.closest('.entry'),
          small.closest('.content'),
          small.closest('.card'),
          small.closest('div[class*="tdi"]'),
          small.closest('div'),
          small.parentElement,
          small.parentElement?.parentElement
        ].filter(Boolean);
        
        // Get text from containers to find associated article titles
        const containerTexts = containers.map(container => ({
          tag: container.tagName,
          className: container.className,
          text: container.textContent?.trim().substring(0, 200),
          // Look for clickable elements in this container
          clickableElements: Array.from(container.querySelectorAll('a, div[onclick], span[onclick]')).map(el => ({
            text: el.textContent?.trim().substring(0, 50),
            href: el.getAttribute('href') || el.getAttribute('onclick') || '',
            tag: el.tagName
          }))
        }));
        
        return {
          domain,
          smallHTML: small.outerHTML,
          parentClass: small.parentElement?.className,
          containers: containerTexts
        };
      });
      
      return {
        totalSmalls: smallElements.length,
        domainSmalls: domainSmalls.length,
        analysis: smallAnalysis.slice(0, 5) // First 5 for detailed analysis
      };
    });
    
    console.log(`\nTotal small elements: ${analysis.totalSmalls}`);
    console.log(`Small elements with domains: ${analysis.domainSmalls}`);
    
    console.log('\nDetailed analysis of domain small elements:');
    analysis.analysis.forEach((item, i) => {
      console.log(`\n${i+1}. Domain: ${item.domain}`);
      console.log(`   Small HTML: ${item.smallHTML}`);
      console.log(`   Parent class: ${item.parentClass}`);
      
      console.log(`   Containers found: ${item.containers.length}`);
      item.containers.forEach((container, j) => {
        console.log(`     Container ${j+1}: ${container.tag}.${container.className}`);
        console.log(`     Text: "${container.text}"`);
        console.log(`     Clickable elements: ${container.clickableElements.length}`);
        container.clickableElements.forEach((clickable, k) => {
          console.log(`       ${k+1}. ${clickable.tag}: "${clickable.text}" -> ${clickable.href}`);
        });
      });
    });
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugSmallElements().catch(console.error);