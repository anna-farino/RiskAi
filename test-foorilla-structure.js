/**
 * Test script to analyze Foorilla HTML structure after HTMX loading
 */

import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function analyzeFoorillaStructure() {
  let browser;
  
  try {
    console.log('🔍 Starting Foorilla structure analysis...');
    
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--single-process',
        '--disable-gpu'
      ]
    });
    
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('📄 Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    // Wait for HTMX to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Get initial HTML
    let html = await page.content();
    console.log(`📊 Initial HTML length: ${html.length} characters`);
    
    // Analyze HTMX elements
    const htmxInfo = await page.evaluate(() => {
      const htmxElements = document.querySelectorAll('[hx-get], [hx-post], [hx-trigger]');
      const loadMoreButtons = document.querySelectorAll('button, [hx-get*="load"], [class*="load"], [class*="more"]');
      
      return {
        htmxElementCount: htmxElements.length,
        loadMoreCount: loadMoreButtons.length,
        allLinks: document.querySelectorAll('a').length
      };
    });
    
    console.log(`🔧 HTMX Analysis:`, htmxInfo);
    
    // Try to trigger HTMX loading
    console.log('🎯 Triggering HTMX content loading...');
    
    // Scroll to trigger lazy loading
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Click any load more buttons
    const loadMoreClicked = await page.evaluate(() => {
      const buttons = document.querySelectorAll('button, [hx-get*="load"], [class*="load"], [class*="more"], [onclick*="load"]');
      let clicked = 0;
      
      buttons.forEach(button => {
        if (button.offsetHeight > 0 && button.offsetWidth > 0) {
          try {
            button.click();
            clicked++;
          } catch (e) {
            // Continue with other buttons
          }
        }
      });
      
      return clicked;
    });
    
    console.log(`👆 Clicked ${loadMoreClicked} load more elements`);
    
    // Wait for content to load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get final HTML
    html = await page.content();
    console.log(`📊 Final HTML length: ${html.length} characters`);
    
    // Analyze the HTML structure using Cheerio
    const $ = cheerio.load(html);
    
    console.log('\n🔍 ANALYZING HTML STRUCTURE:');
    console.log(`Total <a> tags: ${$('a').length}`);
    console.log(`Links with href: ${$('a[href]').length}`);
    
    // Look for different link patterns
    const patterns = [
      { name: 'Article links', selector: 'a[href*="/article"], a[href*="/post"], a[href*="/news"]' },
      { name: 'Media links', selector: 'a[href*="/media"]' },
      { name: 'Long text links (>15 chars)', selector: 'a' },
      { name: 'Links in containers', selector: '.article a, .post a, .news-item a, .media-item a' },
      { name: 'Links with titles', selector: 'a[title]' }
    ];
    
    patterns.forEach(pattern => {
      const elements = $(pattern.selector);
      console.log(`${pattern.name}: ${elements.length} found`);
      
      if (pattern.name === 'Long text links (>15 chars)') {
        let longTextLinks = 0;
        elements.each((_, el) => {
          const text = $(el).text().trim();
          if (text.length >= 15) {
            longTextLinks++;
          }
        });
        console.log(`  - With text >=15 chars: ${longTextLinks}`);
      }
    });
    
    // Show sample links
    console.log('\n📝 SAMPLE LINKS FOUND:');
    let sampleCount = 0;
    $('a[href]').each((_, element) => {
      if (sampleCount >= 10) return false;
      
      const href = $(element).attr('href');
      const text = $(element).text().trim();
      const parentClass = $(element).parent().attr('class') || '';
      
      if (text.length >= 10) { // Show links with reasonable text
        console.log(`${sampleCount + 1}. Text: "${text}" (${text.length} chars)`);
        console.log(`   URL: ${href}`);
        console.log(`   Parent class: ${parentClass}`);
        console.log('---');
        sampleCount++;
      }
    });
    
    // Look for content that might contain article info but isn't in <a> tags
    console.log('\n🔍 LOOKING FOR OTHER CONTENT PATTERNS:');
    const divs = $('div[class*="article"], div[class*="post"], div[class*="news"], div[class*="media"]');
    console.log(`Content divs found: ${divs.length}`);
    
    // Check for JavaScript-generated content
    const jsContent = await page.evaluate(() => {
      const containers = document.querySelectorAll('div, section, article');
      let contentBlocks = 0;
      
      containers.forEach(container => {
        const text = container.textContent || '';
        if (text.length > 50 && container.children.length > 0) {
          contentBlocks++;
        }
      });
      
      return {
        contentBlocks,
        totalContainers: containers.length
      };
    });
    
    console.log(`JavaScript content analysis:`, jsContent);
    
  } catch (error) {
    console.error('❌ Error analyzing Foorilla structure:', error);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

analyzeFoorillaStructure();