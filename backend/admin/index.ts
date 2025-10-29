/**
 * Admin Module - Centralized exports for all admin-related functionality
 * Including live logs, test scraping, and source management
 */

// Routes
export { default as liveLogsRouter } from './routes/live-logs';
export { adminSourceRouter } from './routes/source-management';
export {
  handleTestScraping,
  handleTestScrapingHealth,
  handleTestAllSources,
  testDatadomeBypass,
} from './routes/test-scraping';

// Services
export {
  addDevLogPermission,
  removeDevLogPermission,
  listDevLogPermissions,
  verifyDevLogPermission,
} from './services/permissions';

export { initializeLogInterception } from './services/log-interceptor';
export { initializeSocketIO } from './services/socket-server';
