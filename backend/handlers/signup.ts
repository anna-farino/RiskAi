import { Request, Response } from 'express';
import { db } from '../db/db';
import { allowedEmails, User, users } from '@shared/db/schema/user';
import { hashString } from '../utils/auth';
import { eq } from 'drizzle-orm';
import { roles, rolesUsers } from '@shared/db/schema/rbac';
import { generateOtpAndSendToUser } from '../utils/otp-create-send';

export async function handleSignUp(req: Request, res: Response) {
  const { email, password, name } = req.body;
  
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  console.log('Received signup request:', { email, name }); 

  try {
    const hashedPassword = await hashString(password);

    if (!hashedPassword) {
      return res.status(500).json({ error: 'Failed to hash password' });
    }

    let user: User;
    const existingUser = await db.select().from(users).where(eq(users.email, email));
    if (existingUser.length > 0) {
      if (existingUser[0].verified) {
        return res.status(400).json({ error: 'User already exists' });
      }
      const [updatedUser] = await db
        .update(users)
        .set({
          password: hashedPassword,
        })
        .where(eq(users.id, existingUser[0].id))
        .returning();

      user = updatedUser

    } else {
      const [allowedEmail] = await db
        .select()
        .from(allowedEmails)
        .where(eq(allowedEmails.name,email))

      if (!allowedEmail) {
        const emailDomain = email.split('@')[1]
        const [allowedDomain] = await db
          .select()
          .from(allowedEmails)
          .where(eq(allowedEmails.name,emailDomain))

        if (!allowedDomain) {
          return res.status(403).json({ message: "No permission to signup"})
        }
      }

      const [newUser] = await db
        .insert(users)
        .values({
          email,
          password: hashedPassword,
          name,
          createdAt: new Date(),
        })
        .returning();

      user = newUser
    }

    const [userRole] = await db
      .select()
      .from(roles)
      .where(eq(roles.name,"user"))

    if (userRole) {
      await db
        .insert(rolesUsers)
        .values({
          roleId: userRole.id,
          userId: user.id
        })
    }

    generateOtpAndSendToUser({
      user,
      res,
      email,
      purpose: 'signup'
    })

  } catch (error) {
    console.error('Sign up error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
