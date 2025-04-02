import { Router } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { noSimpleRequests } from '../middleware/no-simple-requests';
import { doubleCsrfProtection } from '../middleware/csrf';
import { newsRouter } from './routes/news-tracker';

const router = Router();

router.get('/test', handleTest)

router.use('/auth', authRouter)

router.use('/news-tracker', verifyToken, newsRouter)

router.use(doubleCsrfProtection)
router.use(noSimpleRequests)
router.get('/test-simple-request', handleTest)

router.use(verifyToken)
// Protected routes
router.use('/users', usersRouter)
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)


export default router;
