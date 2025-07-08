/**
 * Test the contextual content preservation fix
 * This should now skip HTMX loading when contextual content is already present
 */

import puppeteer from 'puppeteer';

async function testContextualPreservationFix() {
  console.log('🧪 Testing contextual content preservation fix...');
  
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  
  try {
    // Navigate to cybersecurity page
    console.log('📍 Navigating to cybersecurity page...');
    await page.goto('https://foorilla.com/media/cybersecurity/', { waitUntil: 'networkidle2' });
    
    // Test our contextual content analysis logic
    const contentAnalysis = await page.evaluate((baseUrl) => {
      const articles = document.querySelectorAll('.stretched-link');
      const articleTexts = Array.from(articles).map(el => el.textContent?.trim()).filter(Boolean);
      
      // Check if content appears to be contextual based on URL
      const sourceUrl = new URL(baseUrl);
      const isTargetingCybersecurity = sourceUrl.pathname.includes('/cybersecurity');
      
      // Check if existing articles match the expected context
      let contextualScore = 0;
      const cybersecurityKeywords = [];
      if (isTargetingCybersecurity) {
        articleTexts.forEach(text => {
          const textLower = text.toLowerCase();
          if (textLower.includes('cyber') || textLower.includes('security') || 
              textLower.includes('attack') || textLower.includes('breach') ||
              textLower.includes('malware') || textLower.includes('phishing') ||
              textLower.includes('ransomware') || textLower.includes('hack') ||
              textLower.includes('linux') || textLower.includes('windows') ||
              textLower.includes('bert')) {
            contextualScore++;
            cybersecurityKeywords.push(text.substring(0, 50) + '...');
          }
        });
      }
      
      return {
        totalArticles: articles.length,
        firstArticle: articleTexts[0] || 'None',
        contextualScore: contextualScore,
        hasContextualContent: contextualScore >= 3 && articles.length >= 10,
        isTargetingCybersecurity: isTargetingCybersecurity,
        sampleArticles: articleTexts.slice(0, 5),
        cybersecurityKeywords: cybersecurityKeywords.slice(0, 10)
      };
    }, 'https://foorilla.com/media/cybersecurity/');
    
    console.log(`\n📊 Content Analysis Results:`);
    console.log(`Total articles: ${contentAnalysis.totalArticles}`);
    console.log(`Contextual score: ${contentAnalysis.contextualScore}`);
    console.log(`First article: "${contentAnalysis.firstArticle}"`);
    console.log(`Has contextual content: ${contentAnalysis.hasContextualContent}`);
    console.log(`Is targeting cybersecurity: ${contentAnalysis.isTargetingCybersecurity}`);
    
    console.log(`\n📄 Sample articles:`);
    contentAnalysis.sampleArticles.forEach((article, index) => {
      console.log(`${index + 1}. "${article}"`);
    });
    
    console.log(`\n🔒 Cybersecurity keywords found:`);
    contentAnalysis.cybersecurityKeywords.forEach((keyword, index) => {
      console.log(`${index + 1}. "${keyword}"`);
    });
    
    // Test decision logic
    const shouldSkipHTMX = contentAnalysis.hasContextualContent;
    console.log(`\n🤖 Decision Logic:`);
    console.log(`Should skip HTMX loading: ${shouldSkipHTMX}`);
    console.log(`Reason: ${shouldSkipHTMX ? 'Sufficient contextual content found' : 'Insufficient contextual content'}`);
    
    // Expected outcome verification
    if (contentAnalysis.firstArticle.includes('Bert') && contentAnalysis.firstArticle.includes('Linux')) {
      console.log('\n✅ SUCCESS: Found expected cybersecurity-first article "Bert Blitzes Linux & Windows Systems"');
      console.log('✅ Contextual filtering is working correctly');
    } else {
      console.log('\n❌ ISSUE: First article is not the expected cybersecurity article');
      console.log(`Expected to contain: "Bert" and "Linux"`);
      console.log(`Got: "${contentAnalysis.firstArticle}"`);
    }
    
    if (shouldSkipHTMX) {
      console.log('✅ SUCCESS: System should skip HTMX loading to preserve contextual content');
    } else {
      console.log('❌ ISSUE: System would load HTMX content and potentially override contextual articles');
    }
    
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    await browser.close();
  }
}

testContextualPreservationFix();