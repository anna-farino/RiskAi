/**
 * Test HTMX endpoint loading to see what actual content is available
 */

import puppeteer from 'puppeteer';

async function testHTMXEndpoints() {
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
    console.log('🔍 Testing HTMX endpoint loading...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    console.log('📄 Loading Foorilla page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    // Wait for initial load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    console.log('\n📊 Initial state:');
    const initialLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      return links.map(link => ({
        href: link.getAttribute('href'),
        text: link.textContent?.trim(),
        hasArticlePattern: link.textContent?.trim().length > 10
      })).filter(link => link.hasArticlePattern);
    });
    console.log(`Article-like links before HTMX: ${initialLinks.length}`);
    
    // Manually fetch HTMX endpoints
    console.log('\n🔄 Fetching HTMX endpoints manually...');
    const htmxResults = await page.evaluate(async () => {
      const baseUrl = 'https://foorilla.com';
      const endpoints = [
        '/media/cybersecurity/items/',
        '/media/cybersecurity/items/top/',
        '/media/items/',
        '/media/items/top/'
      ];
      
      const results = [];
      
      for (const endpoint of endpoints) {
        try {
          console.log(`Fetching: ${baseUrl}${endpoint}`);
          const response = await fetch(`${baseUrl}${endpoint}`, {
            headers: {
              'HX-Request': 'true',
              'HX-Current-URL': window.location.href,
              'Accept': 'text/html, */*'
            }
          });
          
          if (response.ok) {
            const html = await response.text();
            console.log(`Success: ${endpoint} - ${html.length} chars`);
            
            // Parse the HTML to look for links
            const div = document.createElement('div');
            div.innerHTML = html;
            
            const links = Array.from(div.querySelectorAll('a[href]'));
            const articleLinks = links.filter(link => {
              const text = link.textContent?.trim() || '';
              return text.length > 5;
            });
            
            results.push({
              endpoint,
              success: true,
              htmlLength: html.length,
              linksFound: links.length,
              articleLinks: articleLinks.length,
              sampleLinks: articleLinks.slice(0, 3).map(link => ({
                href: link.getAttribute('href'),
                text: link.textContent?.trim()?.substring(0, 50)
              }))
            });
            
            // Inject content into page
            const container = document.createElement('div');
            container.className = 'htmx-loaded-content';
            container.setAttribute('data-source', endpoint);
            container.innerHTML = html;
            document.body.appendChild(container);
            
          } else {
            console.log(`Failed: ${endpoint} - ${response.status}`);
            results.push({
              endpoint,
              success: false,
              status: response.status
            });
          }
        } catch (e) {
          console.error(`Error with ${endpoint}:`, e);
          results.push({
            endpoint,
            success: false,
            error: e.message
          });
        }
      }
      
      return results;
    });
    
    console.log('\n📈 HTMX endpoint results:');
    htmxResults.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.endpoint}: ${result.htmlLength} chars, ${result.linksFound} links, ${result.articleLinks} articles`);
        if (result.sampleLinks.length > 0) {
          console.log('   Sample articles:');
          result.sampleLinks.forEach((link, i) => {
            console.log(`   ${i+1}. "${link.text}" -> ${link.href}`);
          });
        }
      } else {
        console.log(`❌ ${result.endpoint}: Failed (${result.status || result.error})`);
      }
    });
    
    // Wait a bit for content to settle
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Check links after HTMX content loading
    console.log('\n📊 After HTMX loading:');
    const finalLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'));
      const articleLinks = links.filter(link => {
        const href = link.getAttribute('href') || '';
        const text = link.textContent?.trim() || '';
        return href && 
               !href.startsWith('#') && 
               !href.startsWith('javascript:') && 
               text.length > 3;
      });
      
      return {
        totalLinks: links.length,
        filteredLinks: articleLinks.length,
        sampleFiltered: articleLinks.slice(0, 10).map(link => ({
          href: link.getAttribute('href'),
          text: link.textContent?.trim()?.substring(0, 50)
        }))
      };
    });
    
    console.log(`Total links on page: ${finalLinks.totalLinks}`);
    console.log(`Filtered article links: ${finalLinks.filteredLinks}`);
    console.log('\nSample filtered links:');
    finalLinks.sampleFiltered.forEach((link, i) => {
      console.log(`${i+1}. "${link.text}" -> ${link.href}`);
    });
    
    console.log(`\n🎯 Results Summary:`);
    console.log(`Initial article-like links: ${initialLinks.length}`);
    console.log(`HTMX endpoints loaded: ${htmxResults.filter(r => r.success).length}/${htmxResults.length}`);
    console.log(`Final filtered links: ${finalLinks.filteredLinks}`);
    console.log(`Improvement: ${finalLinks.filteredLinks - initialLinks.length} additional links`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testHTMXEndpoints().catch(console.error);