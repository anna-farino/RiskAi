import { 
  scrapeWithHTTP, 
  scrapeWithPuppeteer, 
  detectBotProtection, 
  performTLSRequest, 
  getRandomBrowserProfile,
  createBrowserProfiles,
  detectDataDomeChallenge,
  EnhancedScrapingOptions,
  PuppeteerScrapingOptions
} from '../backend/services/scraping/core/protection-bypass';

/**
 * Test script for DataDome bypass enhancements
 * Tests all three tiers of the bypass system
 */

const TEST_URLS = [
  'https://www.marketwatch.com/story/microsoft-stock-rises-1-after-earnings-beat-expectations-2025-01-25',
  'https://www.marketwatch.com/story/tesla-stock-drops-3-after-q4-earnings-miss-2025-01-25',
  'https://www.marketwatch.com/news/technology',
  'https://www.marketwatch.com/investing/stock/msft'
];

interface TestResult {
  url: string;
  method: string;
  success: boolean;
  contentLength: number;
  responseTime: number;
  protectionDetected: boolean;
  protectionType?: string;
  error?: string;
}

async function testBrowserProfiles(): Promise<void> {
  console.log('\n=== Testing Browser Profile Generation ===');
  
  const profiles = createBrowserProfiles();
  console.log(`Created ${profiles.length} browser profiles`);
  
  profiles.forEach((profile, index) => {
    console.log(`Profile ${index + 1}:`);
    console.log(`  Device: ${profile.deviceType}`);
    console.log(`  Viewport: ${profile.viewport.width}x${profile.viewport.height}`);
    console.log(`  User Agent: ${profile.userAgent.substring(0, 50)}...`);
    console.log(`  JA3 Fingerprint: ${profile.ja3.substring(0, 50)}...`);
    console.log(`  Headers: ${Object.keys(profile.headers).length} headers`);
  });
  
  const randomProfile = getRandomBrowserProfile();
  console.log(`\nRandom profile selected: ${randomProfile.deviceType}`);
}

async function testTLSFingerprinting(): Promise<void> {
  console.log('\n=== Testing TLS Fingerprinting ===');
  
  const testUrl = TEST_URLS[0];
  const options: EnhancedScrapingOptions = {
    browserProfile: getRandomBrowserProfile(),
    behaviorDelay: { min: 1000, max: 2000 }
  };
  
  try {
    console.log(`Testing TLS fingerprinting on: ${testUrl}`);
    const startTime = Date.now();
    const html = await performTLSRequest(testUrl, options);
    const responseTime = Date.now() - startTime;
    
    if (html && html.length > 0) {
      const protectionInfo = detectBotProtection(html);
      console.log(`TLS Request successful:`);
      console.log(`  Content length: ${html.length} chars`);
      console.log(`  Response time: ${responseTime}ms`);
      console.log(`  Protection detected: ${protectionInfo.hasProtection}`);
      console.log(`  Protection type: ${protectionInfo.type}`);
      console.log(`  Confidence: ${protectionInfo.confidence}`);
    } else {
      console.log('TLS Request failed: No content received');
    }
  } catch (error) {
    console.error('TLS Request failed:', error);
  }
}

