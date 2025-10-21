// Test script to verify URL validation is working correctly
const { validateAndNormalizeUrl } = require('./backend/apps/threat-tracker/services/url-utils');

// Test cases
const testUrls = [
  {
    input: 'https://www.bleepingcomputer.com/news/microsoft/microsoft-september-2025-windows-server-updates-cause-active-directory-issues/',
    expected: 'Keep original (correct URL)',
    description: 'Normal URL with "microsoft" appearing twice naturally'
  },
  {
    input: 'https://example.com/news/tech/tech-news-today',
    expected: 'Keep original (duplicate segments but valid)',
    description: 'URL with repeated "tech" segment'
  },
  {
    input: 'https://example.com/article?utm_source=twitter&utm_campaign=social',
    expected: 'Remove tracking params',
    description: 'URL with tracking parameters'
  },
  {
    input: 'https://example.com/page#section',
    expected: 'Remove hash fragment',
    description: 'URL with hash fragment'
  },
  {
    input: 'https://example.com/page/',
    expected: 'Remove trailing slash',
    description: 'URL with trailing slash'
  }
];

console.log('Testing URL validation and normalization:\n');
console.log('=' .repeat(80));

testUrls.forEach(test => {
  console.log(`\nTest: ${test.description}`);
  console.log(`Input:    ${test.input}`);
  
  const result = validateAndNormalizeUrl(test.input);
  
  console.log(`Output:   ${result}`);
  console.log(`Expected: ${test.expected}`);
  console.log(`Status:   ${result === test.input ? 'Original preserved' : 'Normalized'}`);
  console.log('-'.repeat(80));
});

console.log('\nTest complete!');