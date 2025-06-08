/**
 * Cookie-based article tracking utilities
 * Manages new article badges and viewed article state using browser cookies
 */

interface ArticleViewState {
  lastVisit: number;
  viewedArticles: string[];
}

const COOKIE_NAME = 'article_view_state';
const COOKIE_EXPIRY_DAYS = 30;

/**
 * Get the current article view state from cookies
 */
export function getArticleViewState(): ArticleViewState {
  try {
    const cookieValue = document.cookie
      .split('; ')
      .find(row => row.startsWith(`${COOKIE_NAME}=`))
      ?.split('=')[1];

    if (!cookieValue) {
      return {
        lastVisit: Date.now(),
        viewedArticles: []
      };
    }

    const decoded = decodeURIComponent(cookieValue);
    const parsed = JSON.parse(decoded);
    
    return {
      lastVisit: parsed.lastVisit || Date.now(),
      viewedArticles: Array.isArray(parsed.viewedArticles) ? parsed.viewedArticles : []
    };
  } catch (error) {
    console.warn('Failed to parse article view state from cookies:', error);
    return {
      lastVisit: Date.now(),
      viewedArticles: []
    };
  }
}

/**
 * Save article view state to cookies
 */
export function saveArticleViewState(state: ArticleViewState): void {
  try {
    const encoded = encodeURIComponent(JSON.stringify(state));
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + COOKIE_EXPIRY_DAYS);
    
    document.cookie = `${COOKIE_NAME}=${encoded}; expires=${expiryDate.toUTCString()}; path=/; SameSite=Lax`;
  } catch (error) {
    console.warn('Failed to save article view state to cookies:', error);
  }
}

/**
 * Update the last visit timestamp
 */
export function updateLastVisit(): void {
  const currentState = getArticleViewState();
  saveArticleViewState({
    ...currentState,
    lastVisit: Date.now()
  });
}

/**
 * Mark an article as viewed
 */
export function markArticleAsViewed(articleId: string): void {
  const currentState = getArticleViewState();
  
  // Add to viewed articles if not already present
  if (!currentState.viewedArticles.includes(articleId)) {
    const updatedViewedArticles = [...currentState.viewedArticles, articleId];
    
    // Keep only the last 1000 viewed articles to prevent cookie size issues
    if (updatedViewedArticles.length > 1000) {
      updatedViewedArticles.splice(0, updatedViewedArticles.length - 1000);
    }
    
    saveArticleViewState({
      ...currentState,
      viewedArticles: updatedViewedArticles
    });
  }
}

/**
 * Check if an article should be marked as "new"
 * An article is new if:
 * 1. It was published after the user's last visit, AND
 * 2. The user hasn't viewed it yet
 */
export function isArticleNew(article: { id: string; publishDate?: string | Date | null }): boolean {
  const state = getArticleViewState();
  
  // If article was already viewed, it's not new
  if (state.viewedArticles.includes(article.id)) {
    return false;
  }
  
  // If no publish date, consider it new if not viewed
  if (!article.publishDate) {
    return true;
  }
  
  try {
    const publishTime = new Date(article.publishDate).getTime();
    const now = Date.now();
    
    // For first-time users (no previous visit recorded), show articles from last 24 hours as new
    if (!state.lastVisit || state.lastVisit >= now) {
      const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
      return publishTime > twentyFourHoursAgo;
    }
    
    // For returning users, show articles published after their last visit
    return publishTime > state.lastVisit;
  } catch (error) {
    // If date parsing fails, default to showing as new if not viewed
    return true;
  }
}

/**
 * Get count of new articles
 */
export function getNewArticleCount(articles: Array<{ id: string; publishDate?: string | Date | null }>): number {
  return articles.filter(article => isArticleNew(article)).length;
}

/**
 * Mark all current articles as viewed (useful for "mark all as read" functionality)
 */
export function markAllArticlesAsViewed(articles: Array<{ id: string }>): void {
  const currentState = getArticleViewState();
  const allArticleIds = articles.map(article => article.id);
  
  // Merge with existing viewed articles
  const allViewedArticles = [...new Set([...currentState.viewedArticles, ...allArticleIds])];
  
  // Keep only the last 1000 viewed articles
  if (allViewedArticles.length > 1000) {
    allViewedArticles.splice(0, allViewedArticles.length - 1000);
  }
  
  saveArticleViewState({
    ...currentState,
    viewedArticles: allViewedArticles
  });
}

/**
 * Clear all article view state (useful for testing or reset functionality)
 */
export function clearArticleViewState(): void {
  document.cookie = `${COOKIE_NAME}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
}

/**
 * Hook for React components to use article view state
 */
export function useArticleViewState() {
  const getState = () => getArticleViewState();
  const markViewed = (articleId: string) => markArticleAsViewed(articleId);
  const updateVisit = () => updateLastVisit();
  const isNew = (article: { id: string; publishDate?: string | Date | null }) => isArticleNew(article);
  const getNewCount = (articles: Array<{ id: string; publishDate?: string | Date | null }>) => getNewArticleCount(articles);
  const markAllViewed = (articles: Array<{ id: string }>) => markAllArticlesAsViewed(articles);
  const clearState = () => clearArticleViewState();
  
  return {
    getState,
    markViewed,
    updateVisit,
    isNew,
    getNewCount,
    markAllViewed,
    clearState
  };
}