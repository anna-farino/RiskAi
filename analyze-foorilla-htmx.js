/**
 * Comprehensive analysis of Foorilla HTMX structure to understand the dynamic link extraction pattern
 * Based on the screenshots showing hx-get attributes loading article containers with external links
 */

import puppeteer from 'puppeteer';

async function analyzeFoorillaHTMX() {
  console.log('=== FOORILLA HTMX ANALYSIS ===\n');
  
  const browser = await puppeteer.launch({
    headless: false, // Let's see what's happening
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote'
    ]
  });

  const page = await browser.newPage();
  
  try {
    // Navigate to the cybersecurity page
    console.log('1. Navigating to Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'domcontentloaded',
      timeout: 30000 
    });
    
    // Wait for HTMX to load initial content
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Analyze the initial page structure
    console.log('2. Analyzing initial page structure...');
    const initialStructure = await page.evaluate(() => {
      const hxElements = Array.from(document.querySelectorAll('[hx-get]'));
      
      return {
        totalHxElements: hxElements.length,
        hxElements: hxElements.map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          hxGet: el.getAttribute('hx-get'),
          hxTrigger: el.getAttribute('hx-trigger'),
          hxTarget: el.getAttribute('hx-target'),
          hxSwap: el.getAttribute('hx-swap'),
          hasContent: el.innerHTML.length > 100,
          contentPreview: el.innerHTML.substring(0, 200) + '...'
        }))
      };
    });
    
    console.log(`Found ${initialStructure.totalHxElements} HTMX elements on initial page`);
    
    initialStructure.hxElements.forEach((el, i) => {
      console.log(`\n${i + 1}. ${el.tagName}#${el.id}`);
      console.log(`   hx-get: ${el.hxGet}`);
      console.log(`   hx-trigger: ${el.hxTrigger || 'default'}`);
      console.log(`   hx-target: ${el.hxTarget || 'self'}`);
      console.log(`   Has content: ${el.hasContent}`);
      if (el.hasContent) {
        console.log(`   Content preview: ${el.contentPreview}`);
      }
    });
    
    // Now let's wait for HTMX to fully load and check for article elements
    console.log('\n3. Waiting for HTMX content to load...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Look for article elements that might have been dynamically loaded
    const articleAnalysis = await page.evaluate(() => {
      // Look for elements that might contain article links
      const potentialArticleContainers = Array.from(document.querySelectorAll('div, article, section')).filter(el => {
        const hasHxGet = el.hasAttribute('hx-get');
        const text = el.textContent?.toLowerCase() || '';
        const hasArticleKeywords = text.includes('article') || 
                                 text.includes('cybersecurity') || 
                                 text.includes('security') ||
                                 text.includes('hack') ||
                                 text.includes('threat') ||
                                 text.includes('breach') ||
                                 text.includes('malware');
        
        return hasHxGet || (hasArticleKeywords && el.children.length > 0);
      });
      
      // Look for any external links that might be article links
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const externalLinks = allLinks.filter(link => 
        link.href.startsWith('http') && 
        !link.href.includes('foorilla.com')
      );
      
      return {
        totalPotentialContainers: potentialArticleContainers.length,
        containers: potentialArticleContainers.slice(0, 10).map(el => ({
          tagName: el.tagName,
          id: el.id,
          className: el.className,
          hasHxGet: el.hasAttribute('hx-get'),
          hxGet: el.getAttribute('hx-get'),
          textPreview: el.textContent?.trim().substring(0, 150),
          childrenCount: el.children.length,
          hasExternalLinks: Array.from(el.querySelectorAll('a[href]')).some(link => 
            link.href.startsWith('http') && !link.href.includes('foorilla.com')
          )
        })),
        totalExternalLinks: externalLinks.length,
        externalLinks: externalLinks.slice(0, 5).map(link => ({
          href: link.href,
          text: link.textContent?.trim(),
          parentElement: link.parentElement?.tagName,
          parentClass: link.parentElement?.className
        }))
      };
    });
    
    console.log(`\n4. Found ${articleAnalysis.totalPotentialContainers} potential article containers`);
    console.log(`   Found ${articleAnalysis.totalExternalLinks} external links`);
    
    if (articleAnalysis.containers.length > 0) {
      console.log('\nPotential article containers:');
      articleAnalysis.containers.forEach((container, i) => {
        console.log(`\n${i + 1}. ${container.tagName}#${container.id || 'no-id'}`);
        console.log(`   Class: ${container.className}`);
        console.log(`   Has hx-get: ${container.hasHxGet}`);
        if (container.hasHxGet) {
          console.log(`   hx-get: ${container.hxGet}`);
        }
        console.log(`   Has external links: ${container.hasExternalLinks}`);
        console.log(`   Text preview: ${container.textPreview}`);
      });
    }
    
    if (articleAnalysis.externalLinks.length > 0) {
      console.log('\nExternal article links found:');
      articleAnalysis.externalLinks.forEach((link, i) => {
        console.log(`\n${i + 1}. ${link.href}`);
        console.log(`   Text: ${link.text}`);
        console.log(`   Parent: ${link.parentElement}${link.parentClass ? '.' + link.parentClass : ''}`);
      });
    }
    
    // Now let's try to manually trigger HTMX elements that might load more content
    console.log('\n5. Triggering HTMX elements to load more content...');
    
    const hxElements = await page.$$('[hx-get]');
    console.log(`Found ${hxElements.length} HTMX elements to trigger`);
    
    for (let i = 0; i < Math.min(hxElements.length, 5); i++) {
      const element = hxElements[i];
      
      try {
        // Get element info
        const elementInfo = await element.evaluate(el => ({
          hxGet: el.getAttribute('hx-get'),
          hxTrigger: el.getAttribute('hx-trigger'),
          id: el.id,
          tagName: el.tagName
        }));
        
        console.log(`\nTriggering ${i + 1}: ${elementInfo.tagName}#${elementInfo.id} - ${elementInfo.hxGet}`);
        
        // Click the element to trigger HTMX
        await element.click();
        
        // Wait for content to load
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Check if new content was loaded
        const newContent = await page.evaluate(() => {
          const allLinks = Array.from(document.querySelectorAll('a[href]'));
          const externalLinks = allLinks.filter(link => 
            link.href.startsWith('http') && 
            !link.href.includes('foorilla.com')
          );
          
          return {
            totalExternalLinks: externalLinks.length,
            newLinks: externalLinks.slice(-3).map(link => ({
              href: link.href,
              text: link.textContent?.trim()
            }))
          };
        });
        
        console.log(`   Result: ${newContent.totalExternalLinks} total external links now`);
        if (newContent.newLinks.length > 0) {
          console.log('   Latest links:');
          newContent.newLinks.forEach(link => {
            console.log(`     - ${link.href}`);
          });
        }
        
      } catch (error) {
        console.log(`   Error triggering element ${i + 1}: ${error.message}`);
      }
    }
    
    // Final analysis of all discovered links
    console.log('\n6. Final link analysis...');
    const finalAnalysis = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const externalLinks = allLinks.filter(link => 
        link.href.startsWith('http') && 
        !link.href.includes('foorilla.com')
      );
      
      // Group by domain to understand the sources
      const linksByDomain = {};
      externalLinks.forEach(link => {
        try {
          const domain = new URL(link.href).hostname;
          if (!linksByDomain[domain]) {
            linksByDomain[domain] = [];
          }
          linksByDomain[domain].push({
            href: link.href,
            text: link.textContent?.trim()
          });
        } catch (e) {
          // Skip invalid URLs
        }
      });
      
      return {
        totalExternalLinks: externalLinks.length,
        linksByDomain: linksByDomain,
        allExternalLinks: externalLinks.map(link => ({
          href: link.href,
          text: link.textContent?.trim()
        }))
      };
    });
    
    console.log(`\nFinal Results:`);
    console.log(`Total external article links found: ${finalAnalysis.totalExternalLinks}`);
    
    if (Object.keys(finalAnalysis.linksByDomain).length > 0) {
      console.log('\nLinks by domain:');
      Object.entries(finalAnalysis.linksByDomain).forEach(([domain, links]) => {
        console.log(`\n${domain}: ${links.length} links`);
        links.slice(0, 3).forEach(link => {
          console.log(`  - ${link.href}`);
          console.log(`    Text: ${link.text}`);
        });
        if (links.length > 3) {
          console.log(`  ... and ${links.length - 3} more`);
        }
      });
    }
    
    console.log('\n=== ANALYSIS COMPLETE ===');
    
  } catch (error) {
    console.error('Error during analysis:', error);
  } finally {
    await browser.close();
  }
}

// Run the analysis
analyzeFoorillaHTMX().catch(console.error);