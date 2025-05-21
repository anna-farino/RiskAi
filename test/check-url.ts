
import { scrapeUrl } from '../backend/apps/threat-tracker/services/scraper';

async function checkUrl() {
  try {
    console.log('Fetching HTML source...');
    // Wait 5 seconds after initial page load to allow for dynamic content
    const html = await scrapeUrl('https://foojobs.com/media/cybersecurity/', false, {
      waitAfterLoad: 5000 // 5 second delay
    });
    console.log('\nHTML Content:');
    console.log('----------------------------------------');
    console.log(html);
    console.log('----------------------------------------');
  } catch (error) {
    console.error('Error fetching URL:', error);
  }
}

checkUrl();
