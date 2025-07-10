import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';

async function testAuthorDetection() {
  const browser = await puppeteer.launch({ 
    headless: true, 
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  const page = await browser.newPage();
  
  try {
    console.log('Fetching page...');
    await page.goto('https://www.reinsurancene.ws/dovetailing-prospective-retrospective-solutions-the-best-use-of-legacy-jass-augment-risk/', { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const html = await page.content();
    const $ = cheerio.load(html);
    
    console.log('\n=== SEARCHING FOR AUTHOR ELEMENTS ===\n');
    
    // Search for elements with "By" text pattern
    const byElements = $('*:contains("By ")').filter((i, el) => {
      const text = $(el).text().trim();
      return text.match(/^By\s+[A-Z]/i) && text.length < 100 && $(el).children().length === 0;
    });
    
    console.log(`Found ${byElements.length} elements with "By" pattern:`);
    byElements.each((i, el) => {
      const tagName = el.tagName.toLowerCase();
      const classes = $(el).attr('class') || 'no-class';
      const text = $(el).text().trim();
      console.log(`  <${tagName}> class="${classes}" text="${text}"`);
    });
    
    // Search for unique author-related classes
    console.log('\n=== UNIQUE AUTHOR CLASSES ===\n');
    const uniqueClasses = new Set();
    
    $('[class]').each((i, el) => {
      const classes = $(el).attr('class') || '';
      const classArray = classes.split(/\s+/);
      
      classArray.forEach(cls => {
        if (cls.match(/author|byline|writer|contributor|creator|credit|attribution|posted|staff|user|editor|journalist/i)) {
          uniqueClasses.add(cls);
        }
      });
    });
    
    console.log('Found unique author-related classes:');
    Array.from(uniqueClasses).forEach(cls => {
      const elements = $(`.${cls}`);
      console.log(`  .${cls} - ${elements.length} element(s)`);
      elements.slice(0, 2).each((i, el) => {
        const text = $(el).text().trim().substring(0, 50);
        console.log(`    -> "${text}${text.length >= 50 ? '...' : ''}"`);
      });
    });
    
    // Check meta tags
    console.log('\n=== META AUTHOR TAGS ===\n');
    const metaAuthor = $('meta[name*="author"], meta[property*="author"], meta[name*="creator"]');
    metaAuthor.each((i, el) => {
      const name = $(el).attr('name') || $(el).attr('property');
      const content = $(el).attr('content');
      console.log(`  ${name} = "${content}"`);
    });
    
    // Check structured data
    console.log('\n=== STRUCTURED DATA ===\n');
    const jsonLd = $('script[type="application/ld+json"]');
    jsonLd.each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        if (data.author || data.creator) {
          console.log('  Found author in JSON-LD:', data.author || data.creator);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
}

testAuthorDetection().catch(console.error);