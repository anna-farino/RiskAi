import { Request, Router, Response } from 'express';
import { verifyToken } from '../middleware';
import { verifyPermissions } from '../middleware/verify-permissions';
import { handleTest } from '../handlers/test';
import { handleGetRoles } from '../handlers/roles';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { noSimpleRequests } from '../middleware/no-simple-requests';
import { doubleCsrfProtection, generateToken } from '../middleware/csrf';
import { newsRouter } from '../apps/news-radar/router';
import { rateLimit } from 'express-rate-limit'
import { rateLimitConfig } from 'backend/utils/rate-limit-config';
import { deleteSecrets, getEncryptedSecrets, getSecrets, storeSecret } from 'backend/handlers/secrets';
import { threatRouter } from 'backend/apps/threat-tracker/router';
import { newsCapsuleRouter } from 'backend/apps/news-capsule/router';
import { handlePopulateSampleData, handleCheckSampleDataStatus } from 'backend/handlers/populate-sample-data';
import { auth0CheckJwt, jwtErrorHandler } from 'backend/middleware/auth0';
import { testDatadomeBypass } from 'backend/handlers/test-datadome';
import { auth0middleware } from 'backend/middleware/auth0middleware';
import { handleChangePassword } from 'backend/handlers/auth0/change-password';
import { handleDatabaseHealthCheck } from 'backend/handlers/health-check';

const limiter = rateLimit(rateLimitConfig)
const router = Router();

router.use((req: Request, _: Response, next: NextFunction)=>{
  //console.log("Server hit")
  //console.log("req.headers.authorization", req.headers.authorization)
  next()
})

// TEST route
router.get('/test', limiter, handleTest)
//router.get('/test-articles', testArticles)

router.get('/test-datadome-bypass', testDatadomeBypass)

// HEALTH CHECKS (unprotected)
router.get('/health/database', handleDatabaseHealthCheck)

// TESTING RLS MIDDLEWARE
//router.use(withDbContext)

// AUTH
router.use('/auth', limiter, authRouter)

// ================================================
// PROTECTIONS ====================================
// ================================================

router.use(auth0CheckJwt)
router.use(jwtErrorHandler)
router.use(noSimpleRequests)

router.use(auth0middleware)


// ================================================
// PROTECTED ROUTES
// ================================================
router.use('/users', usersRouter)
router.post('/change-password', handleChangePassword)

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
router.get('/sample-data/status', 
  //verifyToken, 
  //doubleCsrfProtection, 
  noSimpleRequests, handleCheckSampleDataStatus)

router.post('/sample-data/populate', 
  //verifyToken, 
  //doubleCsrfProtection, 
noSimpleRequests, handlePopulateSampleData)

export default router;
