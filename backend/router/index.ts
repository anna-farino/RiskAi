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

const limiter = rateLimit({
	windowMs: 15 * 60 * 1000, 
	limit: 30, 
  message: "Too many requests. Try again later.",
	standardHeaders: 'draft-8', 
	legacyHeaders: false, 
  skipSuccessfulRequests: true
})

const router = Router();

//router.get('/test', handleTest)
router.use('/auth', limiter, authRouter)

router.use(doubleCsrfProtection)
router.use(noSimpleRequests)
//router.get('/test-simple-request', handleTest)
router.use(verifyToken)

// Protected routes
router.use('/users', usersRouter)
router.use('/news-tracker', newsRouter)

// DEV only
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)

export default router;
