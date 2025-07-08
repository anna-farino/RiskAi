        const externalArticleUrls = await page.evaluate((currentBaseUrl) => {
          const articleUrls = [];
          const currentDomain = new URL(currentBaseUrl).hostname;
          
          // PRIORITY 1: Check existing .stretched-link articles (analysis shows 93 are already loaded)
          const existingArticles = document.querySelectorAll('.stretched-link');
          console.log(`Found ${existingArticles.length} existing articles already loaded on page`);
          
          if (existingArticles.length > 0) {
            console.log(`Processing existing cybersecurity articles (highest priority)...`);
            existingArticles.forEach((element, index) => {
              if (index < 50) { // Limit to prevent overwhelming results
                const text = element.textContent?.trim() || '';
                
                // Skip elements with too little text
                if (!text || text.length < 10) return;
                
                console.log(`Processing article ${index + 1}: "${text.substring(0, 50)}..."`);
                
                // Look for multiple potential URL sources
                let articleUrl = null;
                
                // 1. Check HTMX attributes first (this is how Foorilla works)
                const hxGet = element.getAttribute('hx-get') || element.getAttribute('data-hx-get');
                if (hxGet && hxGet.length > 5) {
                  articleUrl = hxGet.startsWith('http') ? hxGet : 
                    (hxGet.startsWith('/') ? `${currentBaseUrl}${hxGet}` : `${currentBaseUrl}/${hxGet}`);
                  console.log(`Found HTMX URL from hx-get: ${hxGet} → ${articleUrl}`);
                }
                
                // 2. Check standard href attribute as fallback
                if (!articleUrl) {
                  const href = element.getAttribute('href');
                  if (href && href.length > 5 && href !== '#' && !href.startsWith('javascript:')) {
                    articleUrl = href.startsWith('http') ? href : 
                      (href.startsWith('/') ? `${currentBaseUrl}${href}` : `${currentBaseUrl}/${href}`);
                  }
                }
                
                // 3. Check data attributes for URLs
                if (!articleUrl) {
                  const dataAttributes = ['data-url', 'data-link', 'data-href', 'data-target', 'data-article-url'];
                  for (const attr of dataAttributes) {
                    const dataUrl = element.getAttribute(attr);
                    if (dataUrl && dataUrl.length > 5) {
                      articleUrl = dataUrl.startsWith('http') ? dataUrl : 
                        (dataUrl.startsWith('/') ? `${currentBaseUrl}${dataUrl}` : `${currentBaseUrl}/${dataUrl}`);
                      break;
                    }
                  }
                }
                
                // If we found a URL, validate and add it
                if (articleUrl) {
                  try {
                    const urlObj = new URL(articleUrl);
                    const hostname = urlObj.hostname.toLowerCase();
                    
                    console.log(`Found cybersecurity article URL: ${articleUrl} ("${text.substring(0, 50)}...")`);
                    articleUrls.push({
                      url: articleUrl,
                      text: text,
                      source: 'cybersecurity-page-content',
                      hostname: hostname,
                      isExternal: hostname !== currentDomain,
                      priority: 'high'
                    });
                    
                  } catch (error) {
                    console.error(`Invalid URL found: ${articleUrl}`);
                  }
                } else {
                  console.log(`No URL found for article: "${text.substring(0, 50)}..."`);
                }
              }
            });
          }
          
          return articleUrls;
        }, currentBaseUrl);