/**
 * Generate fallback selectors for common elements
 * Based on fallback hierarchies from both apps
 */
export function generateFallbackSelectors(
  elementType: "title" | "content" | "author" | "date",
): string[] {
  const fallbacks = {
    title: [
      "h1",
      ".article-title",
      ".post-title",
      ".headline",
      ".title",
      "h1.title",
      "h1.headline",
      ".entry-title",
    ],
    content: [
      ".press-release p",
      ".press-content p",
      "article",
      ".article-content",
      ".article-body",
      "main .content",
      ".post-content",
      "#article-content",
      ".story-content",
      ".entry-content",
      "main",
      ".main-content",
      "#main-content",
      ".content p",
      ".text-content p",
      ".body-content p",
      ".press-body p",
      ".news-content p",
      ".release-content p",
    ],
    author: [
      ".author",
      ".byline",
      ".article-author",
      ".post-author",
      ".writer",
      ".by-author",
      ".author-name",
      '[rel="author"]',
      '[rel*="author"]',  // Matches rel="author external" etc.
      ".date a[href*='author']",  // Author links within date elements
      ".date a[rel*='author']",  // Author links with rel attribute in date
      "p.date a",  // Any link within date paragraph
      ".posted-by",
      ".written-by",
      ".article-meta a",
      ".post-meta a",
      "a[href*='/author/']",  // Links to author pages
      "a[href*='/writers/']",  // Links to writer pages
      ".attribution a",
      ".credits a"
    ],
    date: [
      "time",
      "[datetime]",
      ".article-date",
      ".post-date",
      ".published-date",
      ".timestamp",
      ".date",
      ".publish-date",
      ".created-date",
    ],
  };

  return fallbacks[elementType] || [];
}
