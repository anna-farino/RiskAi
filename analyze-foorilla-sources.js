/**
 * Analyze all potential source domain indicators on Foorilla
 */

import puppeteer from 'puppeteer';

async function analyzeFoorillaSources() {
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
    console.log('Analyzing all source domain patterns on Foorilla...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Comprehensive analysis of the page structure
    const analysis = await page.evaluate(() => {
      // Find all elements containing domain patterns
      const allElements = Array.from(document.querySelectorAll('*'));
      const domainPattern = /\b([a-zA-Z0-9-]+\.[a-zA-Z]{2,})\b/g;
      
      const domainsFound = [];
      allElements.forEach(el => {
        const text = el.textContent?.trim() || '';
        const matches = text.match(domainPattern);
        if (matches) {
          matches.forEach(domain => {
            if (!domain.includes('foorilla') && 
                !domain.includes('google') && 
                !domain.includes('facebook') && 
                !domain.includes('twitter') &&
                domain.length > 5) {
              domainsFound.push({
                domain,
                element: el.tagName,
                className: el.className,
                parentClass: el.parentElement?.className,
                text: text.substring(0, 100),
                fullHTML: el.outerHTML.substring(0, 200)
              });
            }
          });
        }
      });
      
      // Look specifically for article-like containers
      const articleContainers = Array.from(document.querySelectorAll('div[class*="tdi"], article, .post, .item, .entry'));
      const articleAnalysis = articleContainers.slice(0, 5).map(container => ({
        containerClass: container.className,
        containerTag: container.tagName,
        text: container.textContent?.trim().substring(0, 200),
        smallElements: Array.from(container.querySelectorAll('small')).map(small => ({
          text: small.textContent?.trim(),
          className: small.className,
          parentClassName: small.parentElement?.className
        })),
        lastElements: Array.from(container.querySelectorAll('*:last-child')).slice(-3).map(el => ({
          text: el.textContent?.trim(),
          tagName: el.tagName,
          className: el.className
        }))
      }));
      
      // Look for specific patterns mentioned by user
      const textEndElements = Array.from(document.querySelectorAll('.text-end'));
      const textEndAnalysis = textEndElements.map(el => ({
        text: el.textContent?.trim(),
        innerHTML: el.innerHTML,
        smallChildren: Array.from(el.querySelectorAll('small')).map(small => small.textContent?.trim())
      }));
      
      return {
        domainsFound: domainsFound.slice(0, 20), // Limit to first 20
        articleContainers: articleAnalysis,
        textEndElements: textEndAnalysis,
        totalElements: allElements.length,
        totalDomains: domainsFound.length
      };
    });
    
    console.log(`\nTotal elements on page: ${analysis.totalElements}`);
    console.log(`Total domains found: ${analysis.totalDomains}`);
    
    console.log('\nUnique domains found on page:');
    const uniqueDomains = [...new Set(analysis.domainsFound.map(d => d.domain))];
    uniqueDomains.forEach((domain, i) => {
      console.log(`${i+1}. ${domain}`);
    });
    
    console.log('\nDetailed domain analysis:');
    analysis.domainsFound.slice(0, 10).forEach((item, i) => {
      console.log(`${i+1}. Domain: ${item.domain}`);
      console.log(`   Element: ${item.element}.${item.className}`);
      console.log(`   Parent: ${item.parentClass}`);
      console.log(`   Text: "${item.text}"`);
      console.log(`   HTML: ${item.fullHTML}`);
      console.log('');
    });
    
    console.log('\nText-end elements analysis:');
    analysis.textEndElements.forEach((item, i) => {
      console.log(`${i+1}. Text: "${item.text}"`);
      console.log(`   HTML: ${item.innerHTML}`);
      console.log(`   Small children: ${item.smallChildren.join(', ')}`);
      console.log('');
    });
    
    console.log('\nArticle containers analysis:');
    analysis.articleContainers.forEach((container, i) => {
      console.log(`${i+1}. Container: ${container.containerTag}.${container.containerClass}`);
      console.log(`   Text: "${container.text}"`);
      console.log(`   Small elements: ${container.smallElements.length}`);
      container.smallElements.forEach((small, j) => {
        console.log(`     Small ${j+1}: "${small.text}" (${small.className})`);
      });
      console.log('');
    });
    
  } catch (error) {
    console.error('Analysis failed:', error.message);
  } finally {
    await browser.close();
  }
}

analyzeFoorillaSources().catch(console.error);