/**
 * Generate fallback selectors for common elements
 * Based on fallback hierarchies from both apps
 */
export function generateFallbackSelectors(elementType: 'title' | 'content' | 'author' | 'date'): string[] {
  const fallbacks = {
    title: [
      'h1',
      '.article-title',
      '.post-title',
      '.headline',
      '.title',
      'h1.title',
      'h1.headline',
      '.entry-title'
    ],
    content: [
      'article',
      '.article-content',
      '.article-body',
      'main .content',
      '.post-content',
      '#article-content',
      '.story-content',
      '.entry-content',
      'main',
      '.main-content',
      '#main-content'
    ],
    author: [
      '.author',
      '.byline',
      '.article-author',
      '.post-author',
      '.writer',
      '.by-author',
      '[rel="author"]'
    ],
    date: [
      'time',
      '[datetime]',
      '.article-date',
      '.post-date',
      '.published-date',
      '.timestamp',
      '.date',
      '.publish-date',
      '.created-date'
    ]
  };

  return fallbacks[elementType] || [];
}