async function testHTTPScrapingWithTLS(): Promise<TestResult[]> {
  console.log('\n=== Testing HTTP Scraping with TLS Fallback ===');
  
  const results: TestResult[] = [];
  
  for (const url of TEST_URLS) {
    console.log(`\nTesting HTTP scraping: ${url}`);
    
    const options = {
      enableTLSFingerprinting: true,
      browserProfile: getRandomBrowserProfile(),
      behaviorDelay: { min: 500, max: 1500 },
      maxRetries: 2,
      timeout: 30000
    };
    
    try {
      const startTime = Date.now();
      const result = await scrapeWithHTTP(url, options);
      const responseTime = Date.now() - startTime;
      
      const testResult: TestResult = {
        url,
        method: 'HTTP+TLS',
        success: result.success,
        contentLength: result.html.length,
        responseTime,
        protectionDetected: !!result.protectionDetected?.hasProtection,
        protectionType: result.protectionDetected?.type,
        error: result.success ? undefined : 'Failed to retrieve content'
      };
      
      results.push(testResult);
      
      console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  Content length: ${result.html.length} chars`);
      console.log(`  Response time: ${responseTime}ms`);
      console.log(`  Status code: ${result.statusCode}`);
      console.log(`  Protection detected: ${result.protectionDetected?.hasProtection}`);
      console.log(`  Protection type: ${result.protectionDetected?.type}`);
      
    } catch (error) {
      console.error(`  Error: ${error}`);
      results.push({
        url,
        method: 'HTTP+TLS',
        success: false,
        contentLength: 0,
        responseTime: 0,
        protectionDetected: false,
        error: error.message
      });
    }
  }
  
  return results;
}

async function testPuppeteerEnhanced(): Promise<TestResult[]> {
  console.log('\n=== Testing Enhanced Puppeteer Scraping ===');
  
  const results: TestResult[] = [];
  
  for (const url of TEST_URLS) {
    console.log(`\nTesting Enhanced Puppeteer: ${url}`);
    
    const options: PuppeteerScrapingOptions = {
      isArticlePage: true,
      enhancedFingerprinting: true,
      enhancedHumanActions: true,
      browserProfile: getRandomBrowserProfile(),
      behaviorDelay: { min: 1000, max: 3000 },
      protectionBypass: true,
      timeout: 60000
    };
    
    try {
      const startTime = Date.now();
      const result = await scrapeWithPuppeteer(url, options);
      const responseTime = Date.now() - startTime;
      
      const testResult: TestResult = {
        url,
        method: 'Puppeteer Enhanced',
        success: result.success,
        contentLength: result.html.length,
        responseTime,
        protectionDetected: !!result.protectionDetected?.hasProtection,
        protectionType: result.protectionDetected?.type,
        error: result.success ? undefined : 'Failed to retrieve content'
      };
      
      results.push(testResult);
      
      console.log(`  Result: ${result.success ? 'SUCCESS' : 'FAILED'}`);
      console.log(`  Content length: ${result.html.length} chars`);
      console.log(`  Response time: ${responseTime}ms`);
      console.log(`  Protection detected: ${result.protectionDetected?.hasProtection}`);
      console.log(`  Protection type: ${result.protectionDetected?.type}`);
      
    } catch (error) {
      console.error(`  Error: ${error}`);
      results.push({
        url,
        method: 'Puppeteer Enhanced',
        success: false,
        contentLength: 0,
        responseTime: 0,
        protectionDetected: false,
        error: error.message
      });
    }
  }
  
  return results;
}

function printTestSummary(httpResults: TestResult[], puppeteerResults: TestResult[]): void {
  console.log('\n=== TEST SUMMARY ===');
  
  const allResults = [...httpResults, ...puppeteerResults];
  const totalTests = allResults.length;
  const successfulTests = allResults.filter(r => r.success).length;
  const failedTests = totalTests - successfulTests;
  
  console.log(`\nOverall Results:`);
  console.log(`  Total tests: ${totalTests}`);
  console.log(`  Successful: ${successfulTests} (${((successfulTests / totalTests) * 100).toFixed(1)}%)`);
  console.log(`  Failed: ${failedTests} (${((failedTests / totalTests) * 100).toFixed(1)}%)`);
  
  console.log(`\nHTTP + TLS Results:`);
  const httpSuccess = httpResults.filter(r => r.success).length;
  console.log(`  Successful: ${httpSuccess}/${httpResults.length} (${((httpSuccess / httpResults.length) * 100).toFixed(1)}%)`);
  
  console.log(`\nPuppeteer Enhanced Results:`);
  const puppeteerSuccess = puppeteerResults.filter(r => r.success).length;
  console.log(`  Successful: ${puppeteerSuccess}/${puppeteerResults.length} (${((puppeteerSuccess / puppeteerResults.length) * 100).toFixed(1)}%)`);
  
  console.log(`\nProtection Detection Summary:`);
  const protectionDetected = allResults.filter(r => r.protectionDetected).length;
  console.log(`  Protection detected: ${protectionDetected}/${totalTests} tests`);
  
  const protectionTypes = allResults
    .filter(r => r.protectionDetected)
    .map(r => r.protectionType)
    .reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  
  Object.entries(protectionTypes).forEach(([type, count]) => {
    console.log(`    ${type}: ${count} occurrences`);
  });
  
  console.log(`\nPerformance Summary:`);
  const avgResponseTime = allResults.reduce((sum, r) => sum + r.responseTime, 0) / allResults.length;
  console.log(`  Average response time: ${avgResponseTime.toFixed(0)}ms`);
  
  const avgContentLength = allResults
    .filter(r => r.success)
    .reduce((sum, r) => sum + r.contentLength, 0) / successfulTests;
  console.log(`  Average content length: ${avgContentLength.toFixed(0)} chars`);
}

async function runDataDomeBypassTests(): Promise<void> {
  console.log('Starting DataDome Bypass Enhancement Tests...');
  console.log('='.repeat(60));
  
  try {
    // Test 1: Browser Profile Generation
    await testBrowserProfiles();
    
    // Test 2: TLS Fingerprinting
    await testTLSFingerprinting();
    
    // Test 3: HTTP Scraping with TLS Fallback
    const httpResults = await testHTTPScrapingWithTLS();
    
    // Test 4: Enhanced Puppeteer Scraping
    const puppeteerResults = await testPuppeteerEnhanced();
    
    // Test Summary
    printTestSummary(httpResults, puppeteerResults);
    
  } catch (error) {
    console.error('Test suite failed:', error);
  }
  
  console.log('\n='.repeat(60));
  console.log('DataDome Bypass Enhancement Tests Complete');
}

// Run the tests
runDataDomeBypassTests().catch(console.error);