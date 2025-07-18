import { Request, Response } from 'express';


export async function testDatadomeBypass(req: Request, res: Response) {
  try {
    console.log('[TEST] Starting DataDome bypass test...');
    
    const { performTLSRequest, detectBotProtection } = await import('../services/scraping/core/protection-bypass');
    
    const testUrl = req.query.url || 'https://www.marketwatch.com/investing/stock/aapl';
    console.log(`[TEST] Testing URL: ${testUrl}`);
    
    // First, let's do a basic fetch to see what protection we're dealing with
    try {
      console.log('[TEST] Performing initial fetch to detect protection...');
      const initialResponse = await fetch(testUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
        }
      });
      const initialHtml = await initialResponse.text();
      const protection = detectBotProtection(initialHtml);
      console.log('[TEST] Protection detected:', protection);
    } catch (fetchError: any) {
      console.log('[TEST] Initial fetch error:', fetchError.message);
    }
    
    console.log('[TEST] Now attempting TLS fingerprinted request...');
    
    // Add timeout to prevent hanging
    const timeoutPromise = new Promise<string>((_, reject) => 
      setTimeout(() => reject(new Error('TLS request timed out after 10 seconds')), 10000)
    );
    
    const content = await Promise.race([
      performTLSRequest(testUrl as string),
      timeoutPromise
    ]) as string;
    console.log('[TEST] TLS request completed');
    
    if (!content) {
      console.log('[TEST] No content returned from TLS request');
      res.json({
        success: false,
        error: 'No content returned from TLS request',
        contentLength: 0,
        testUrl
      });
      return;
    }
    
    console.log(`[TEST] TLS request returned content: ${content.length} chars`);
    
    // Check for DataDome indicators
    const hasDataDome = content.includes('datadome') || content.includes('captcha-delivery');
    const hasTitle = content.includes('<title>') && content.includes('</title>');
    const hasContent = content.length > 1000;
    
    // Extract title if present
    const titleMatch = content.match(/<title>(.*?)<\/title>/);
    const title = titleMatch ? titleMatch[1] : 'No title found';
    
    res.json({
      success: !hasDataDome && hasContent,
      contentLength: content.length,
      hasDataDome,
      hasTitle,
      pageTitle: title,
      testUrl,
      bypassMethod: 'TLS Fingerprinting (CycleTLS)',
      // Include the actual content if it's small to debug
      actualContent: content.length < 1000 ? content : content.substring(0, 500) + '...'
    });
  } catch (error: any) {
    console.error('[TEST] Error in test endpoint:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack,
      testUrl: req.query.url || 'https://www.marketwatch.com/investing/stock/aapl'
    });
  }
}
