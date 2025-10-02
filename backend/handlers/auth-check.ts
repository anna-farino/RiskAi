import { Request, Response } from 'express';
import { users } from 'shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { FullRequest } from '../middleware';
import { withUserContext } from 'backend/db/with-user-context';
import { db } from 'backend/db/db';
import { organizations } from '@shared/db/schema/organizations';


export async function handleAuthCheck(req: Request, res: Response) {
  console.log("[👤 AUTH-CHECK] Checking if user is logged in...")

  const userId = (req as unknown as FullRequest).user.id;
  if (!userId) {
    console.log("[👤 AUTH-CHECK] No user found!")
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const [ user ] = await withUserContext(
    userId,
    async (db) => {
      return db
        .select()
        .from(users)
        .where(eq(users.id, userId)) 
    }
  )
  console.log("[👤 AUTH-CHECK] User found", user.email)

  const result = await db
    .select({ name: organizations.name })
    .from(organizations)
    .where(eq(organizations.id,user.organizationId))
    .limit(1)

  const organizationName = result[0]?.name
  console.log("organizationName: ", organizationName)
  if (!organizationName) {
    console.log("No organization name found")
    //throw new Error("No organization name found")
  }
  
  res.status(200).json({ 
    authenticated: true,
    user: [
      { 
        ...user, 
        permissions: (req as unknown as FullRequest).user.permissions,
        role: (req as unknown as FullRequest).user.role,
        password: "hidden",
        organizationName: organizationName || undefined
      }
    ]
  });
}
