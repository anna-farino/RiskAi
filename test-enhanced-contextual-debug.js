/**
 * Enhanced debug test for contextual endpoint detection with detailed logging
 */

import puppeteer from 'puppeteer';
import { extractLinksFromPage } from './backend/services/scraping/extractors/link-extraction/puppeteer-link-handler.js';

async function testEnhancedContextualDebug() {
  console.log('Starting enhanced contextual debug test...');
  
  const browser = await puppeteer.launch({ 
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set up page
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to Foorilla cybersecurity page
    const testUrl = 'https://foorilla.com/media/cybersecurity/';
    console.log(`\n=== NAVIGATING TO: ${testUrl} ===`);
    
    await page.goto(testUrl, { waitUntil: 'networkidle2' });
    
    console.log('\n=== CALLING extractLinksFromPage WITH ENHANCED DEBUG ===');
    
    // Call the enhanced extraction function
    const links = await extractLinksFromPage(page, testUrl);
    
    console.log(`\n=== EXTRACTION RESULTS ===`);
    console.log(`Total links found: ${links.length}`);
    
    if (links.length > 0) {
      console.log('\nSample links:');
      links.slice(0, 5).forEach((link, index) => {
        console.log(`${index + 1}. ${link.text?.substring(0, 50)}... -> ${link.url?.substring(0, 80)}...`);
      });
    }
    
    console.log('\n=== TEST COMPLETED ===');
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    await browser.close();
  }
}

testEnhancedContextualDebug().catch(console.error);