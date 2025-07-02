/**
 * Minimal test of HTMX extraction pattern for Foorilla
 * Tests the two-level extraction pattern: hx-get containers -> article loading -> external link extraction
 */

import puppeteer from 'puppeteer';

async function testHTMXPattern() {
  console.log('=== TESTING HTMX PATTERN FOR FOORILLA ===\n');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  });

  const page = await browser.newPage();
  
  try {
    console.log('1. Navigating to Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'domcontentloaded' });
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for initial load
    
    // Step 1: Find all HTMX elements and categorize them
    console.log('2. Analyzing HTMX structure...');
    const htmxAnalysis = await page.evaluate(() => {
      const hxElements = Array.from(document.querySelectorAll('[hx-get]'));
      
      const containers = [];
      const articles = [];
      
      hxElements.forEach(el => {
        const hxGet = el.getAttribute('hx-get');
        const hxTarget = el.getAttribute('hx-target');
        const hxTrigger = el.getAttribute('hx-trigger') || 'click';
        const tagName = el.tagName.toLowerCase();
        
        // Classify based on URL pattern and element type
        if (hxGet.includes('/items/') && !hxGet.match(/\/items\/[^\/]+\/$/)) {
          // Container endpoints like /media/items/
          containers.push({
            hxGet,
            hxTarget,
            hxTrigger,
            tagName,
            id: el.id
          });
        } else if (hxGet.match(/\/items\/[^\/]+\/$/)) {
          // Individual article endpoints like /media/items/article-slug/
          articles.push({
            hxGet,
            hxTarget,
            hxTrigger,
            tagName,
            title: el.textContent?.trim().substring(0, 60) + '...'
          });
        }
      });
      
      return { 
        totalElements: hxElements.length,
        containers: containers.slice(0, 5), // Top 5 containers
        articles: articles.slice(0, 10), // Top 10 articles
        containerCount: containers.length,
        articleCount: articles.length
      };
    });
    
    console.log(`Found ${htmxAnalysis.totalElements} total HTMX elements:`);
    console.log(`  - ${htmxAnalysis.containerCount} container elements`);
    console.log(`  - ${htmxAnalysis.articleCount} article elements`);
    
    // Step 2: Load container content first
    if (htmxAnalysis.containers.length > 0) {
      console.log('\n3. Loading container content...');
      
      for (const container of htmxAnalysis.containers) {
        console.log(`Loading container: ${container.hxGet}`);
        
        // Trigger the container to load more articles
        await page.evaluate((hxGet) => {
          const element = document.querySelector(`[hx-get="${hxGet}"]`);
          if (element) {
            if (element.getAttribute('hx-trigger') === 'load') {
              // Already triggered, just wait
              console.log('Container triggers on load - should already be loaded');
            } else {
              element.click();
            }
          }
        }, container.hxGet);
        
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Step 3: Re-analyze after container loading
    console.log('\n4. Re-analyzing after container loading...');
    const updatedAnalysis = await page.evaluate(() => {
      const hxElements = Array.from(document.querySelectorAll('[hx-get]'));
      const articles = hxElements.filter(el => {
        const hxGet = el.getAttribute('hx-get');
        return hxGet && hxGet.match(/\/items\/[^\/]+\/$/);
      });
      
      return {
        totalElements: hxElements.length,
        articleCount: articles.length,
        sampleArticles: articles.slice(0, 5).map(el => ({
          hxGet: el.getAttribute('hx-get'),
          title: el.textContent?.trim().substring(0, 50) + '...',
          hxTarget: el.getAttribute('hx-target')
        }))
      };
    });
    
    console.log(`Updated analysis: ${updatedAnalysis.articleCount} article elements found`);
    
    // Step 4: Process individual articles to load external content
    console.log('\n5. Processing individual articles...');
    let externalLinksFound = 0;
    let articlesProcessed = 0;
    const maxArticlesToProcess = 10;
    
    for (const article of updatedAnalysis.sampleArticles.slice(0, maxArticlesToProcess)) {
      console.log(`Processing article: ${article.hxGet}`);
      
      try {
        // Click the article element to load its content
        await page.evaluate((hxGet) => {
          const element = document.querySelector(`[hx-get="${hxGet}"]`);
          if (element) {
            element.click();
          }
        }, article.hxGet);
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check for new external links
        const newExternalLinks = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          return allLinks
            .filter(link => {
              const href = link.href;
              return href && 
                     href.startsWith('http') && 
                     !href.includes('foorilla.com') &&
                     !href.includes('javascript:') &&
                     !href.includes('mailto:');
            })
            .map(link => link.href);
        });
        
        console.log(`  Found ${newExternalLinks.length} total external links on page`);
        externalLinksFound = newExternalLinks.length;
        articlesProcessed++;
        
      } catch (error) {
        console.log(`  Error processing article: ${error.message}`);
      }
    }
    
    // Step 5: Final external link extraction
    console.log('\n6. Final external link extraction...');
    const finalResults = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const externalLinks = allLinks
        .filter(link => {
          const href = link.href;
          return href && 
                 href.startsWith('http') && 
                 !href.includes('foorilla.com') &&
                 !href.includes('javascript:') &&
                 !href.includes('mailto:');
        })
        .map(link => ({
          href: link.href,
          text: link.textContent?.trim() || '',
          domain: new URL(link.href).hostname
        }));
      
      // Group by domain
      const byDomain = {};
      externalLinks.forEach(link => {
        if (!byDomain[link.domain]) byDomain[link.domain] = [];
        byDomain[link.domain].push(link);
      });
      
      return {
        totalExternalLinks: externalLinks.length,
        uniqueDomains: Object.keys(byDomain).length,
        linksByDomain: Object.fromEntries(
          Object.entries(byDomain).map(([domain, links]) => [domain, links.length])
        ),
        sampleLinks: externalLinks.slice(0, 10)
      };
    });
    
    console.log('\n=== FINAL RESULTS ===');
    console.log(`Total external article links found: ${finalResults.totalExternalLinks}`);
    console.log(`Unique domains: ${finalResults.uniqueDomains}`);
    console.log(`Articles processed: ${articlesProcessed}/${maxArticlesToProcess}`);
    
    if (finalResults.uniqueDomains > 0) {
      console.log('\nLinks by domain:');
      Object.entries(finalResults.linksByDomain).forEach(([domain, count]) => {
        console.log(`  ${domain}: ${count} links`);
      });
    }
    
    if (finalResults.sampleLinks.length > 0) {
      console.log('\nSample external links:');
      finalResults.sampleLinks.slice(0, 5).forEach((link, i) => {
        console.log(`${i + 1}. ${link.href}`);
        console.log(`   Text: ${link.text}`);
      });
    }
    
    // Determine success
    if (finalResults.totalExternalLinks > 20) {
      console.log('\n✅ SUCCESS: Found substantial external article links via HTMX');
    } else if (finalResults.totalExternalLinks > 5) {
      console.log('\n✅ PARTIAL SUCCESS: Found some external links');
    } else {
      console.log('\n❌ NEEDS IMPROVEMENT: Very few external links found');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

// Run the test
testHTMXPattern().catch(console.error);