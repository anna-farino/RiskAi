/**
 * Debug regex pattern for URL extraction
 */

const testCases = [
  {
    name: 'Complete with closing bracket',
    content: '"https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://example.com/article"]'
  },
  {
    name: 'Incomplete without closing bracket',
    content: '"https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://example.com/article"'
  },
  {
    name: 'One complete, one truncated',
    content: '"https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-p"'
  }
];

console.log('Testing regex patterns for URL extraction:\n');

testCases.forEach((testCase, index) => {
  console.log(`Test ${index + 1}: ${testCase.name}`);
  console.log(`Content: ${testCase.content}`);
  
  // Test different regex patterns
  const patterns = [
    { name: 'Original', pattern: /"https?:\/\/[^"]*"/g },
    { name: 'Improved', pattern: /"https?:\/\/[^"]*"?/g },
    { name: 'More flexible', pattern: /"?(https?:\/\/[^"\s,\]]*)"?/g },
    { name: 'Very flexible', pattern: /https?:\/\/[^\s,\]"]*/g }
  ];
  
  patterns.forEach(patternTest => {
    const matches = testCase.content.match(patternTest.pattern) || [];
    console.log(`  ${patternTest.name}: Found ${matches.length} URLs`);
    matches.forEach((match, i) => {
      console.log(`    ${i + 1}. ${match}`);
    });
  });
  
  console.log('');
});