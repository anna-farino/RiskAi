import type { Page } from 'puppeteer';
import { log } from "backend/utils/log";

/**
 * Handle dynamic content loading through scrolling
 * Triggers lazy loading and infinite scroll mechanisms
 */
export async function handleDynamicContent(page: Page): Promise<void> {
  try {
    log(`[PuppeteerScraper] Handling dynamic content loading`, "scraper");

    // Progressive scrolling to trigger lazy loading
    const scrollSteps = [
      { position: 0.25, wait: 1000 },
      { position: 0.5, wait: 1500 },
      { position: 0.75, wait: 1500 },
      { position: 1.0, wait: 2000 }
    ];

    for (const step of scrollSteps) {
      await page.evaluate((position) => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollTo(0, scrollHeight * position);
      }, step.position);

      log(`[PuppeteerScraper] Scrolled to ${(step.position * 100)}% of page`, "scraper");
      await new Promise(resolve => setTimeout(resolve, step.wait));
    }

    // Check for infinite scroll triggers
    const hasInfiniteScroll = await page.evaluate(() => {
      const indicators = [
        'infinite-scroll',
        'load-more',
        'next-page',
        'pagination',
        'lazy-load'
      ];
      
      return indicators.some(indicator => 
        document.querySelector(`[class*="${indicator}"]`) !== null ||
        document.querySelector(`[data-${indicator}]`) !== null
      );
    });

    if (hasInfiniteScroll) {
      log(`[PuppeteerScraper] Infinite scroll detected, triggering additional loading`, "scraper");
      
      // Additional scrolling for infinite scroll
      for (let i = 0; i < 3; i++) {
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Scroll back to top for consistent navigation
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error: any) {
    log(`[PuppeteerScraper] Error handling dynamic content: ${error.message}`, "scraper-error");
  }
}