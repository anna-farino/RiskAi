/**
 * Test script to verify the "null" string selector fix
 */

import { sanitizeSelector } from './backend/services/scraping/extractors/structure-detector/selector-sanitizer.ts';

function testNullSelectorFix() {
  console.log('=== Testing "null" String Selector Fix ===');
  
  const testCases = [
    { input: "null", expected: "", description: "String 'null' should return empty string" },
    { input: "NULL", expected: "", description: "String 'NULL' should return empty string" },
    { input: "Null", expected: "", description: "String 'Null' should return empty string" },
    { input: ".author", expected: ".author", description: "Valid selector should be preserved" },
    { input: "time[datetime]", expected: "time[datetime]", description: "Valid time selector should be preserved" },
    { input: "", expected: "", description: "Empty string should return empty string" },
    { input: "div.null", expected: "div.null", description: "Selector containing 'null' but not equal to 'null' should be preserved" }
  ];
  
  let passedTests = 0;
  let totalTests = testCases.length;
  
  testCases.forEach((testCase, index) => {
    try {
      const result = sanitizeSelector(testCase.input);
      const passed = result === testCase.expected;
      
      console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Expected: "${testCase.expected}"`);
      console.log(`  Got: "${result}"`);
      console.log(`  Description: ${testCase.description}`);
      console.log('');
      
      if (passed) passedTests++;
    } catch (error) {
      console.log(`Test ${index + 1}: ERROR`);
      console.log(`  Input: "${testCase.input}"`);
      console.log(`  Error: ${error.message}`);
      console.log('');
    }
  });
  
  console.log(`=== Results: ${passedTests}/${totalTests} tests passed ===`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed! The "null" string selector fix is working correctly.');
  } else {
    console.log('❌ Some tests failed. The fix may need additional work.');
  }
}

// Run the test
testNullSelectorFix();