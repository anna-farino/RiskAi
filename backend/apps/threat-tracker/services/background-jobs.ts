import { log } from "backend/utils/log";

// Track running jobs per user to prevent user-specific conflicts
const userJobsRunning = new Map<string, boolean>();

// Check if a specific user's job is running
export function isUserJobRunning(userId: string) {
  return userJobsRunning.get(userId) || false;
}

// Placeholder for any future background job functionality
// All scraping is now handled by the global scraper in backend/services/global-scraping