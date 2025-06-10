/**
 * Test script to verify enhanced scheduler functionality
 * This demonstrates Phase 1: Server-Side Scheduler Independence
 */

import { initializeScheduler as initThreatTracker, getSchedulerStatus as getThreatStatus } from './backend/apps/threat-tracker/services/scheduler.js';
import { initializeScheduler as initNewsRadar } from './backend/apps/news-radar/services/scheduler.js';

async function testSchedulerEnhancements() {
  console.log('🔍 Testing Enhanced Scheduler System');
  console.log('=====================================');
  
  try {
    // Test Threat Tracker scheduler initialization
    console.log('\n📊 Initializing Threat Tracker scheduler...');
    const threatResult = await initThreatTracker();
    console.log(`✅ Threat Tracker initialization: ${threatResult ? 'SUCCESS' : 'FAILED'}`);
    
    // Get detailed status
    const threatStatus = getThreatStatus();
    console.log('📈 Threat Tracker Status:', JSON.stringify(threatStatus, null, 2));
    
    // Test News Radar scheduler initialization
    console.log('\n📰 Initializing News Radar scheduler...');
    const newsResult = await initNewsRadar();
    console.log(`✅ News Radar initialization: ${newsResult ? 'SUCCESS' : 'FAILED'}`);
    
    // Verify scheduler independence (runs without user sessions)
    console.log('\n🔍 Testing scheduler independence...');
    setTimeout(() => {
      const statusAfterDelay = getThreatStatus();
      console.log('📊 Status after 10 seconds (should still be active):');
      console.log(`   - Initialized: ${statusAfterDelay.initialized}`);
      console.log(`   - Active Jobs: ${statusAfterDelay.activeJobs}`);
      console.log(`   - Health Check Active: ${statusAfterDelay.healthCheckActive}`);
      
      if (statusAfterDelay.initialized && statusAfterDelay.healthCheckActive) {
        console.log('✅ PHASE 1 COMPLETE: Schedulers running independently');
      } else {
        console.log('❌ PHASE 1 INCOMPLETE: Schedulers not fully independent');
      }
      
      process.exit(0);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Scheduler test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
testSchedulerEnhancements().catch(console.error);