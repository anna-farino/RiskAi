import { Request, Response, NextFunction } from 'express'
import { db } from '../db/db';
import { eq } from 'drizzle-orm';
import { auth0Ids, User, users } from '@shared/db/schema/user';
import { FullRequest } from '.';

type CustomRequest = Request &  { log: (...args: any[]) => void }

export async function auth0middleware(req: CustomRequest, res: Response, next: NextFunction) {
  const payload = req.auth
  const email = req.auth?.payload['email'] as string
  const email_verified = req.auth?.payload['email_verified']
  const sub = req.auth?.payload.sub

  req.log("payload", payload)
  //req.log("email: ", email)
  //req.log("sub: ", sub)

  console.log("auth0middleware")

  if (!sub) {
    req.log("❌ [AUTH0-MIDDLEWARE] User id not provided")
    res.status(404).end();
    return;
  }
  if (!email_verified) {
    req.log("❌ [AUTH0-MIDDLEWARE] User not authorized. Email, email_verified", email, email_verified)
    res.status(401).end();
    return;
  }

  const [ auth0id ] = await db
    .select()
    .from(auth0Ids)
    .where(eq(auth0Ids.auth0Id,sub))
    .limit(1)

  console.log("auth0id found?", auth0id)

  let userToReturn: User;

  if (auth0id) {
    try {
      const [ user ] = await db
        .select()
        .from(users)
        .where(eq(users.id, auth0id.userId))
        .limit(1)

      if (!user) {
        throw new Error("User not found")
      }

      if (user.email != email) {
        await db
          .update(users)
          .set({ email })
          .where(eq(users.id,user.id))
      }

      userToReturn = user

    } catch(error) {
      console.error(error)
      return res.status(500)
    }
  } else {
    const [ userFromEmail ] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (!userFromEmail) {
      let user: User | undefined;
      try {
        await db.transaction(async (tx) => {
          [ user ] = await tx
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
          await tx
            .insert(auth0Ids)
            .values({
              auth0Id: sub,
              userId: user.id
            })
            .onConflictDoNothing()
        })

        if (!user) throw new Error()

        userToReturn = user
      } catch(error) {
        req.log("❌[AUTH0-MIDDLEWARE] An error occurred while creating the new user", error)
        res.status(500).send()
        return
      }
    } else {
      console.log("auth0id not found. Creating one...")
      userToReturn = userFromEmail 
      await db
        .insert(auth0Ids)
        .values({
          auth0Id: sub,
          userId: userToReturn.id
        })
        .onConflictDoNothing()
    } 
    req.log("👤[AUTH0-MIDDLEWARE] New user created", userToReturn)
  }

  (req as unknown as FullRequest).user = userToReturn;

  //req.log("👤[AUTH0-MIDDLEWARE] req object updated with user:", req.user)
  //const userId = user[0].id.toString();
  //await attachPermissionsAndRoleToRequest(userId, req)

  next()
}
