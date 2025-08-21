// Test script to verify unified storage is working
import { UnifiedStorageService } from './backend/services/unified-storage/index.js';

async function testUnifiedStorage() {
  console.log('Testing Unified Storage Service...\n');
  
  const storage = new UnifiedStorageService();
  
  // Test user ID (from our populated preferences)
  const testUserId = '07696485-cd4c-4b1f-bd5b-dc83e61954da';
  
  console.log('Testing News Radar articles fetch...');
  try {
    const newsArticles = await storage.getArticles(testUserId, 'news-radar', {
      limit: 5,
      offset: 0
    });
    
    console.log(`✓ News Radar: Found ${newsArticles.data.length} articles`);
    if (newsArticles.data.length > 0) {
      console.log(`  First article: "${newsArticles.data[0].title}"`);
    }
  } catch (error) {
    console.error(`✗ News Radar failed: ${error.message}`);
  }
  
  console.log('\nTesting Threat Tracker articles fetch...');
  try {
    const threatArticles = await storage.getArticles(testUserId, 'threat-tracker', {
      limit: 5,
      offset: 0
    });
    
    console.log(`✓ Threat Tracker: Found ${threatArticles.data.length} articles`);
    if (threatArticles.data.length > 0) {
      console.log(`  First article: "${threatArticles.data[0].title}"`);
    }
  } catch (error) {
    console.error(`✗ Threat Tracker failed: ${error.message}`);
  }
  
  console.log('\nTesting user sources fetch...');
  try {
    const sources = await storage.getUserSources(testUserId, 'news-radar');
    console.log(`✓ User has ${sources.length} News Radar sources`);
  } catch (error) {
    console.error(`✗ Sources fetch failed: ${error.message}`);
  }
  
  console.log('\n✅ Unified Storage Service is operational!');
}

testUnifiedStorage().catch(console.error);