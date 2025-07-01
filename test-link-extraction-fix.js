/**
 * Test to verify link extraction fix without TypeScript syntax errors
 */

import puppeteer from 'puppeteer';

async function testLinkExtractionFix() {
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
    console.log('Testing link extraction fix...');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Test basic link extraction without TypeScript syntax
    const extractionResult = await page.evaluate(() => {
      try {
        // Get basic elements
        const allElements = Array.from(document.querySelectorAll('a, div[onclick], div[data-url], span[onclick], [data-href]'));
        console.log(`Found ${allElements.length} total elements`);
        
        const results = [];
        
        // Process first 20 elements to test functionality
        for (let i = 0; i < Math.min(allElements.length, 20); i++) {
          const element = allElements[i];
          
          try {
            // Get URL
            let href = element.getAttribute('href') || 
                      element.getAttribute('data-url') || 
                      element.getAttribute('data-href') || '';
            
            const text = element.textContent?.trim() || '';
            
            // For onclick elements, try to extract URL
            if (!href && element.getAttribute('onclick')) {
              const onclick = element.getAttribute('onclick');
              const urlMatch = onclick.match(/['"]([^'"]*\/[^'"]*)['"]/);
              if (urlMatch) href = urlMatch[1];
            }
            
            // Simple source domain detection test
            let sourceDomain = '';
            const listItem = element.closest('li, .list-group-item');
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
                      domain.length > 5) {
                    sourceDomain = domain;
                    break;
                  }
                }
              }
            }
            
            if (href && text && text.length >= 5) {
              results.push({
                href,
                text: text.substring(0, 100),
                sourceDomain,
                index: i
              });
            }
          } catch (elementError) {
            console.error(`Error processing element ${i}:`, elementError.message);
          }
        }
        
        console.log(`Successfully processed elements, found ${results.length} valid links`);
        return {
          success: true,
          totalElements: allElements.length,
          validLinks: results.length,
          sampleLinks: results.slice(0, 5)
        };
        
      } catch (error) {
        console.error('Error in evaluation:', error.message);
        return {
          success: false,
          error: error.message
        };
      }
    });
    
    console.log('\nLink Extraction Test Results:');
    console.log('============================');
    
    if (extractionResult.success) {
      console.log(`✅ SUCCESS: No __name errors detected`);
      console.log(`📊 Total elements found: ${extractionResult.totalElements}`);
      console.log(`🔗 Valid links extracted: ${extractionResult.validLinks}`);
      
      console.log('\nSample extracted links:');
      extractionResult.sampleLinks.forEach((link, i) => {
        console.log(`${i + 1}. ${link.href}`);
        console.log(`   Text: "${link.text}"`);
        console.log(`   Source: ${link.sourceDomain || 'NONE'}`);
        console.log('');
      });
      
    } else {
      console.log(`❌ FAILED: ${extractionResult.error}`);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testLinkExtractionFix().catch(console.error);