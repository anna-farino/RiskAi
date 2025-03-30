import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/db';
import { refreshTokens } from '../db/schema/user';
import { cookieOptions } from '../utils/auth';

export async function handleLogout(req: Request, res: Response) {
    const token = req.cookies.token;
    //const { refreshToken } = req.body;
    console.log("⬅️  [LOGOUT] token:", token);
    
    if (!token) {
      return res.status(500).json({ 
        message: "No token found", 
        noToken: true
      })
    }

    const { id: userId} = jwt.verify(token, process.env.JWT_SECRET as string) as { id: string };
    console.log("⬅️  [LOGOUT] userId:", userId);

    try {
        await db
          .delete(refreshTokens)
          .where(eq(refreshTokens.userId, userId));

        res.clearCookie('token', cookieOptions)
        res.clearCookie('refreshToken', cookieOptions)

        res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out: ', error);
        res.status(500).json({ message: 'No token found' });
    }
}
