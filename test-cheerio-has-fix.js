/**
 * Test script to verify Cheerio :has() pseudo-class fix
 */
import * as cheerio from 'cheerio';

// Test HTML with press release content
const testHTML = `
<div class="press-flex">
  <div>
    <p class="smallp">JULY 09, 2025 03:54 PM (EDT)</p>
    <p>FOR IMMEDIATE RELEASE</p>
    <p>OLDWICK, N.J.–(BUSINESS WIRE)–AM Best has assigned a Financial Strength Rating of A- (Excellent) and a Long-Term Issuer Credit Rating of "a-" (Excellent) to Ceres Life Insurance Company (Ceres Life) (San Juan, PR). The outlook assigned to these Credit Ratings (ratings) is stable.</p>
    <p>The ratings reflect Ceres Life's balance sheet strength, which AM Best assesses as very strong, as well as its adequate operating performance, limited business profile and appropriate enterprise risk management (ERM).</p>
    <p>Ceres Life's balance sheet strength assessment is underpinned by its risk-adjusted capitalization at the strongest level, as measured by Best's Capital Adequacy Ratio (BCAR). The company maintains a conservative investment portfolio, consisting primarily of investment-grade bonds. The balance sheet strength assessment also factors in the company's dependence on reinsurance.</p>
    <p><strong>CONTACTS:</strong> John Smith</p>
  </div>
</div>
`;

async function testCheerioHasFix() {
  console.log('🧪 Testing Cheerio :has() pseudo-class fix\n');
  
  const $ = cheerio.load(testHTML);
  
  // Test 1: Original selector that fails
  console.log('Test 1: Original selector with :has()');
  const originalSelector = 'div.press-flex > div > p:not(.smallp):not(:has(strong))';
  try {
    const elements = $(originalSelector);
    console.log(`✅ Selector worked! Found ${elements.length} elements`);
    elements.each((i, el) => {
      console.log(`  Element ${i}: "${$(el).text().substring(0, 50)}..."`);
    });
  } catch (error) {
    console.log(`❌ Selector failed: ${error.message}`);
  }
  
  // Test 2: Our fix - remove :has() and filter manually
  console.log('\nTest 2: Fixed approach - remove :has() and filter manually');
  const withoutHas = originalSelector.replace(/:has\([^)]+\)/g, '');
  console.log(`  Simplified selector: "${withoutHas}"`);
  
  try {
    let elements = $(withoutHas);
    console.log(`  Initial elements found: ${elements.length}`);
    
    // Filter out elements that would have been excluded by :has()
    if (originalSelector.includes(':not(:has(strong))')) {
      elements = elements.filter((_, el) => {
        const $el = $(el);
        return $el.find('strong').length === 0;
      });
      console.log(`  After filtering out <strong> elements: ${elements.length}`);
    }
    
    console.log(`✅ Fixed approach worked! Final elements: ${elements.length}`);
    elements.each((i, el) => {
      const text = $(el).text().trim();
      console.log(`  Element ${i}: "${text.substring(0, 60)}..." (${text.length} chars)`);
    });
    
    // Extract all content
    const content = elements.map((_, el) => $(el).text().trim()).get().filter(text => text.length > 0).join('\n\n');
    console.log(`\n📄 Total content extracted: ${content.length} chars`);
    console.log('Content preview:');
    console.log(content.substring(0, 300) + '...');
    
  } catch (error) {
    console.log(`❌ Fixed approach failed: ${error.message}`);
  }
  
  // Test 3: Alternative - just get all paragraphs without :has()
  console.log('\n\nTest 3: Alternative approach - simpler selector');
  const simpleSelector = 'div.press-flex p:not(.smallp)';
  try {
    const elements = $(simpleSelector).filter((_, el) => {
      return $(el).find('strong').length === 0;
    });
    console.log(`✅ Simple selector with filter: ${elements.length} elements`);
  } catch (error) {
    console.log(`❌ Simple approach failed: ${error.message}`);
  }
}

testCheerioHasFix();