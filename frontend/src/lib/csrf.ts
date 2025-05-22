// Function to get CSRF token from meta tag
export function getCSRFToken(): string {
  const csrfMeta = document.querySelector('meta[name="csrf-token"]');
  return csrfMeta ? csrfMeta.getAttribute('content') || '' : '';
}

// Return header object with CSRF token
export function csfrHeaderObject() {
  return {
    'CSRF-Token': getCSRFToken(),
    'Content-Type': 'application/json'
  };
}