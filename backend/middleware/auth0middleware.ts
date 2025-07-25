import { Request, Response, NextFunction } from 'express'
import { db } from '../db/db';
import { eq } from 'drizzle-orm';
import { User, users } from '@shared/db/schema/user';
import { FullRequest } from '.';


type CustomRequest = Request &  { log: (...args: any[]) => void }

export async function auth0middleware(req: CustomRequest, res: Response, next: NextFunction) {
  const payload = req.auth
  const email = req.auth?.payload['user/email'] as string
  const email_verified = req.auth?.payload['user/email_verified']
  const sub = req.auth?.payload.sub

  //req.log("payload", payload)
  //req.log("email: ", email)
  //req.log("sub: ", sub)

  const userArray = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  //req.log("Users with email: ", email, user)
  //req.log("[AUTH0-MIDDLEWARE] userArray: ", userArray)

  if (!email_verified) {
    req.log("❌ [AUTH0-MIDDLEWARE] User not authorized. Email, email_verified", email, email_verified)
    res.status(401).end();
    return;
  }

  let userToReturn: User;

  if (userArray.length === 0) {
    try {
      const user = await db
        .insert(users)
        .values({
          email: email,
          name: email,
          password: '',
        })
        .onConflictDoUpdate({
          target: users.id,
          set: {
            email: email,
            name: email,
            password: '',
          }
        })
        .returning()

      req.log("👤[AUTH0-MIDDLEWARE] New user created", user[0])

      userToReturn = user[0]

    } catch(error) {
      req.log("❌[AUTH0-MIDDLEWARE] An error occurred while creating the new user", error)
      res.status(500).send()
      return
    }
  } else {
    userToReturn = userArray[0]
  } 


  (req as unknown as FullRequest).user = userToReturn;

  //req.log("👤[AUTH0-MIDDLEWARE] req object updated with user:", req.user)
  //const userId = user[0].id.toString();
  //await attachPermissionsAndRoleToRequest(userId, req)

  next()
}
