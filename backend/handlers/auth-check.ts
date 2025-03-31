import { Request, Response } from 'express';
import { db } from '../db/db';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { FullRequest } from '../middleware';


export async function handleAuthCheck(req: Request, res: Response) {
  console.log("handleAuthCheck", req.user)
  const userId = (req as unknown as FullRequest).user.id;
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const user = await db
    .select()
    .from(users)
    .where(eq(users.id, userId)) 

  console.log("user", user)
  
  res.status(200).json({ 
    authenticated: true,
    user: [
      { 
        ...user[0], 
        permissions: (req as unknown as FullRequest).user.permissions,
        password: "hidden"
      }
    ]
  });
}
