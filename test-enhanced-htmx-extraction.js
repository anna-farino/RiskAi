/**
 * Test script to verify the enhanced HTMX link extraction implementation
 * Tests against Foorilla to ensure we extract 15+ articles instead of just 1
 */

import puppeteer from 'puppeteer';

async function testEnhancedHTMXExtraction() {
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
    console.log('🧪 Testing enhanced HTMX extraction against Foorilla...');
    
    await page.setViewport({ width: 1200, height: 800 });
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Import the enhanced link extractor
    const { extractArticleLinksFromPage } = await import('./backend/services/scraping/extractors/link-extractor.js');
    
    console.log('📄 Loading Foorilla cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { 
      waitUntil: 'networkidle0',
      timeout: 60000 
    });
    
    const baseUrl = 'https://foorilla.com';
    const options = {
      aiContext: 'cybersecurity threat intelligence articles'
    };
    
    console.log('🔍 Running enhanced extraction...');
    const startTime = Date.now();
    
    const extractedLinks = await extractArticleLinksFromPage(page, baseUrl, options);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    console.log('\n📊 Extraction Results:');
    console.log(`⏱️  Duration: ${duration.toFixed(2)} seconds`);
    console.log(`🔗 Links extracted: ${extractedLinks.length}`);
    
    if (extractedLinks.length >= 15) {
      console.log('✅ SUCCESS: Extracted 15+ articles as expected!');
    } else if (extractedLinks.length >= 10) {
      console.log('⚠️  PARTIAL SUCCESS: Extracted 10+ articles (improvement, but could be better)');
    } else {
      console.log('❌ ISSUE: Still extracting fewer than 10 articles');
    }
    
    console.log('\n🔍 Sample extracted links:');
    extractedLinks.slice(0, 10).forEach((link, i) => {
      console.log(`${i + 1}. ${link}`);
    });
    
    // Analyze the page structure to understand what we're extracting
    const pageAnalysis = await page.evaluate(() => {
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const articleLikeLinks = allLinks.filter(link => {
        const text = link.textContent?.trim() || '';
        const href = link.href;
        return text.length > 10 && text.split(' ').length >= 3 && 
               !href.includes('#') && !href.includes('javascript:') &&
               href.startsWith('http');
      });
      
      return {
        totalLinks: allLinks.length,
        articleLikeLinks: articleLikeLinks.length,
        htmxElements: document.querySelectorAll('[hx-get], [data-hx-get]').length
      };
    });
    
    console.log('\n📈 Page Analysis:');
    console.log(`Total links on page: ${pageAnalysis.totalLinks}`);
    console.log(`Article-like links available: ${pageAnalysis.articleLikeLinks}`);
    console.log(`HTMX elements: ${pageAnalysis.htmxElements}`);
    
    const extractionRatio = (extractedLinks.length / pageAnalysis.articleLikeLinks * 100).toFixed(1);
    console.log(`Extraction efficiency: ${extractionRatio}% of available article links`);
    
    if (extractionRatio >= 80) {
      console.log('🎯 EXCELLENT: Extracting 80%+ of available articles');
    } else if (extractionRatio >= 60) {
      console.log('👍 GOOD: Extracting 60%+ of available articles');
    } else if (extractionRatio >= 40) {
      console.log('📊 MODERATE: Extracting 40%+ of available articles');
    } else {
      console.log('⚠️  LOW: Extracting less than 40% of available articles');
    }
    
    console.log('\n🎯 Test Summary:');
    console.log(`Target: Extract 15+ articles from dynamic HTMX page`);
    console.log(`Result: Extracted ${extractedLinks.length} articles`);
    console.log(`Status: ${extractedLinks.length >= 15 ? 'PASSED ✅' : 'NEEDS IMPROVEMENT ⚠️'}`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await browser.close();
  }
}

testEnhancedHTMXExtraction().catch(console.error);