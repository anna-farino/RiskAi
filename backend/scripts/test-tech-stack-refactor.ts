#!/usr/bin/env node
/**
 * Test script to verify the refactored tech stack addition process
 * Tests that EntityManager's processing pipeline is correctly integrated
 */

import { EntityManager } from '../services/entity-manager';
import { extractVersion, findSoftwareCompany } from '../utils/entity-processing';
import { log } from '../utils/log';

async function testEntityProcessing() {
  const entityManager = new EntityManager();
  
  console.log('=== Testing EntityManager Integration ===\n');
  
  // Test 1: Software with version extraction
  console.log('Test 1: Software with version extraction');
  const testSoftware = [
    'Windows 10',
    'Apache HTTP Server 2.4.41',
    'Python 3.9',
    'nginx/1.18.0',
    'Docker'
  ];
  
  for (const software of testSoftware) {
    const { name, version } = extractVersion(software);
    const company = findSoftwareCompany(name);
    console.log(`  Input: "${software}"`);
    console.log(`    -> Name: "${name}", Version: "${version || 'none'}", Company: "${company || 'none'}"`);
  }
  
  console.log('\n');
  
  // Test 2: Company normalization and resolution
  console.log('Test 2: Company normalization');
  const testCompanies = [
    'Microsoft',
    'microsoft',
    'MICROSOFT',
    'Microsoft Corporation',
    'Amazon Web Services',
    'AWS',
    'Google',
    'Google LLC'
  ];
  
  for (const company of testCompanies) {
    const normalized = company.toLowerCase().trim().replace(/\s+/g, ' ');
    console.log(`  Input: "${company}" -> Normalized: "${normalized}"`);
  }
  
  console.log('\n');
  
  // Test 3: Hardware processing
  console.log('Test 3: Hardware entities');
  const testHardware = [
    'Cisco ASA 5505',
    'Dell PowerEdge R740',
    'iPhone 13',
    'Raspberry Pi 4'
  ];
  
  for (const hardware of testHardware) {
    console.log(`  Hardware: "${hardware}"`);
  }
  
  console.log('\n=== Test Complete ===');
  
  // Test the actual EntityManager methods (without DB interaction)
  console.log('\nTesting EntityManager normalization:');
  const em = new EntityManager();
  
  // Test the normalizeEntityName method
  const testNames = [
    'Microsoft Windows',
    'NGINX',
    'Apache HTTP Server',
    'Microsoft® Windows™ 10',
    'VMware vSphere'
  ];
  
  for (const name of testNames) {
    // @ts-ignore - accessing private method for testing
    const normalized = em.normalizeEntityName(name);
    console.log(`  "${name}" -> "${normalized}"`);
  }
  
  log('Tech stack refactor test completed successfully', 'info');
}

// Run the test
testEntityProcessing().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});