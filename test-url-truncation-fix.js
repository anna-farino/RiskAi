/**
 * Test to verify URL truncation fix in OpenAI JSON recovery
 */

// Test the JSON recovery logic directly
function testJsonRecovery() {
  console.log('Testing JSON recovery logic for URL truncation fix...\n');
  
  // Simulate truncated OpenAI responses
  const testCases = [
    {
      name: 'Complete JSON',
      response: '{"articleUrls": ["https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://example.com/article"]}',
      expectedUrls: 2
    },
    {
      name: 'Truncated JSON - complete URLs',
      response: '{"articleUrls": ["https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://example.com/article"',
      expectedUrls: 2
    },
    {
      name: 'Truncated JSON - one complete, one incomplete',
      response: '{"articleUrls": ["https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection", "https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-p"',
      expectedUrls: 1 // Should only include the complete URL
    },
    {
      name: 'Truncated with suspicious ending',
      response: '{"articleUrls": ["https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-p", "https://example.com/full-article"',
      expectedUrls: 1 // Should exclude the truncated one ending with 'p'
    }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`Test ${index + 1}: ${testCase.name}`);
    console.log(`Input: ${testCase.response}`);
    
    try {
      // Apply the same logic as the fixed code
      let result;
      try {
        result = JSON.parse(testCase.response);
      } catch (parseError) {
        // Try to extract valid JSON from truncated response with better URL preservation
        let jsonMatch = testCase.response.match(/\{.*"articleUrls"\s*:\s*\[(.*)\]/s);
        if (!jsonMatch) {
          // If complete array not found, try to find partial array and extract complete URLs
          jsonMatch = testCase.response.match(/\{.*"articleUrls"\s*:\s*\[(.*)/s);
          if (jsonMatch) {
            // Extract complete URLs from the partial array content
            const partialContent = jsonMatch[1];
            const urlMatches = partialContent.match(/"https?:\/\/[^"]*"?/g) || [];
            
            // Only include complete URLs (no truncated ones)
            const completeUrls = urlMatches.filter(url => {
              // Clean the URL string (remove quotes, handle incomplete quotes)
              let cleanUrl = url;
              if (cleanUrl.startsWith('"')) cleanUrl = cleanUrl.slice(1);
              if (cleanUrl.endsWith('"')) cleanUrl = cleanUrl.slice(0, -1);
              
              // Basic length check
              if (cleanUrl.length < 10) return false;
              
              // Check if URL looks complete (not truncated)
              // URLs ending with these patterns are likely complete
              if (cleanUrl.endsWith('/') || 
                  cleanUrl.includes('?') ||
                  cleanUrl.includes('#') ||
                  cleanUrl.match(/\.(html|php|aspx|jsp)$/)) {
                return true;
              }
              
              // Avoid URLs that look truncated (ending with single letter, dash, or common truncation patterns)
              if (cleanUrl.endsWith('-') || 
                  cleanUrl.match(/[a-z]$/) ||
                  cleanUrl.match(/-[a-z]{1,2}$/)) {
                return false;
              }
              
              // If URL is reasonably long and doesn't show truncation patterns, include it
              return cleanUrl.length > 30;
            });
            
            if (completeUrls.length > 0) {
              try {
                const reconstructedJson = `{"articleUrls": [${completeUrls.join(',')}]}`;
                result = JSON.parse(reconstructedJson);
                console.log(`Recovered ${completeUrls.length} complete URLs from truncated JSON`);
              } catch (recoveryError) {
                console.log(`JSON reconstruction failed`);
                result = { articleUrls: [] };
              }
            } else {
              console.log(`No complete URLs found in truncated response`);
              result = { articleUrls: [] };
            }
          } else {
            console.log(`Could not find articleUrls array in response`);
            result = { articleUrls: [] };
          }
        } else {
          try {
            const partialJson = jsonMatch[0] + '}';
            result = JSON.parse(partialJson);
            console.log(`Recovered from complete JSON match`);
          } catch (recoveryError) {
            console.log(`JSON recovery from complete match failed`);
            result = { articleUrls: [] };
          }
        }
      }
      
      const actualUrls = result.articleUrls ? result.articleUrls.length : 0;
      console.log(`Expected: ${testCase.expectedUrls} URLs, Got: ${actualUrls} URLs`);
      
      if (result.articleUrls && result.articleUrls.length > 0) {
        console.log('Recovered URLs:');
        result.articleUrls.forEach((url, i) => {
          console.log(`  ${i + 1}. ${url} (${url.length} chars)`);
        });
      }
      
      const passed = actualUrls === testCase.expectedUrls;
      console.log(`Result: ${passed ? 'PASS' : 'FAIL'}\n`);
      
    } catch (error) {
      console.log(`Error: ${error.message}\n`);
    }
  });
  
  console.log('JSON recovery testing complete!');
}

testJsonRecovery();