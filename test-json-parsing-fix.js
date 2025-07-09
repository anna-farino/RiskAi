const { extractContentWithAI } = require('./backend/services/scraping/extractors/structure-detector/ai-detector');

// Test HTML with problematic content containing quotes
const testHtml = `
<html>
<body>
<h1>AM Best Places Credit Ratings of Granular Insurance Company Under Review With Positive Implications</h1>
<p>FOR IMMEDIATE RELEASE</p>
<p>OLDWICK, N.J. - JULY 09, 2025 01:47 PM (EDT)</p>
<p>AM Best has placed under review with positive implications the Financial Strength Rating of A- (Excellent) and the Long-Term Issuer Credit Rating of "a-" (Excellent) of Granular Insurance Company (Granular) (Charleston, SC).</p>
<p>The actions on these Credit Ratings (ratings) are due to the completion of Granular's acquisition by Elevance Health, Inc. (Elevance) in April 2025.</p>
<p>CONTACTS: 
Anna Smith, Senior Financial Analyst
(908) 439-2200, ext. 5456</p>
</body>
</html>
`;

async function testJsonParsing() {
  try {
    console.log('Testing AI content extraction with problematic quotes...');
    
    const result = await extractContentWithAI(testHtml, 'https://news.ambest.com/PressContent.aspx?altsrc=2&refnum=36196');
    
    console.log('\nExtraction Results:');
    console.log('Title:', result.title);
    console.log('Author:', result.author);
    console.log('Date:', result.date);
    console.log('Content length:', result.content?.length || 0);
    console.log('Confidence:', result.confidence);
    
    // Check if the problematic content was handled
    if (result.content && result.content.includes('"a-"')) {
      console.log('\n✓ Successfully extracted content with quotes!');
    }
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run if OpenAI key is available
if (process.env.OPENAI_API_KEY) {
  testJsonParsing();
} else {
  console.log('Skipping test - OPENAI_API_KEY not set');
}