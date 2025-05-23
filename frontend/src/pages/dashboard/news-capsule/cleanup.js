// Temporary cleanup script
// This will run once and clear any existing stored articles in memory
// We'll execute this in the Research component

// List of hardcoded URLs to ensure they're removed
const hardcodedUrls = [
  "https://thehackernews.com/2025/04/cisa-and-fbi-warn-fast-flux-is-powering.html",
  "https://www.csoonline.com/article/3954647/big-hole-in-big-data-critical-deserialization-bug-in-apache-parquet-allows-rce.html",
  "https://thehackernews.com/2025/04/malicious-python-packages-on-pypi.html",
  "https://cyberpress.org/weaponized-pdfs-malicious-email-attacks/",
  "https://cyberpress.org/apache-traffic-server-bug/#google_vignette",
  "https://gbhackers.com/fortinet-zero-day-poc/"
];

// Run this function to clear the entire article storage
function clearStoredArticles() {
  // Clear localStorage if that's being used
  try {
    localStorage.removeItem('newsProcessedArticles');
  } catch (e) {
    console.log("Failed to clear localStorage");
  }
  
  // Clear sessionStorage if that's being used
  try {
    sessionStorage.removeItem('processedArticles');
    sessionStorage.removeItem('newsCapsuledProcessedArticles');
  } catch (e) {
    console.log("Failed to clear sessionStorage");
  }
}

// Export for use in Research component
export { clearStoredArticles, hardcodedUrls };