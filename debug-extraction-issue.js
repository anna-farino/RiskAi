/**
 * Debug script to understand why extraction is returning 0 links
 */

import puppeteer from 'puppeteer';

async function debugExtractionIssue() {
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
    console.log('🔍 Debugging extraction issue with Foorilla...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Loading Foorilla page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Step 1: Count all links on page
    const allLinksCount = await page.evaluate(() => {
      return document.querySelectorAll('a[href]').length;
    });
    console.log(`Step 1: Total links with href: ${allLinksCount}`);
    
    // Step 2: Extract raw link data
    const rawLinkData = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.slice(0, 10).map(link => ({
        href: link.getAttribute('href') || '',
        text: link.textContent?.trim() || '',
        textLength: link.textContent?.trim().length || 0
      }));
    });
    
    console.log('\nStep 2: Sample raw link data:');
    rawLinkData.forEach((link, i) => {
      console.log(`${i + 1}. href="${link.href}" text="${link.text}" (${link.textLength} chars)`);
    });
    
    // Step 3: Apply current filtering logic step by step
    const filteringResults = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      let step1 = links.length;
      console.log(`Before filtering: ${step1} links`);
      
      // Apply href filtering
      let filtered = links.filter(link => {
        const href = link.getAttribute('href') || '';
        return href && !href.startsWith('#') && !href.startsWith('javascript:') && !href.startsWith('mailto:');
      });
      let step2 = filtered.length;
      console.log(`After href filtering: ${step2} links`);
      
      // Apply text length filtering
      filtered = filtered.filter(link => {
        const text = link.textContent?.trim() || '';
        return text.length >= 5;
      });
      let step3 = filtered.length;
      console.log(`After text length filtering (>=5): ${step3} links`);
      
      // Apply navigation filtering
      filtered = filtered.filter(link => {
        const text = link.textContent?.trim() || '';
        const textLower = text.toLowerCase();
        return !(textLower.includes('login') || textLower.includes('register') || 
                textLower.includes('contact') || textLower.includes('about') ||
                textLower.includes('privacy') || textLower.includes('terms') ||
                textLower.includes('home') || textLower.includes('menu'));
      });
      let step4 = filtered.length;
      console.log(`After navigation filtering: ${step4} links`);
      
      // Apply word count filtering
      filtered = filtered.filter(link => {
        const text = link.textContent?.trim() || '';
        return text.split(' ').length >= 2;
      });
      let step5 = filtered.length;
      console.log(`After word count filtering (>=2): ${step5} links`);
      
      return {
        step1, step2, step3, step4, step5,
        sampleFailures: links.slice(0, 5).map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim(),
          textLength: link.textContent?.trim().length,
          wordCount: link.textContent?.trim().split(' ').length,
          passesHref: !!(link.getAttribute('href') && 
                        !link.getAttribute('href').startsWith('#') && 
                        !link.getAttribute('href').startsWith('javascript:') && 
                        !link.getAttribute('href').startsWith('mailto:')),
          passesLength: (link.textContent?.trim().length || 0) >= 5,
          passesWords: (link.textContent?.trim().split(' ').length || 0) >= 2
        }))
      };
    });
    
    console.log('\nStep 3: Filtering results breakdown:');
    console.log(`Initial links: ${filteringResults.step1}`);
    console.log(`After href filter: ${filteringResults.step2}`);
    console.log(`After length filter: ${filteringResults.step3}`);
    console.log(`After navigation filter: ${filteringResults.step4}`);
    console.log(`Final result: ${filteringResults.step5}`);
    
    console.log('\nStep 4: Sample link analysis:');
    filteringResults.sampleFailures.forEach((link, i) => {
      console.log(`Link ${i + 1}:`);
      console.log(`  href: "${link.href}"`);
      console.log(`  text: "${link.text}" (${link.textLength} chars, ${link.wordCount} words)`);
      console.log(`  passes href: ${link.passesHref}`);
      console.log(`  passes length: ${link.passesLength}`);
      console.log(`  passes words: ${link.passesWords}`);
      console.log('');
    });
    
    // Step 5: Try much more lenient filtering
    const lenientFiltering = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      
      const lenient = links.filter(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        
        // Very basic filtering - just skip obvious non-links
        return href && 
               !href.startsWith('#') && 
               !href.startsWith('javascript:') && 
               text.length > 0;
      });
      
      return {
        count: lenient.length,
        samples: lenient.slice(0, 10).map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim().substring(0, 50)
        }))
      };
    });
    
    console.log(`\nStep 5: Lenient filtering result: ${lenientFiltering.count} links`);
    console.log('Sample lenient results:');
    lenientFiltering.samples.forEach((link, i) => {
      console.log(`${i + 1}. "${link.text}" -> ${link.href}`);
    });
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugExtractionIssue().catch(console.error);