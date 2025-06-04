/**
 * Test file for the date extraction functionality
 * This will help verify our date extraction improvements are working correctly
 */

import { extractPublishDate, separateDateFromAuthor } from './date-extractor';

// Test HTML samples with various date formats
const testHtmlSamples = [
  {
    name: "Standard time element",
    html: `<article>
      <h1>Test Article</h1>
      <time datetime="2024-01-15T10:30:00Z">January 15, 2024</time>
      <p>Article content here...</p>
    </article>`,
    expectedDate: "2024-01-15"
  },
  {
    name: "Meta tag date",
    html: `<html>
      <head>
        <meta property="article:published_time" content="2024-02-20T14:45:00Z" />
      </head>
      <body>
        <h1>Test Article</h1>
        <p>Content...</p>
      </body>
    </html>`,
    expectedDate: "2024-02-20"
  },
  {
    name: "JSON-LD structured data",
    html: `<html>
      <head>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Article",
          "headline": "Test Article",
          "datePublished": "2024-03-10T09:15:00Z",
          "author": {
            "@type": "Person",
            "name": "John Doe"
          }
        }
        </script>
      </head>
      <body>
        <h1>Test Article</h1>
        <p>Content...</p>
      </body>
    </html>`,
    expectedDate: "2024-03-10"
  },
  {
    name: "Date in class element",
    html: `<article>
      <h1>Test Article</h1>
      <div class="article-meta">
        <span class="publish-date">March 25, 2024</span>
        <span class="author">Jane Smith</span>
      </div>
      <p>Article content...</p>
    </article>`,
    expectedDate: "2024-03-25"
  },
  {
    name: "Mixed date and author",
    html: `<article>
      <h1>Test Article</h1>
      <div class="byline">By John Doe - April 5, 2024</div>
      <p>Article content...</p>
    </article>`,
    expectedDate: "2024-04-05"
  }
];

// Test the separateDateFromAuthor function
const testSeparations = [
  {
    input: "By John Doe - January 15, 2024",
    expectedAuthor: "John Doe",
    expectedDate: "January 15, 2024"
  },
  {
    input: "Jane Smith | March 10, 2024",
    expectedAuthor: "Jane Smith",
    expectedDate: "March 10, 2024"
  },
  {
    input: "2024-01-20 | Tech Reporter",
    expectedAuthor: "Tech Reporter", 
    expectedDate: "2024-01-20"
  },
  {
    input: "John Doe",
    expectedAuthor: "John Doe",
    expectedDate: null
  }
];

export async function runDateExtractionTests() {
  console.log("🧪 Running Date Extraction Tests...");
  
  let passed = 0;
  let total = 0;
  
  // Test HTML date extraction
  console.log("\n📅 Testing HTML Date Extraction:");
  for (const test of testHtmlSamples) {
    total++;
    try {
      const extractedDate = await extractPublishDate(test.html);
      const extractedDateStr = extractedDate?.toISOString().split('T')[0];
      
      if (extractedDateStr === test.expectedDate) {
        console.log(`✅ ${test.name}: Found ${extractedDateStr}`);
        passed++;
      } else {
        console.log(`❌ ${test.name}: Expected ${test.expectedDate}, got ${extractedDateStr}`);
      }
    } catch (error) {
      console.log(`❌ ${test.name}: Error - ${error}`);
    }
  }
  
  // Test date/author separation
  console.log("\n👤 Testing Date/Author Separation:");
  for (const test of testSeparations) {
    total++;
    try {
      const result = separateDateFromAuthor(test.input);
      
      const authorMatch = result.author === test.expectedAuthor;
      const dateMatch = result.date === test.expectedDate;
      
      if (authorMatch && dateMatch) {
        console.log(`✅ "${test.input}": Author="${result.author}", Date="${result.date}"`);
        passed++;
      } else {
        console.log(`❌ "${test.input}": Expected Author="${test.expectedAuthor}", Date="${test.expectedDate}", Got Author="${result.author}", Date="${result.date}"`);
      }
    } catch (error) {
      console.log(`❌ "${test.input}": Error - ${error}`);
    }
  }
  
  console.log(`\n📊 Test Results: ${passed}/${total} tests passed (${Math.round(passed/total*100)}%)`);
  
  return { passed, total, success: passed === total };
}