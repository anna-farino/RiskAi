// Helper function to get CSRF tokens for API requests

// Function to get CSRF header object
export function csfrHeaderObject(): Record<string, string> {
  // Get the CSRF token from cookies or meta tag
  const csrfToken = getCsrfToken();
  
  // Return the header object with CSRF token
  if (csrfToken) {
    return {
      'CSRF-Token': csrfToken
    };
  }
  
  return {};
}

// Function to get CSRF token from meta tag or cookie
function getCsrfToken(): string | null {
  // First try to get from meta tag
  const metaTag = document.querySelector('meta[name="csrf-token"]');
  if (metaTag && metaTag.getAttribute('content')) {
    return metaTag.getAttribute('content');
  }
  
  // Fallback to getting from cookies
  const cookies = document.cookie.split(';');
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i].trim();
    if (cookie.startsWith('CSRF-Token=')) {
      return cookie.substring('CSRF-Token='.length, cookie.length);
    }
  }
  
  return null;
}