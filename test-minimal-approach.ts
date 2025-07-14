import { detectDynamicContentNeeds } from './backend/services/scraping/core/method-selector';

async function testMinimalApproach() {
  console.log('🧪 Testing Dynamic Content Detection Logic Fix\n');
  
  // Test cases that should NOT trigger Puppeteer (after fix)
  const testCases = [
    {
      name: 'SPA Framework with Good Content',
      html: `
        <html>
          <head><title>Test Site</title></head>
          <body>
            <div id="react-root"></div>
            <div class="content">
              <a href="/article1">Article 1</a>
              <a href="/article2">Article 2</a>
              <a href="/article3">Article 3</a>
              <a href="/article4">Article 4</a>
              <a href="/article5">Article 5</a>
              <a href="/article6">Article 6</a>
            </div>
          </body>
        </html>
      `,
      shouldTriggerPuppeteer: false,
      reason: 'SPA framework but adequate links (6 > 5 threshold)'
    },
    {
      name: 'SPA Framework with Few Links',
      html: `
        <html>
          <head><title>Test Site</title></head>
          <body>
            <div id="react-root"></div>
            <div class="content">
              <a href="/article1">Article 1</a>
              <a href="/article2">Article 2</a>
            </div>
          </body>
        </html>
      `,
      shouldTriggerPuppeteer: true,
      reason: 'SPA framework AND few links (2 < 5 threshold)'
    },
    {
      name: 'HTMX Site',
      html: `
        <html>
          <head><title>Test Site</title></head>
          <body>
            <div hx-get="/load-more" hx-trigger="click">Load More</div>
          </body>
        </html>
      `,
      shouldTriggerPuppeteer: true,
      reason: 'Strong HTMX evidence (hx-get attribute)'
    },
    {
      name: 'Regular Site with Dynamic Loading',
      html: `
        <html>
          <head><title>Test Site</title></head>
          <body>
            <div class="load-more">Load More</div>
            <div class="content">
              <a href="/article1">Article 1</a>
              <a href="/article2">Article 2</a>
              <a href="/article3">Article 3</a>
              <a href="/article4">Article 4</a>
              <a href="/article5">Article 5</a>
              <a href="/article6">Article 6</a>
            </div>
          </body>
        </html>
      `,
      shouldTriggerPuppeteer: false,
      reason: 'Dynamic loading but adequate links and no content loading indicators'
    }
  ];
  
  console.log('Testing dynamic content detection with different scenarios:\n');
  
  for (const testCase of testCases) {
    const result = detectDynamicContentNeeds(testCase.html, 'https://example.com');
    const status = result === testCase.shouldTriggerPuppeteer ? '✅' : '❌';
    
    console.log(`${status} ${testCase.name}`);
    console.log(`   Expected: ${testCase.shouldTriggerPuppeteer ? 'Puppeteer' : 'HTTP'}`);
    console.log(`   Actual: ${result ? 'Puppeteer' : 'HTTP'}`);
    console.log(`   Reason: ${testCase.reason}`);
    console.log();
  }
  
  console.log('🎯 Test Summary:');
  const results = testCases.map(testCase => ({
    name: testCase.name,
    passed: detectDynamicContentNeeds(testCase.html, 'https://example.com') === testCase.shouldTriggerPuppeteer
  }));
  
  const passedCount = results.filter(r => r.passed).length;
  console.log(`Passed: ${passedCount}/${testCases.length}`);
  
  if (passedCount === testCases.length) {
    console.log('✅ All tests passed! Dynamic content detection is now more conservative.');
  } else {
    console.log('❌ Some tests failed. The logic may need further adjustment.');
  }
}

testMinimalApproach().catch(console.error);