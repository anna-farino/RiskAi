/**
 * Test that press release extraction works correctly with our fixes
 */
import { extractContentWithSelectors } from './backend/services/scraping/unified-scraper-v2/content-extractor.js';

// Test HTML with multiple paragraphs
const testHTML = `
<div class="press-flex">
  <div>
    <p class="smallp">JULY 09, 2025 03:54 PM (EDT)</p>
    <p>FOR IMMEDIATE RELEASE</p>
    <p>OLDWICK, N.J.–(BUSINESS WIRE)–AM Best has assigned a Financial Strength Rating of A- (Excellent) and a Long-Term Issuer Credit Rating of "a-" (Excellent) to Ceres Life Insurance Company (Ceres Life) (San Juan, PR). The outlook assigned to these Credit Ratings (ratings) is stable.</p>
    <p>The ratings reflect Ceres Life's balance sheet strength, which AM Best assesses as very strong, as well as its adequate operating performance, limited business profile and appropriate enterprise risk management (ERM).</p>
    <p>Ceres Life's balance sheet strength assessment is underpinned by its risk-adjusted capitalization at the strongest level, as measured by Best's Capital Adequacy Ratio (BCAR). The company maintains a conservative investment portfolio, consisting primarily of investment-grade bonds.</p>
    <p><strong>CONTACTS:</strong> John Smith</p>
  </div>
</div>
`;

const config = {
  titleSelector: 'h1',
  contentSelector: 'div.press-flex > div > p:not(.smallp):not(:has(strong))',
  dateSelector: 'p.smallp'
};

console.log('🧪 Testing press release extraction with fixes\n');

const result = extractContentWithSelectors(testHTML, config);

console.log('Results:');
console.log(`- Content length: ${result.content?.length || 0} chars`);
console.log(`- Confidence: ${result.confidence}`);
console.log(`- Method: ${result.extractionMethod}`);

if (result.content && result.content.length > 100) {
  console.log('\n✅ SUCCESS: Multi-paragraph extraction working correctly!');
  console.log('\nContent preview:');
  console.log(result.content.substring(0, 200) + '...');
} else {
  console.log('\n❌ FAILED: Content extraction still not working properly');
  console.log('Content:', result.content);
}