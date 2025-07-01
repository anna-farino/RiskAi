/**
 * Debug parent structure to find relationship between titles and domains
 */

import puppeteer from 'puppeteer';

async function debugParentStructure() {
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
    console.log('Finding parent structure relationship...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Find the parent structure that contains both titles and domains
    const analysis = await page.evaluate(() => {
      // Start with domain containers and walk up to find article containers
      const domainContainers = Array.from(document.querySelectorAll('.text-end small')).map(small => 
        small.closest('.text-end')
      );
      
      const parentAnalysis = domainContainers.slice(0, 5).map(textEndDiv => {
        const domain = textEndDiv.querySelector('small')?.textContent?.trim();
        
        // Walk up the parent chain to find article containers
        const parents = [];
        let current = textEndDiv.parentElement;
        let level = 0;
        
        while (current && level < 5) {
          parents.push({
            level,
            tag: current.tagName,
            className: current.className,
            text: current.textContent?.trim().substring(0, 200),
            childrenCount: current.children.length,
            // Find potential article titles in this parent
            potentialTitles: Array.from(current.children).filter(child => {
              const text = child.textContent?.trim() || '';
              return text.length > 15 && text.length < 200 && 
                     !text.match(/^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}$/) &&
                     !text.includes(domain); // not the domain itself
            }).map(child => ({
              tag: child.tagName,
              className: child.className,
              text: child.textContent?.trim().substring(0, 100)
            }))
          });
          
          current = current.parentElement;
          level++;
        }
        
        return {
          domain,
          textEndHTML: textEndDiv.outerHTML,
          parents
        };
      });
      
      return parentAnalysis;
    });
    
    console.log('\nParent structure analysis:');
    analysis.forEach((item, i) => {
      console.log(`\n${i+1}. Domain: ${item.domain}`);
      console.log(`   Text-end HTML: ${item.textEndHTML}`);
      
      console.log(`   Parent chain:`);
      item.parents.forEach((parent, j) => {
        console.log(`     Level ${parent.level}: ${parent.tag}.${parent.className} (${parent.childrenCount} children)`);
        console.log(`       Text: "${parent.text}"`);
        
        if (parent.potentialTitles.length > 0) {
          console.log(`       Potential titles: ${parent.potentialTitles.length}`);
          parent.potentialTitles.forEach((title, k) => {
            console.log(`         ${k+1}. ${title.tag}.${title.className}: "${title.text}"`);
          });
        }
      });
    });
    
  } catch (error) {
    console.error('Debug failed:', error.message);
  } finally {
    await browser.close();
  }
}

debugParentStructure().catch(console.error);