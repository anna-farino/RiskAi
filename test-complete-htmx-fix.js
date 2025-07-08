/**
 * Complete test to verify HTMX contextual detection fixes
 * This tests the full workflow: detection → loading → extraction
 */

import puppeteer from 'puppeteer';

async function testCompleteHTMXFix() {
  console.log('🚀 Testing complete HTMX contextual detection fix...');
  
  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to cybersecurity section
    const targetUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`📍 Navigating to: ${targetUrl}`);
    
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('📊 Current page URL:', page.url());
    
    // Test our enhanced HTMX loading with proper contextual headers
    const results = await page.evaluate(async (currentUrl) => {
      const baseUrl = 'https://foorilla.com';
      let totalContentLoaded = 0;
      const endpointResults = [];
      
      // Use our updated prioritized endpoints
      const prioritizedEndpoints = [
        '/media/items/',           // Main content - should work with context
        '/media/items/top/',       // Secondary content
        '/media/items/followed/',
        '/topics/media/',          // Topics sidebar with contextual content
        '/media/items/saved/',
        '/media/sources/',
        '/media/sources/following/',
        '/media/filter/',
      ];
      
      console.log(`🔧 Testing with HX-Current-URL: ${currentUrl}`);
      
      for (const endpoint of prioritizedEndpoints) {
        try {
          console.log(`🔄 Testing endpoint: ${endpoint}`);
          
          const headers = {
            'HX-Request': 'true',
            'HX-Current-URL': currentUrl,  // Critical contextual header
            'Accept': 'text/html, */*',
            'X-Requested-With': 'XMLHttpRequest',
            'X-Screen': 'D'
          };
          
          const response = await fetch(`${baseUrl}${endpoint}`, { headers });
          
          if (response.ok) {
            const html = await response.text();
            
            if (html.length > 100) {
              // Check for cybersecurity content
              const htmlLower = html.toLowerCase();
              const containsCyber = htmlLower.includes('cybersecurity') || 
                                  htmlLower.includes('security') || 
                                  htmlLower.includes('cyber') ||
                                  htmlLower.includes('threat') ||
                                  htmlLower.includes('malware') ||
                                  htmlLower.includes('breach');
              
              // Count article links
              const tempDiv = document.createElement('div');
              tempDiv.innerHTML = html;
              const articleLinks = tempDiv.querySelectorAll('a[href*="/media/items/"]');
              const externalLinks = tempDiv.querySelectorAll('a[href^="http"]:not([href*="foorilla.com"])');
              
              endpointResults.push({
                endpoint,
                status: response.status,
                contentLength: html.length,
                containsCyber,
                articleLinks: articleLinks.length,
                externalLinks: externalLinks.length,
                preview: html.substring(0, 300) + '...'
              });
              
              totalContentLoaded += html.length;
              
              console.log(`✅ ${endpoint}: ${html.length} chars, cyber: ${containsCyber}, articles: ${articleLinks.length}`);
              
              // If this is the main endpoint and it has good content, prioritize it
              if (endpoint === '/media/items/' && html.length > 10000) {
                console.log(`🎯 Main content endpoint loaded successfully, prioritizing this content`);
                break;
              }
            } else {
              endpointResults.push({
                endpoint,
                status: response.status,
                contentLength: html.length,
                containsCyber: false,
                articleLinks: 0,
                externalLinks: 0,
                preview: 'Minimal content'
              });
              console.log(`⚠️  ${endpoint}: Minimal content (${html.length} chars)`);
            }
          } else {
            endpointResults.push({
              endpoint,
              status: response.status,
              error: `HTTP ${response.status}`,
              contentLength: 0,
              containsCyber: false,
              articleLinks: 0,
              externalLinks: 0
            });
            console.log(`❌ ${endpoint}: ${response.status}`);
          }
        } catch (error) {
          endpointResults.push({
            endpoint,
            error: error.message,
            contentLength: 0,
            containsCyber: false,
            articleLinks: 0,
            externalLinks: 0
          });
          console.log(`💥 ${endpoint}: ${error.message}`);
        }
      }
      
      return {
        totalContentLoaded,
        endpointResults,
        contextUrl: currentUrl
      };
    }, targetUrl);
    
    console.log('\n📋 Test Results Summary:');
    console.log(`Context URL: ${results.contextUrl}`);
    console.log(`Total content loaded: ${results.totalContentLoaded} chars`);
    console.log(`Endpoints tested: ${results.endpointResults.length}`);
    
    // Analyze results
    const workingEndpoints = results.endpointResults.filter(r => r.contentLength > 100);
    const cyberEndpoints = results.endpointResults.filter(r => r.containsCyber);
    const articlesFound = results.endpointResults.reduce((sum, r) => sum + r.articleLinks, 0);
    const externalLinksFound = results.endpointResults.reduce((sum, r) => sum + r.externalLinks, 0);
    
    console.log(`\n📈 Analysis:`);
    console.log(`  Working endpoints: ${workingEndpoints.length}`);
    console.log(`  Cybersecurity content: ${cyberEndpoints.length}`);
    console.log(`  Article links found: ${articlesFound}`);
    console.log(`  External links found: ${externalLinksFound}`);
    
    console.log('\n🔍 Detailed Results:');
    results.endpointResults.forEach(result => {
      console.log(`\n${result.endpoint}:`);
      if (result.error) {
        console.log(`  ❌ Error: ${result.error}`);
      } else {
        console.log(`  📊 Status: ${result.status}`);
        console.log(`  📏 Content: ${result.contentLength} chars`);
        console.log(`  🔒 Cyber content: ${result.containsCyber}`);
        console.log(`  📄 Article links: ${result.articleLinks}`);
        console.log(`  🔗 External links: ${result.externalLinks}`);
        if (result.containsCyber && result.contentLength > 1000) {
          console.log(`  🎯 GOOD: This endpoint has contextual cybersecurity content!`);
        }
      }
    });
    
    // Test if we can actually extract articles from the loaded content
    const articleExtraction = await page.evaluate(() => {
      const containers = document.querySelectorAll('.htmx-injected-content');
      let totalArticles = 0;
      let cyberArticles = 0;
      
      containers.forEach(container => {
        const links = container.querySelectorAll('a[href*="/media/items/"]');
        links.forEach(link => {
          const text = link.textContent || '';
          const href = link.getAttribute('href') || '';
          
          if (text.length > 10 && !href.includes('search') && !href.includes('filter')) {
            totalArticles++;
            
            const textLower = text.toLowerCase();
            if (textLower.includes('cyber') || textLower.includes('security') || 
                textLower.includes('threat') || textLower.includes('malware') ||
                textLower.includes('breach') || textLower.includes('attack')) {
              cyberArticles++;
            }
          }
        });
      });
      
      return { totalArticles, cyberArticles };
    });
    
    console.log(`\n🎯 Article Extraction Test:`);
    console.log(`  Total articles extractable: ${articleExtraction.totalArticles}`);
    console.log(`  Cybersecurity articles: ${articleExtraction.cyberArticles}`);
    
    // Final verdict
    console.log('\n🏆 Final Verdict:');
    const hasWorkingEndpoints = workingEndpoints.length > 0;
    const hasCyberContent = cyberEndpoints.length > 0;
    const hasArticles = articlesFound > 0;
    const hasExternalLinks = externalLinksFound > 0;
    
    if (hasWorkingEndpoints && hasCyberContent && hasArticles) {
      console.log('✅ SUCCESS: HTMX contextual detection is working correctly!');
      console.log('   - Endpoints are loading content');
      console.log('   - Cybersecurity context is being preserved');
      console.log('   - Articles are being discovered');
      if (hasExternalLinks) {
        console.log('   - External links are being found');
      }
    } else {
      console.log('❌ ISSUES DETECTED:');
      if (!hasWorkingEndpoints) console.log('   - No working endpoints');
      if (!hasCyberContent) console.log('   - No cybersecurity content');
      if (!hasArticles) console.log('   - No articles found');
      if (!hasExternalLinks) console.log('   - No external links found');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await browser.close();
  }
}

testCompleteHTMXFix().catch(console.error);