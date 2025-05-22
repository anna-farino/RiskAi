import { Router } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { noSimpleRequests } from '../middleware/no-simple-requests';
import { doubleCsrfProtection } from '../middleware/csrf';
import { newsRouter } from '../apps/news-radar/router';
import { capsuleRouter } from '../apps/news-capsule/router';
import { rateLimit } from 'express-rate-limit'
import { rateLimitConfig } from 'backend/utils/rate-limit-config';
import { deleteSecrets, getEncryptedSecrets, getSecrets, storeSecret } from 'backend/handlers/secrets';
import { withDbContext } from 'backend/middleware/with-db-context';
//import { testArticles } from 'backend/handlers/tests/aaa-test-articles'; // to test RLS
import { threatRouter } from 'backend/apps/threat-tracker/router';

const limiter = rateLimit(rateLimitConfig)

const router = Router();

// HELLO WORLD route
router.get('/test', limiter, handleTest)

// TESTING RLS MIDDLEWARE
//router.use(withDbContext)
//router.get('/test-articles', testArticles)

// AUTH
router.use('/auth', limiter, authRouter)

// PROTECTIONS
router.use(doubleCsrfProtection)
router.use(noSimpleRequests)
router.use(verifyToken)
router.use(withDbContext)

// PROTECTED ROUTES
router.use('/users', usersRouter)

router.use('/news-tracker', newsRouter)
router.use('/threat-tracker', threatRouter)
router.use('/news-capsule', capsuleRouter)

router.post('/secrets', storeSecret)
router.get('/secrets', getSecrets)
router.get('/e-secrets', getEncryptedSecrets)
router.delete('/secrets', deleteSecrets)

// DEV only
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)

export default router;
