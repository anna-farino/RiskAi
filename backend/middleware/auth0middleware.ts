import { Request, Response, NextFunction } from 'express'
import { db } from '../db/db';
import { eq } from 'drizzle-orm';
import { users } from '@shared/db/schema/user';
import { FullRequest } from '.';

export async function auth0middleware(req: Request, res: Response, next: NextFunction) {
  const payload = req.auth
  const email = req.auth?.payload['user/email'] as string
  const email_verified = req.auth?.payload['user/email_verified']
  const sub = req.auth?.payload.sub

  //console.log("payload", payload)
  //console.log("email: ", email)
  //console.log("sub: ", sub)

  const user = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  //console.log("Users with email: ", email, user)

  if (
    user.length === 0 || 
    !user[0].verified ||
    !email_verified
  ) {
    console.log("❌ [AUTH0-MIDDLEWARE] User not authorized. Email, email_verified", email, email_verified)
    res.status(401).end();
    return;
  }

  (req as unknown as FullRequest).user = user[0];

  //const userId = user[0].id.toString();
  //await attachPermissionsAndRoleToRequest(userId, req)

  next()
}
