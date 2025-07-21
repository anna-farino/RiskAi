import { Request, Response } from 'express';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { FullRequest } from '../middleware';
import { withUserContext } from 'backend/db/with-user-context';


export async function handleAuthCheck(req: Request, res: Response) {
  console.log("[👤 AUTH-CHECK] Checking if user is logged in...")

  const userId = (req as unknown as FullRequest).user.id;
  console.log("[👤 AUTH-CHECK] user id:", userId)
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
  
  res.status(200).json({ 
    authenticated: true,
    user: [
      { 
        ...user, 
        permissions: (req as unknown as FullRequest).user.permissions,
        role: (req as unknown as FullRequest).user.role,
        password: "hidden"
      }
    ]
  });
}
