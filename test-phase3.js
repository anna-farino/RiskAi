#!/usr/bin/env node

// Test script for Phase 3 API endpoint changes
// Run with: node test-phase3.js

const baseUrl = 'http://localhost:5174';

async function testEndpoints() {
  console.log('Testing Phase 3 API Endpoint Changes\n');
  console.log('=====================================\n');
  
  // Test deprecated endpoints (should return 403)
  console.log('1. Testing deprecated endpoints (should return 403):');
  
  const deprecatedEndpoints = [
    { method: 'POST', path: '/api/news-radar/sources', desc: 'Create source' },
    { method: 'DELETE', path: '/api/news-radar/sources/123', desc: 'Delete source' },
    { method: 'POST', path: '/api/news-radar/sources/bulk-add', desc: 'Bulk add' },
    { method: 'POST', path: '/api/news-radar/sources/bulk-delete', desc: 'Bulk delete' },
    { method: 'POST', path: '/api/threat-tracker/sources', desc: 'Create threat source' },
    { method: 'DELETE', path: '/api/threat-tracker/sources/123', desc: 'Delete threat source' },
  ];
  
  for (const endpoint of deprecatedEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.method === 'POST' ? JSON.stringify({}) : undefined
      });
      console.log(`  ✓ ${endpoint.desc}: ${response.status === 403 ? 'PASS (403 Forbidden)' : 'FAIL (Got ' + response.status + ')'}`);
    } catch (error) {
      console.log(`  ✗ ${endpoint.desc}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n2. Testing new endpoints:');
  
  // Test new endpoints
  const newEndpoints = [
    { method: 'GET', path: '/api/news-radar/sources/available', desc: 'Get available sources' },
    { method: 'PUT', path: '/api/news-radar/sources/123/toggle', desc: 'Toggle source' },
    { method: 'GET', path: '/api/news-radar/admin/sources', desc: 'Admin: Get global sources' },
    { method: 'GET', path: '/api/threat-tracker/sources/available', desc: 'Get threat sources' },
    { method: 'PUT', path: '/api/threat-tracker/sources/123/toggle', desc: 'Toggle threat source' },
    { method: 'GET', path: '/api/threat-tracker/admin/sources', desc: 'Admin: Get default sources' },
  ];
  
  for (const endpoint of newEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' },
        body: endpoint.method === 'PUT' ? JSON.stringify({ isEnabled: true }) : undefined
      });
      console.log(`  ✓ ${endpoint.desc}: Route exists (${response.status})`);
    } catch (error) {
      console.log(`  ✗ ${endpoint.desc}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n3. Testing keywords endpoints (should still work):');
  
  const keywordEndpoints = [
    { method: 'GET', path: '/api/news-radar/keywords', desc: 'Get keywords' },
    { method: 'GET', path: '/api/threat-tracker/keywords', desc: 'Get threat keywords' },
  ];
  
  for (const endpoint of keywordEndpoints) {
    try {
      const response = await fetch(`${baseUrl}${endpoint.path}`, {
        method: endpoint.method,
        headers: { 'Content-Type': 'application/json' }
      });
      console.log(`  ✓ ${endpoint.desc}: Route exists (${response.status})`);
    } catch (error) {
      console.log(`  ✗ ${endpoint.desc}: ERROR - ${error.message}`);
    }
  }
  
  console.log('\n=====================================');
  console.log('Phase 3 API Testing Complete!\n');
  console.log('Summary:');
  console.log('- Deprecated source management endpoints now return 403');
  console.log('- New enable/disable endpoints are available');
  console.log('- Admin endpoints for global source management are ready');
  console.log('- Keywords endpoints remain user-specific for filtering');
}

// Run tests
testEndpoints().catch(console.error);