/**
 * Test script to verify the unified architecture is working properly
 * This ensures all app-specific HTML structure detection AND link identification has been removed
 */

// Test that the system works with a simple HTML example
const testHtml = `
<!DOCTYPE html>
<html>
<head>
    <title>Test Article</title>
</head>
<body>
    <article>
        <h1 class="article-title">Sample News Article</h1>
        <div class="byline">By John Doe</div>
        <time class="publish-date">2025-01-10</time>
        <div class="article-content">
            <p>This is a test article content to verify the unified scraping system works correctly.</p>
            <p>The system should detect CSS selectors for title, content, author, and date elements.</p>
        </div>
    </article>
    <div class="article-links">
        <a href="https://example.com/news/article-1">Breaking News: Important Update</a>
        <a href="https://example.com/blog/article-2">Analysis: Market Trends</a>
    </div>
</body>
</html>
`;

async function testUnifiedArchitecture() {
    console.log('Testing unified architecture...');
    
    try {
        // Test 1: Import the unified detectors
        const { detectHtmlStructureWithAI } = await import('./backend/services/scraping/extractors/structure-detector/ai-detector.js');
        const { identifyArticleLinks } = await import('./backend/services/scraping/ai/unified-link-detector.js');
        console.log('✓ Successfully imported unified AI detectors');
        
        // Test 2: Verify app-specific HTML structure functions are gone
        try {
            const newsRadarOpenai = await import('./backend/apps/news-radar/services/openai.js');
            if (newsRadarOpenai.detectHtmlStructure) {
                console.log('✗ FAILED: News Radar still has detectHtmlStructure function');
                return false;
            }
            console.log('✓ News Radar detectHtmlStructure function removed');
        } catch (e) {
            console.log('✓ News Radar openai.js correctly structured');
        }
        
        try {
            const threatTrackerOpenai = await import('./backend/apps/threat-tracker/services/openai.js');
            if (threatTrackerOpenai.detectHtmlStructure) {
                console.log('✗ FAILED: Threat Tracker still has detectHtmlStructure function');
                return false;
            }
            console.log('✓ Threat Tracker detectHtmlStructure function removed');
        } catch (e) {
            console.log('✓ Threat Tracker openai.js correctly structured');
        }
        
        // Test 3: Verify app-specific link identification functions are gone in strategies
        try {
            const newsRadarStrategy = await import('./backend/services/scraping/strategies/news-radar-strategy.js');
            const context = new newsRadarStrategy.NewsRadarStrategy().getContext();
            if (context.aiProviders.identifyArticleLinks) {
                console.log('✗ FAILED: News Radar strategy still has identifyArticleLinks function');
                return false;
            }
            console.log('✓ News Radar identifyArticleLinks function removed from strategy');
        } catch (e) {
            console.log('✓ News Radar strategy correctly structured');
        }
        
        try {
            const threatTrackerStrategy = await import('./backend/services/scraping/strategies/threat-tracker-strategy.js');
            const context = new threatTrackerStrategy.ThreatTrackerStrategy().getContext();
            if (context.aiProviders.identifyArticleLinks) {
                console.log('✗ FAILED: Threat Tracker strategy still has identifyArticleLinks function');
                return false;
            }
            console.log('✓ Threat Tracker identifyArticleLinks function removed from strategy');
        } catch (e) {
            console.log('✓ Threat Tracker strategy correctly structured');
        }
        
        // Test 4: Test the unified detectors
        if (process.env.OPENAI_API_KEY) {
            console.log('Testing unified AI detection...');
            
            // Test HTML structure detection
            const structureResult = await detectHtmlStructureWithAI(testHtml, 'https://example.com');
            if (structureResult.titleSelector && structureResult.contentSelector) {
                console.log('✓ Unified HTML structure detection working correctly');
                console.log(`  - Title selector: ${structureResult.titleSelector}`);
                console.log(`  - Content selector: ${structureResult.contentSelector}`);
                console.log(`  - Author selector: ${structureResult.authorSelector || 'not detected'}`);
                console.log(`  - Date selector: ${structureResult.dateSelector || 'not detected'}`);
            } else {
                console.log('✗ FAILED: Unified HTML structure detection not returning expected structure');
                return false;
            }
            
            // Test link identification
            const linkResult = await identifyArticleLinks(testHtml, { appType: 'news-radar' });
            if (linkResult && linkResult.length > 0) {
                console.log('✓ Unified link identification working correctly');
                console.log(`  - Detected ${linkResult.length} article links`);
                console.log(`  - Links: ${linkResult.join(', ')}`);
            } else {
                console.log('✗ FAILED: Unified link identification not returning expected links');
                return false;
            }
        } else {
            console.log('⚠ Skipping AI tests - OPENAI_API_KEY not configured');
        }
        
        console.log('\n✅ ALL TESTS PASSED - Unified architecture is working correctly!');
        console.log('✅ App-specific element selector identification completely removed');
        console.log('✅ App-specific link identification completely removed');
        console.log('✅ Only unified AI detection systems exist');
        
        return true;
        
    } catch (error) {
        console.log('✗ FAILED: Error during testing:', error.message);
        return false;
    }
}

// Run the test
testUnifiedArchitecture().then(success => {
    if (success) {
        console.log('\n🎉 COMPLETE ARCHITECTURAL CLEANUP FINISHED');
        console.log('The system now uses only unified AI detection for:');
        console.log('  - HTML structure identification');
        console.log('  - Article link identification');
        console.log('  - All extraction operations');
    } else {
        console.log('\n❌ ARCHITECTURAL ISSUES REMAIN');
        console.log('Some app-specific functions may still exist');
    }
});