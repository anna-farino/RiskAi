/**
 * Test the actual scraping system to verify the contextual preservation fix works end-to-end
 */

async function testActualScrapingFix() {
  console.log('🚀 Testing actual scraping system with contextual preservation fix...');
  
  try {
    const response = await fetch('http://localhost:5000/api/sources/test-scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        url: 'https://foorilla.com/media/cybersecurity/',
        forceAdvanced: true // Force HTMX extraction method
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Scraping completed successfully:');
      console.log(`Method used: ${result.method || 'unknown'}`);
      console.log(`Links found: ${result.links?.length || 0}`);
      console.log(`Processing time: ${result.processingTime || 'unknown'}`);
      
      if (result.links && result.links.length > 0) {
        console.log('\n📄 First 5 extracted links:');
        result.links.slice(0, 5).forEach((link, index) => {
          console.log(`${index + 1}. "${link.text}"`);
          console.log(`   URL: ${link.href}`);
          console.log('');
        });
        
        // Check if we got the expected first result
        const firstLink = result.links[0];
        if (firstLink.text.includes('Bert') && firstLink.text.includes('Linux')) {
          console.log('✅ SUCCESS: First result is the expected cybersecurity article "Bert Blitzes Linux & Windows Systems"');
          console.log('✅ Contextual preservation fix is working correctly!');
        } else {
          console.log('❌ ISSUE: First result is not the expected cybersecurity article');
          console.log(`Expected: "Bert Blitzes Linux & Windows Systems"`);
          console.log(`Got: "${firstLink.text}"`);
        }
      } else {
        console.log('❌ No links found in response');
      }
      
    } else {
      const errorText = await response.text();
      console.log(`❌ Scraping failed with status ${response.status}: ${errorText}`);
    }
    
  } catch (error) {
    console.log(`💥 Request failed: ${error.message}`);
    console.log('Make sure the server is running on localhost:5000');
  }
}

testActualScrapingFix();