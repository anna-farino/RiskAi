import { Router } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
//import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { noSimpleRequests } from '../middleware/no-simple-requests';
import { doubleCsrfProtection } from '../middleware/csrf';
import { newsRouter } from '../apps/news-tracker/router';
import { rateLimit } from 'express-rate-limit'
import { capsuleRouter } from 'backend/apps/news-capsule/routes';
import { rateLimitConfig } from 'backend/utils/rate-limit-config';
import { deleteSecrets, getEncryptedSecrets, getSecrets, storeSecret } from 'backend/handlers/secrets';

const limiter = rateLimit(rateLimitConfig)

const router = Router();

//router.get('/test', handleTest)
router.get('/hack-roles/:id', handleGetRoles)

router.use('/auth', limiter, authRouter)

router.use(doubleCsrfProtection)
router.use(noSimpleRequests)
//router.get('/test-simple-request', handleTest)
router.use(verifyToken)

// Protected routes
router.use('/users', usersRouter)
router.use('/news-tracker', newsRouter)
router.use('/news-capsule', capsuleRouter)

router.post('/secrets', storeSecret)
router.get('/secrets', getSecrets)
router.get('/e-secrets', getEncryptedSecrets)
router.delete('/secrets', deleteSecrets)

// DEV only
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)

export default router;
