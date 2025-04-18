import { Request, Response } from 'express';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { FullRequest } from '../middleware';
import { db } from 'backend/db/db';


export async function handleAuthCheck(req: Request, res: Response) {
  console.log("[👤 AUTH-CHECK] Checking if user is logged in...")
  const userId = (req as unknown as FullRequest).user.id;
  if (!userId) {
    console.log("[👤 AUTH-CHECK] No user found!")
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const [ user ] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId)) 
  
  console.log("[👤 AUTH-CHECK] User found")
  
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
