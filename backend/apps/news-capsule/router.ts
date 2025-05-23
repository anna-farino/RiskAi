import { Router } from 'express';
import { processUrl } from './process-url';
import { addToReport } from './add-to-report';
import { getReports } from './get-reports';

const router = Router();

// Process a URL to generate an article summary
router.post('/process-url', processUrl);

// Add article(s) to a report
router.post('/add-to-report', addToReport);

// Get all reports with their articles
router.get('/reports', getReports);

export { router as newsCapsuleRouter };