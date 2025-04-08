import { users } from '@shared/db/schema/user';
import { generateToken as generateCsfrToken } from '../middleware/csrf';
import { db } from 'backend/db/db';
import { cookieOptions, createAndStoreLoginTokens, hashString } from 'backend/utils/auth';
import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';

const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters long')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/\d/, 'Password must contain at least one number')
  .regex(/[?!@#$%^&*()]/, 'Password must contain at least one special character (!?@#$%^&*())')

export async function handleNewPassword(req: Request, res: Response) {
  const { newPassword } = req.body; 

  console.log(`[🔑 NEW PASSWORD] new password`, newPassword)

  try {
    passwordSchema.parse(newPassword)
  } catch(error) {
    console.error(error)
    return res.status(400).json({
        error: "Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character (!?@#$%^&*())"
    });
  }

  try {
    const decodedToken = jwt.verify(req.cookies.otp, process.env.JWT_SECRET!) as unknown as { userId: string };
    const { userId } = decodedToken;

    console.log(`[🔑 NEW PASSWORD] Updating password...`)

    const [ user ] = await db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)

    if (!user) {
      res.status(500).json({
        message: "No user found"
      })
      return
    }

    const hashedPassword = await hashString(newPassword)

    if (!hashedPassword) {
      return res.status(500).json({ message: "Server Error"})
    }

    const [ updatedUser ] = await db
      .update(users)
      .set({
        password: hashedPassword
      })
      .where(eq(users.id,user.id))
      .returning()

    if (!updatedUser) {
      return res.status(500).json({ message: "Error"})
    }

    await createAndStoreLoginTokens(res, user)
    generateCsfrToken(req, res);
    res.clearCookie('otp', cookieOptions)

    res.status(204).send()

  } catch(error) {
    console.error(error)
    res.status(500).json({ message: "Server Error"})
  };
}
