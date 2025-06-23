/**
 * Test script to verify core scraping components are working
 */

import { BrowserManager } from './backend/services/scraping/core/browser-manager';
import { setupPage, setupStealthPage } from './backend/services/scraping/core/page-setup';
import { detectBotProtection } from './backend/services/scraping/core/protection-bypass';

async function testCoreComponents() {
  console.log('Testing core scraping components...');
  
  try {
    // Test 1: Browser Manager
    console.log('\n=== Testing Browser Manager ===');
    const browser = await BrowserManager.getBrowser();
    console.log('✓ Browser launched successfully');
    
    const isHealthy = await BrowserManager.healthCheck();
    console.log(`✓ Browser health check: ${isHealthy ? 'HEALTHY' : 'UNHEALTHY'}`);
    
    // Test 2: Page Setup
    console.log('\n=== Testing Page Setup ===');
    const page = await setupPage();
    console.log('✓ Standard page setup completed');
    
    const stealthPage = await setupStealthPage();
    console.log('✓ Stealth page setup completed');
    
    // Test 3: Basic navigation
    console.log('\n=== Testing Basic Navigation ===');
    await page.goto('https://example.com', { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    console.log(`✓ Navigation successful - Page title: ${title}`);
    
    // Test 4: Protection Detection
    console.log('\n=== Testing Protection Detection ===');
    const html = await page.content();
    const mockResponse = {
      status: 200,
      headers: new Map([['server', 'nginx']])
    };
    
    const protectionInfo = detectBotProtection(html, mockResponse);
    console.log(`✓ Protection detection completed - Type: ${protectionInfo.type}, Has Protection: ${protectionInfo.hasProtection}`);
    
    // Cleanup
    await page.close();
    await stealthPage.close();
    await BrowserManager.closeBrowser();
    
    console.log('\n✅ All core components working correctly!');
    return true;
    
  } catch (error) {
    console.error('\n❌ Core component test failed:', error.message);
    console.error('Stack:', error.stack);
    
    // Cleanup on error
    try {
      await BrowserManager.closeBrowser();
    } catch (cleanupError) {
      console.error('Cleanup error:', cleanupError.message);
    }
    
    return false;
  }
}

// Run the test
testCoreComponents()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });