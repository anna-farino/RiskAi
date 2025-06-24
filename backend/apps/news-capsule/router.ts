import { Router } from 'express';
import { processUrl } from './process-url';
import { addToReport } from './add-to-report';
import { getReports } from './get-reports';
import { deleteReport } from './delete-report';
import { removeArticleFromReport } from './remove-article-from-report';
import { getCapsueArticles } from './get-articles';
import { deleteCapsuleArticle } from './delete-article';

const router = Router();

// Process a URL to generate an article summary
router.post('/process-url', processUrl);

// Add article(s) to a report
router.post('/add-to-report', addToReport);

// Remove article from report
router.delete('/reports/:reportId/articles/:articleId', removeArticleFromReport);

// Delete a report
router.delete('/reports/:id', deleteReport);

// Get all reports with their articles
router.get('/reports', getReports);

// Get all capsule articles for the current user
router.get('/articles', getCapsueArticles);

// Delete a capsule article
router.delete('/articles/:id', deleteCapsuleArticle);


export { router as newsCapsuleRouter };
