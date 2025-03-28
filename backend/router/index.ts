import { Router } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';

const router = Router();

router.get('/test', handleTest)

router.use('/auth', authRouter)

router.use(verifyToken)
// Protected routes
router.use('/users', usersRouter)
router.get('/roles', verifyPermissions('roles:view'), handleGetRoles)

export default router;
