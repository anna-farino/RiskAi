/**
 * Debug URL truncation issue
 */

import puppeteer from 'puppeteer';

async function debugUrlTruncation() {
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
    console.log('Debugging URL truncation in Foorilla extraction...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check for URLs that might be getting truncated
    const urlAnalysis = await page.evaluate(() => {
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
        
        // For elements without href, construct URL with source domain
        if (!href && text && text.split(' ').length >= 4) {
          // Look for source domain
          const listItem = element.closest('li, .list-group-item');
          let sourceDomain = '';
          if (listItem) {
            const smallElements = Array.from(listItem.querySelectorAll('small'));
            for (const small of smallElements) {
              const sourceText = small.textContent?.trim() || '';
              const domainMatch = sourceText.match(/^([a-zA-Z0-9-]+\.[a-zA-Z]{2,})$/);
              if (domainMatch) {
                const domain = domainMatch[1];
                if (!domain.includes('foorilla') && 
                    !domain.includes('google') && 
                    !domain.includes('facebook') && 
                    !domain.includes('twitter') &&
                    !domain.includes('localStorage') &&
                    !domain.includes('document.') &&
                    domain.length > 5) {
                  sourceDomain = domain;
                  break;
                }
              }
            }
          }
          
          // Generate slug without truncation
          const slug = text.toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '-')
            .replace(/^-+|-+$/g, '')
            .replace(/-{2,}/g, '-');
          
          if (sourceDomain) {
            href = `https://${sourceDomain}/${slug}`;
          } else {
            href = `/article/${slug}`;
          }
        }
        
        return {
          href,
          text,
          originalHref: element.getAttribute('href'),
          dataUrl: element.getAttribute('data-url'),
          onclick: element.getAttribute('onclick'),
          hrefLength: href ? href.length : 0,
          textLength: text ? text.length : 0
        };
      }).filter(link => {
        const text = link.text;
        if (!text || text.length < 3) return false;
        
        const textLower = text.toLowerCase();
        if (textLower.includes('login') || textLower.includes('register') || 
            textLower.includes('contact') || textLower.includes('about') ||
            textLower.includes('privacy') || textLower.includes('terms') ||
            textLower.includes('menu')) {
          return false;
        }
        
        if (text.length < 3 || ['top', 'new', 'old', 'all'].includes(textLower)) {
          return false;
        }
        
        return true;
      });
      
      return {
        totalExtracted: extracted.length,
        withHref: extracted.filter(link => link.href).length,
        longUrls: extracted.filter(link => link.hrefLength > 60),
        suspiciousUrls: extracted.filter(link => 
          link.hrefLength > 50 && link.hrefLength < 80 && 
          link.href && !link.href.endsWith('/') && !link.href.includes('?')
        ),
        sampleLongUrls: extracted
          .filter(link => link.hrefLength > 60)
          .slice(0, 10)
          .map(link => ({
            text: link.text.substring(0, 50),
            href: link.href,
            length: link.hrefLength,
            originalHref: link.originalHref,
            dataUrl: link.dataUrl
          }))
      };
    });
    
    console.log(`\nURL Analysis Results:`);
    console.log(`Total extracted: ${urlAnalysis.totalExtracted}`);
    console.log(`With href: ${urlAnalysis.withHref}`);
    console.log(`Long URLs (>60 chars): ${urlAnalysis.longUrls.length}`);
    console.log(`Suspicious URLs (50-80 chars): ${urlAnalysis.suspiciousUrls.length}`);
    
    console.log('\nSample long URLs:');
    urlAnalysis.sampleLongUrls.forEach((link, i) => {
      console.log(`${i+1}. Length: ${link.length}`);
      console.log(`   Text: "${link.text}"`);
      console.log(`   Constructed URL: ${link.href}`);
      console.log(`   Original href: ${link.originalHref || 'none'}`);
      console.log(`   Data URL: ${link.dataUrl || 'none'}`);
      console.log('');
    });
    
    // Check specifically for URLs ending with suspicious patterns
    const potentialTruncation = urlAnalysis.sampleLongUrls.filter(link => 
      link.href.match(/-[a-z]$/) || // Ends with dash and single letter
      link.href.match(/[a-z]{1,3}$/) || // Ends with 1-3 letters (might be truncated)
      (!link.href.includes('?') && !link.href.endsWith('/') && link.length > 60 && link.length < 80)
    );
    
    console.log(`\nPotential truncation cases: ${potentialTruncation.length}`);
    potentialTruncation.forEach((link, i) => {
      console.log(`${i+1}. SUSPICIOUS: "${link.href}" (${link.length} chars)`);
      console.log(`   From text: "${link.text}"`);
    });
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugUrlTruncation().catch(console.error);