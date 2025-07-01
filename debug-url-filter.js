/**
 * Debug URL filtering logic
 */

const testUrls = [
  'https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-protection', // 84 chars, ends with 'protection'
  'https://siliconangle.com/cybercrime-ai-and-the-rise-of-recoveryfirst-data-p', // 70 chars, ends with 'p'
  'https://example.com/full-article', // 32 chars, ends with 'article'
  'https://example.com/article' // 27 chars, ends with 'article'
];

function filterUrl(url) {
  // Clean the URL string (remove quotes, handle incomplete quotes)
  let cleanUrl = url;
  if (cleanUrl.startsWith('"')) cleanUrl = cleanUrl.slice(1);
  if (cleanUrl.endsWith('"')) cleanUrl = cleanUrl.slice(0, -1);
  
  console.log(`Testing URL: ${cleanUrl} (${cleanUrl.length} chars)`);
  
  // Basic length check
  if (cleanUrl.length < 10) {
    console.log(`  ❌ Failed length check (< 10)`);
    return false;
  }
  
  // Check if URL looks complete (not truncated)
  // URLs ending with these patterns are likely complete
  if (cleanUrl.endsWith('/') || 
      cleanUrl.includes('?') ||
      cleanUrl.includes('#') ||
      cleanUrl.match(/\.(html|php|aspx|jsp)$/)) {
    console.log(`  ✅ Passed special ending pattern check`);
    return true;
  }
  
  // Avoid URLs that look truncated (ending with single letter, dash, or common truncation patterns)
  if (cleanUrl.endsWith('-')) {
    console.log(`  ❌ Failed dash ending check`);
    return false;
  }
  
  if (cleanUrl.match(/[a-z]$/)) {
    console.log(`  ❌ Failed single letter ending check (ends with '${cleanUrl.slice(-1)}')`);
    return false;
  }
  
  if (cleanUrl.match(/-[a-z]{1,2}$/)) {
    console.log(`  ❌ Failed truncation pattern check`);
    return false;
  }
  
  // If URL is reasonably long and doesn't show truncation patterns, include it
  if (cleanUrl.length > 30) {
    console.log(`  ✅ Passed length check (> 30)`);
    return true;
  }
  
  console.log(`  ❌ Failed all checks`);
  return false;
}

console.log('Testing URL filtering logic:\n');

testUrls.forEach((url, index) => {
  console.log(`Test ${index + 1}:`);
  const result = filterUrl(url);
  console.log(`  Result: ${result ? 'ACCEPTED' : 'REJECTED'}\n`);
});