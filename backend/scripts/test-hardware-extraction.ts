#!/usr/bin/env node
/**
 * Test script to verify hardware extraction with improved AI prompt
 * Tests that manufacturer is properly separated from device name
 */

import { extractArticleEntities } from '../services/openai';
import { log } from '../utils/log';

async function testHardwareExtraction() {
  console.log('=== Testing Hardware Extraction with Manufacturer Separation ===\n');
  
  // Test cases for hardware with manufacturer prefixes
  const testCases = [
    'Microsoft SurfaceBook 3',
    'Cisco ASA 5500',
    'Dell PowerEdge R740',
    'Apple MacBook Pro M2',
    'Netgear Nighthawk AX12',
    'HP ProLiant DL380 Gen10',
    'Lenovo ThinkPad X1 Carbon',
    'ASUS ROG Strix G15',
  ];
  
  for (const hardware of testCases) {
    console.log(`\nTesting: "${hardware}"`);
    console.log('----------------------------------------');
    
    try {
      const contextHint = `Hardware device: ${hardware}`;
      
      const extracted = await extractArticleEntities({
        title: `Technology Stack Entry: ${contextHint}`,
        content: `User is adding the following to their technology stack: ${contextHint}. This is a hardware entity that should be processed and normalized appropriately.`,
        url: 'hardware-test'
      });
      
      if (extracted.hardware && extracted.hardware.length > 0) {
        const hw = extracted.hardware[0];
        console.log('  ✓ Extracted Hardware:');
        console.log(`    Name: "${hw.name}"`);
        console.log(`    Manufacturer: ${hw.manufacturer || 'none'}`);
        console.log(`    Model: ${hw.model || 'none'}`);
        console.log(`    Category: ${hw.category || 'none'}`);
        
        // Check if manufacturer was properly extracted from name
        const originalLower = hardware.toLowerCase();
        const nameLower = hw.name.toLowerCase();
        const manufacturerLower = (hw.manufacturer || '').toLowerCase();
        
        if (manufacturerLower && originalLower.startsWith(manufacturerLower) && !nameLower.startsWith(manufacturerLower)) {
          console.log(`    ✅ SUCCESS: Manufacturer "${hw.manufacturer}" correctly removed from name`);
        } else if (manufacturerLower && nameLower.startsWith(manufacturerLower)) {
          console.log(`    ⚠️  WARNING: Name still contains manufacturer prefix`);
        } else if (!hw.manufacturer) {
          console.log(`    ⚠️  WARNING: No manufacturer extracted`);
        }
      } else {
        console.log('  ❌ No hardware extraction results');
      }
      
      // Also check if any companies were extracted
      if (extracted.companies && extracted.companies.length > 0) {
        console.log('  Related Companies:');
        extracted.companies.forEach(c => {
          console.log(`    - ${c.name} (${c.type})`);
        });
      }
      
    } catch (error: any) {
      console.error(`  ❌ Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Hardware Extraction Test Complete ===');
  log('Hardware extraction test completed', 'info');
}

// Run the test
testHardwareExtraction().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});