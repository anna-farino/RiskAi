#!/usr/bin/env node
/**
 * Test script to verify the AI-powered tech stack addition
 * Tests that user inputs are processed through the same AI extraction pipeline as articles
 */

import { extractArticleEntities } from '../services/openai';
import { log } from '../utils/log';

async function testAIExtraction() {
  console.log('=== Testing AI-Powered Tech Stack Processing ===\n');
  
  // Test cases that should be processed by AI
  const testCases = [
    { type: 'software', input: 'Windows 10' },
    { type: 'software', input: 'Apache HTTP Server 2.4.41' },
    { type: 'software', input: 'nginx/1.18.0' },
    { type: 'software', input: 'Python 3.9' },
    { type: 'hardware', input: 'Cisco ASA 5505' },
    { type: 'hardware', input: 'Dell PowerEdge R740' },
    { type: 'vendor', input: 'Microsoft' },
    { type: 'vendor', input: 'Amazon Web Services' },
    { type: 'client', input: 'Acme Corporation' },
  ];
  
  for (const testCase of testCases) {
    console.log(`\nTest: ${testCase.type} - "${testCase.input}"`);
    console.log('----------------------------------------');
    
    try {
      // Simulate what the tech-stack router does
      const contextHint = testCase.type === 'software' ? `Software product: ${testCase.input}` :
                         testCase.type === 'hardware' ? `Hardware device: ${testCase.input}` :
                         testCase.type === 'vendor' ? `Vendor company: ${testCase.input}` :
                         testCase.type === 'client' ? `Client organization: ${testCase.input}` : testCase.input;
      
      const extracted = await extractArticleEntities({
        title: `Technology Stack Entry: ${contextHint}`,
        content: `User is adding the following to their technology stack: ${contextHint}. This is a ${testCase.type} entity that should be processed and normalized appropriately.`,
        url: 'tech-stack-test'
      });
      
      // Display relevant extraction results
      if (testCase.type === 'software' && extracted.software.length > 0) {
        const sw = extracted.software[0];
        console.log('  Extracted Software:');
        console.log(`    Name: ${sw.name}`);
        console.log(`    Version: ${sw.version || sw.versionFrom || 'none'}`);
        console.log(`    Vendor: ${sw.vendor || 'none'}`);
        console.log(`    Category: ${sw.category || 'none'}`);
        console.log(`    Confidence: ${sw.confidence}`);
      } else if (testCase.type === 'hardware' && extracted.hardware.length > 0) {
        const hw = extracted.hardware[0];
        console.log('  Extracted Hardware:');
        console.log(`    Name: ${hw.name}`);
        console.log(`    Model: ${hw.model || 'none'}`);
        console.log(`    Manufacturer: ${hw.manufacturer || 'none'}`);
        console.log(`    Category: ${hw.category || 'none'}`);
        console.log(`    Confidence: ${hw.confidence}`);
      } else if ((testCase.type === 'vendor' || testCase.type === 'client') && extracted.companies.length > 0) {
        const company = extracted.companies[0];
        console.log('  Extracted Company:');
        console.log(`    Name: ${company.name}`);
        console.log(`    Type: ${company.type}`);
        console.log(`    Confidence: ${company.confidence}`);
      } else {
        console.log('  No extraction results for this type');
      }
      
      // Also show any additional entities extracted (AI might find related entities)
      if (extracted.companies.length > 0 && testCase.type === 'software') {
        console.log('  Related Companies Found:');
        extracted.companies.forEach(c => {
          console.log(`    - ${c.name} (${c.type})`);
        });
      }
      
    } catch (error: any) {
      console.error(`  Error: ${error.message}`);
    }
  }
  
  console.log('\n=== Test Complete ===');
  log('AI tech stack test completed', 'info');
}

// Run the test
testAIExtraction().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});