import express from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv'
import { verifyRefreshToken, revokeRefreshToken, createAndStoreLoginTokens } from '../utils/auth';
import { User, users } from '@shared/db/schema/user';
import { db } from '../db/db';
import { permissions, rolesPermissions, roles, rolesUsers } from '@shared/db/schema/rbac';
import { eq } from 'drizzle-orm';
import { reqLog } from 'backend/utils/req-log';
import { refreshTokenLock } from 'backend/utils/refreshTokenLock';

dotenv.config()
export const SECRET = process.env.JWT_SECRET || 'secret';
const baseURL = process.env.BASE_URL;

console.log("base url", baseURL)

export type FullRequest = express.Request & { 
  user: User 
    & { permissions?: string[] } 
    & { role? : string | undefined | null }
};

type Token = {
	id: string,
	email: string,
	iat: number,
	exp: number
}
export function requestLogger(req: express.Request, _res: express.Response, next: express.NextFunction) {
  console.log(`📝 [${req.method}] ${req.path}`, {
    query: req.query,
    cookies: req.cookies,
    headers: {
      authorization: req.headers.authorization,
      'content-type': req.headers['content-type']
    }
  });
  next();
}

export async function verifyToken(req: express.Request,  res: express.Response, next: express.NextFunction) {
	console.log("🔐 [AUTH] Verifying token for path:", req.path, req.originalUrl)
	const token = req.cookies.token;
	const refreshToken = req.cookies.refreshToken;
	console.log("🔐 [AUTH] Access and refresh tokens received")

	if (!token && !refreshToken) {
		console.log("❌ [AUTH] No tokens found")
		res.status(401).json({ message: "Unauthorized"})
		return
	}

	try {
		if (token) {
			console.log("🔍 [AUTH] Verifying access token...")
			const decoded: Token = jwt.verify(token, SECRET) as unknown as Token;
			if (decoded) {
				console.log("✅ [AUTH] JWT valid for user:", decoded.id);
				const user = await db
					.select()
					.from(users)
					.where(eq(users.id, decoded.id))
					.limit(1);

				if (!user[0]) {
					console.log("❌ [AUTH] User not found")
					res.status(401).end();
					return;
				}

				(req as unknown as FullRequest).user = user[0];
        const userId = user[0].id.toString();

        await attachPermissionsAndRoleToRequest(userId, req)

				next();
				return;
			}
		}

		if (refreshToken) {
			reqLog(req, "🔄 [AUTH] Attempting to refresh token...")
			const { user, isRefreshTokenValid } = await verifyRefreshToken(req, refreshToken);

      if (!user) {
        reqLog(req, "No user found while verifying refresh token")
        res.status(500).send()
        return
      }

			if (isRefreshTokenValid) {
				reqLog(req, "✅ [AUTH] Refresh token valid, generating new tokens...")

        await refreshTokenLock({
          req: req,
          refreshToken: refreshToken,
          asyncFn: async () => {
            await revokeRefreshToken(req,refreshToken);
            await createAndStoreLoginTokens(res, user);
          }
        });

        (req as unknown as FullRequest).user = user;
        const userId = user.id.toString();

        await attachPermissionsAndRoleToRequest(userId, req)

        next();
        return;
			}
		}

		reqLog(req,"❌ [AUTH] Either the tokens are invalid or the user doesn't exist")
		res.status(401).end();

	} catch (error) {
		console.error('❌ [AUTH] Token verification error:', error);
		res.status(401).end();
	}
}



async function getUserRole(userId: string) {
  const userRole = await db
    .select({ role: roles.name })
    .from(rolesUsers)
    .leftJoin(roles, eq(rolesUsers.roleId,roles.id))
    .where(eq(rolesUsers.userId,userId))

  if (userRole.length === 0) return undefined
  else return userRole[0].role
}

async function getUserPermissions(userId: string) {
	const userPermissions = await db
		.select()
		.from(rolesUsers)
		.leftJoin(roles, eq(rolesUsers.roleId, roles.id))
		.leftJoin(rolesPermissions, eq(roles.id, rolesPermissions.roleId))
		.leftJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
		.where(eq(rolesUsers.userId, userId));

	return userPermissions.map((p) => p.permissions?.name ?? '');
}


async function attachPermissionsAndRoleToRequest(userId: string, req: express.Request) {
    const userRole = await getUserRole(userId)
    const userPermissions = await getUserPermissions(userId);

    (req as unknown as FullRequest).user.permissions = userPermissions;
    (req as unknown as FullRequest).user.role = userRole;
}
