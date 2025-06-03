// Enhanced scroll smoothness utilities
export function initSmoothScrolling() {
  // Add momentum scrolling for webkit browsers
  if (window.CSS && CSS.supports('(-webkit-overflow-scrolling: touch)')) {
    document.documentElement.style.webkitOverflowScrolling = 'touch';
    document.body.style.webkitOverflowScrolling = 'touch';
  }

  // Improve scroll performance
  let scrollTimer = null;
  let isScrolling = false;
  
  const optimizeScrollPerformance = () => {
    if (!isScrolling) {
      isScrolling = true;
      document.body.style.pointerEvents = 'none';
    }
    
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => {
      isScrolling = false;
      document.body.style.pointerEvents = 'auto';
    }, 100);
  };

  // Add scroll event listener for performance optimization
  window.addEventListener('scroll', optimizeScrollPerformance, { passive: true });
  
  // Enhanced scrollbar interaction
  const scrollableElements = document.querySelectorAll('*');
  scrollableElements.forEach(element => {
    if (element.scrollHeight > element.clientHeight || element.scrollWidth > element.clientWidth) {
      element.style.scrollBehavior = 'smooth';
    }
  });
}

// Smooth scroll to element function
export function smoothScrollToElement(element, offset = 0) {
  if (!element) return;
  
  const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
  const offsetPosition = elementPosition - offset;
  
  window.scrollTo({
    top: offsetPosition,
    behavior: 'smooth'
  });
}

// Initialize on DOM load
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSmoothScrolling);
  } else {
    initSmoothScrolling();
  }
}