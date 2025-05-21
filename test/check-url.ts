
import { scrapeUrl } from '../backend/apps/threat-tracker/services/scraper';

async function checkUrl() {
  try {
    console.log('Fetching HTML source...');
    const html = await scrapeUrl('https://foojobs.com/media/cybersecurity/', false);
    console.log('\nHTML Content:');
    console.log('----------------------------------------');
    console.log(html);
    console.log('----------------------------------------');
  } catch (error) {
    console.error('Error fetching URL:', error);
  }
}

checkUrl();
