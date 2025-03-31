import { Request, Response } from 'express';
import { db } from '../db/db';
import { users } from '@shared/db/schema/user';
import { eq } from 'drizzle-orm';
import { verifyHashedString, createAndStoreLoginTokens } from '../utils/auth';
import { generateToken as generateCsfrToken } from '../middleware/csrf';

export async function handleLogin(req: Request, res: Response) {
  try {
    console.log("🔐 [LOGIN] Incoming login request with body:", {
      email: req.body?.email,
      hasPassword: !!req.body?.password,
      headers: {
        'content-type': req.headers['content-type'],
        origin: req.headers.origin,
      }
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ [LOGIN] Missing credentials");
      return res.status(400).json({ error: 'Email and password are required' });
    }
    // Find user by email
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    // Verify password
    const isValidPassword = await verifyHashedString(password, user.password);

    if (!isValidPassword || !user) {
      console.log("❌ [LOGIN] Invalid credentials");
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await createAndStoreLoginTokens(res, user)
     
    generateCsfrToken(req, res);

    console.log("✅ [LOGIN] Successful login for:", email);

    // Set content type and return user info
    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });

  } catch (error) {
    console.error("❌ [LOGIN] Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
