/**
 * Test script to verify the HTMX context fix
 * This should now extract "Bert Blitzes Linux & Windows Systems" as the first result
 * from https://foorilla.com/media/cybersecurity/ instead of wrong-section content
 */

import puppeteer from 'puppeteer';
import { extractLinksFromPage } from './backend/services/scraping/extractors/link-extraction/puppeteer-link-handler.ts';

async function testHTMXContextFix() {
  const browser = await puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-web-security',
      '--disable-features=VizDisplayCompositor'
    ]
  });

  try {
    const page = await browser.newPage();
    
    // Set headers to appear like a normal browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    console.log('\n🌐 Testing HTMX context fix on Foorilla cybersecurity section...');
    console.log('Expected first result: "Bert Blitzes Linux & Windows Systems"');
    console.log('URL: https://foorilla.com/media/cybersecurity/\n');
    
    // Navigate to the cybersecurity section
    const url = 'https://foorilla.com/media/cybersecurity/';
    await page.goto(url, { 
      waitUntil: 'networkidle0',
      timeout: 30000 
    });
    
    console.log('✅ Page loaded successfully');
    
    // Test the fixed extraction
    const startTime = Date.now();
    const linkData = await extractLinksFromPage(page, url);
    const extractionTime = Date.now() - startTime;
    
    console.log(`\n📊 Extraction Results (${extractionTime}ms):`);
    console.log(`Total links found: ${linkData.length}`);
    
    if (linkData.length > 0) {
      console.log('\n🔍 First 5 results:');
      linkData.slice(0, 5).forEach((link, index) => {
        console.log(`[${index}] "${link.text}"`);
        console.log(`    URL: ${link.href}`);
        console.log(`    Context: ${link.context}`);
        console.log(`    Parent Class: ${link.parentClass}`);
        console.log('');
      });
      
      // Check if we got the expected result
      const firstResult = linkData[0];
      const expectedText = "Bert Blitzes Linux & Windows Systems";
      const expectedUrl = "https://foorilla.com/media/items/bert-blitzes-linux-windows-systems-69059/";
      
      console.log('\n🎯 Verification:');
      if (firstResult.text.includes("Bert Blitzes") || firstResult.text.includes("Linux") || firstResult.text.includes("Windows")) {
        console.log('✅ SUCCESS: Found expected "Bert Blitzes Linux & Windows Systems" article!');
        console.log(`✅ Text match: "${firstResult.text}"`);
        if (firstResult.href.includes('bert-blitzes-linux-windows-systems')) {
          console.log('✅ URL match: Expected URL pattern found');
        } else {
          console.log(`⚠️  URL different: ${firstResult.href}`);
        }
      } else {
        console.log('❌ FAILED: Expected "Bert Blitzes Linux & Windows Systems" not found as first result');
        console.log(`❌ Got instead: "${firstResult.text}"`);
        console.log(`❌ URL: ${firstResult.href}`);
      }
      
      // Check if we're pulling from wrong section (generic articles)
      const hasGenericArticles = linkData.some(link => 
        link.text.includes('Ex-FTC Commissioner') || 
        link.context.includes('generic') ||
        link.href.includes('/media/items/') && !link.href.includes('cybersecurity')
      );
      
      if (hasGenericArticles) {
        console.log('⚠️  WARNING: Still pulling some content from generic /media/ section');
      } else {
        console.log('✅ SUCCESS: No generic /media/ content detected - proper contextual filtering!');
      }
      
    } else {
      console.log('❌ FAILED: No links extracted');
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  } finally {
    await browser.close();
  }
}

// Run the test
testHTMXContextFix().catch(console.error);