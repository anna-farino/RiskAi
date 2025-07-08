/**
 * Final test of the complete contextual extraction system
 */

import puppeteer from 'puppeteer';
import { extractLinksFromPage } from './backend/services/scraping/extractors/link-extraction/puppeteer-link-handler.ts';

async function testFinalExtraction() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();
    
    console.log('🎯 Final test: Complete contextual extraction');
    console.log('Expected: "Why CISOs are making the SASE switch" → venturebeat.com');
    
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 15000 
    });
    
    // Run extraction with timeout
    const startTime = Date.now();
    const result = await extractLinksFromPage(page, 'https://foorilla.com/media/cybersecurity/');
    const endTime = Date.now();
    
    console.log(`\n✅ Extraction completed in ${((endTime - startTime) / 1000).toFixed(1)}s`);
    console.log(`📊 Total links: ${result.length}`);
    
    if (result.length > 0) {
      console.log(`\n🏆 Top results:`);
      result.slice(0, 3).forEach((link, idx) => {
        try {
          const domain = new URL(link.href).hostname;
          console.log(`  ${idx + 1}. "${link.text}"`);
          console.log(`     → ${domain}`);
        } catch (e) {
          console.log(`  ${idx + 1}. "${link.text}" (invalid URL)`);
        }
      });
      
      // Check for the expected SASE article
      const saseArticle = result.find(link => 
        link.text.toLowerCase().includes('sase') || 
        link.text.toLowerCase().includes('ciso')
      );
      
      if (saseArticle) {
        try {
          const domain = new URL(saseArticle.href).hostname;
          console.log(`\n🎉 SUCCESS! Found expected article:`);
          console.log(`  "${saseArticle.text}"`);
          console.log(`  Domain: ${domain}`);
          if (domain === 'venturebeat.com') {
            console.log(`  ✅ Correct domain: venturebeat.com`);
          }
        } catch (e) {
          console.log(`\n⚠️  Found SASE article but invalid URL`);
        }
      } else {
        console.log(`\n❌ SASE article not found`);
      }
      
      // Count external domains
      const domains = new Set();
      result.forEach(link => {
        try {
          const domain = new URL(link.href).hostname;
          if (domain !== 'foorilla.com') domains.add(domain);
        } catch (e) {}
      });
      
      console.log(`\n🌐 External domains: ${domains.size}`);
      console.log(`📄 External articles: ${result.filter(l => {
        try { return new URL(l.href).hostname !== 'foorilla.com'; } catch { return false; }
      }).length}`);
      
    } else {
      console.log(`\n❌ No links extracted`);
    }
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  } finally {
    await browser.close();
  }
}

testFinalExtraction().catch(console.error);