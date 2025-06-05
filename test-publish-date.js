const { extractPublishDate } = require('./backend/apps/news-radar/services/openai.ts');
const dotenv = require('dotenv');

dotenv.config();

// Test article content with clear publish date
const testArticle = {
  title: "Breaking: Tech Company Announces Major Security Update",
  content: `
    Published on December 15, 2024
    
    By John Smith, Tech Reporter
    
    In a major announcement today, TechCorp revealed significant security improvements to their platform. The company stated that these updates will enhance user protection and address recent vulnerabilities.
    
    "We are committed to keeping our users safe," said CEO Jane Doe during the press conference held this morning.
    
    The update will be rolled out gradually over the next two weeks, starting with enterprise customers on December 20, 2024.
  `,
  htmlContent: `
    <article>
      <header>
        <h1>Breaking: Tech Company Announces Major Security Update</h1>
        <div class="article-meta">
          <span class="author">By John Smith</span>
          <time datetime="2024-12-15">December 15, 2024</time>
        </div>
      </header>
      <div class="content">
        <p>In a major announcement today, TechCorp revealed significant security improvements...</p>
      </div>
    </article>
  `
};

async function testPublishDateExtraction() {
  console.log('Testing publish date extraction...');
  
  try {
    const publishDate = await extractPublishDate(
      testArticle.content,
      testArticle.title,
      testArticle.htmlContent
    );
    
    if (publishDate) {
      console.log('✓ Successfully extracted publish date:', publishDate.toISOString());
      console.log('✓ Date formatted:', publishDate.toDateString());
      
      // Verify it's the correct date (December 15, 2024)
      if (publishDate.getFullYear() === 2024 && 
          publishDate.getMonth() === 11 && // December is month 11 (0-based)
          publishDate.getDate() === 15) {
        console.log('✓ Extracted date is correct: December 15, 2024');
      } else {
        console.log('✗ Extracted date is incorrect');
      }
    } else {
      console.log('✗ Failed to extract publish date');
    }
  } catch (error) {
    console.error('✗ Error during extraction:', error.message);
  }
}

// Test with article that has no clear date
const testArticleNoDate = {
  title: "General Technology News",
  content: `
    Technology continues to evolve rapidly. Companies are investing heavily in AI and machine learning.
    
    The industry has seen significant growth over the past decade. Many experts predict continued expansion.
    
    Security remains a top priority for organizations worldwide.
  `,
  htmlContent: `<article><h1>General Technology News</h1><p>Technology continues to evolve...</p></article>`
};

async function testNoDateExtraction() {
  console.log('\nTesting article with no clear publish date...');
  
  try {
    const publishDate = await extractPublishDate(
      testArticleNoDate.content,
      testArticleNoDate.title,
      testArticleNoDate.htmlContent
    );
    
    if (publishDate === null) {
      console.log('✓ Correctly returned null for article with no date');
    } else {
      console.log('✗ Should have returned null but got:', publishDate);
    }
  } catch (error) {
    console.error('✗ Error during extraction:', error.message);
  }
}

async function runTests() {
  console.log('=== Publish Date Extraction Tests ===\n');
  
  if (!process.env.OPENAI_API_KEY) {
    console.error('✗ OPENAI_API_KEY not found in environment variables');
    console.log('Please set your OpenAI API key to run this test');
    return;
  }
  
  await testPublishDateExtraction();
  await testNoDateExtraction();
  
  console.log('\n=== Tests Complete ===');
}

runTests().catch(console.error);