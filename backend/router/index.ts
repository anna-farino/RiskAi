import { Request, Router, Response } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { noSimpleRequests } from '../middleware/no-simple-requests';
import { doubleCsrfProtection } from '../middleware/csrf';
import { newsRouter } from '../apps/news-radar/router';
import { rateLimit } from 'express-rate-limit'
import { rateLimitConfig } from 'backend/utils/rate-limit-config';
import { deleteSecrets, getEncryptedSecrets, getSecrets, storeSecret } from 'backend/handlers/secrets';
import { testArticles } from 'backend/handlers/tests/aaa-test-articles'; // to test RLS
import { threatRouter } from 'backend/apps/threat-tracker/router';
import { newsCapsuleRouter } from 'backend/apps/news-capsule/router';
import { handlePopulateSampleData, handleCheckSampleDataStatus } from 'backend/handlers/populate-sample-data';
import sendGrid from 'backend/utils/sendGrid';

const limiter = rateLimit(rateLimitConfig)

const router = Router();

// HELLO WORLD route
router.get('/test', limiter, handleTest)
router.get('/test-email', (req: Request, res: Response)=>{
  sendGrid({
    to: "test-91gqwhqpp@srv1.mail-tester.com",
    subject: "Test",
    text: "This is 👍",
    //html: "<h1>Hello, sendGrid!</h1>"
  })
  res.json({ response: "test email route hit!"})
})

// TESTING RLS MIDDLEWARE
//router.use(withDbContext)
router.get('/test-articles', testArticles)

// AUTH
router.use('/auth', limiter, authRouter)

// PROTECTIONS
//router.use(doubleCsrfProtection)
router.use(noSimpleRequests)
router.use(verifyToken)

// PROTECTED ROUTES
router.use('/users', usersRouter)

router.use('/news-tracker', newsRouter)
router.use('/threat-tracker', threatRouter)
router.use('/news-capsule', newsCapsuleRouter)

router.post('/secrets', storeSecret)
router.get('/secrets', getSecrets)
router.get('/e-secrets', getEncryptedSecrets)
router.delete('/secrets', deleteSecrets)

// DEV only
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)

// Sample Data Population API endpoints
router.get('/sample-data/status', verifyToken, 
  //doubleCsrfProtection, 
  noSimpleRequests, handleCheckSampleDataStatus)
router.post('/sample-data/populate', verifyToken, 
  //doubleCsrfProtection, 
noSimpleRequests, handlePopulateSampleData)

export default router;
