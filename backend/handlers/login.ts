import { generateToken as generateCsfrToken } from 'backend/middleware/csrf';
import { users } from '@shared/db/schema/user';
import { db } from 'backend/db/db';
import { createAndStoreLoginTokens, verifyHashedString } from 'backend/utils/auth';
import { eq } from 'drizzle-orm';
import { Request, Response } from 'express';
import { generateOtpAndSendToUser } from '../utils/otp-create-send';

export async function handleLogin(req: Request, res: Response) {
  try {
    console.log("🔐 [LOGIN] Incoming login request with body:", {
      email: req.body?.email,
      hasPassword: !!req.body?.password,
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ [LOGIN] Missing credentials");
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      console.log("❌ [LOGIN] User not found:", email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await verifyHashedString(password, user.password);

    if (!isValidPassword) {
      console.log("❌ [LOGIN] Invalid password for:", email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    console.log("🔐 [LOGIN] User exists and password is valid. Checking 2FA settings...")

    const twoFactorEnabled = user.twoFactorEnabled

    if (twoFactorEnabled) {
      console.log("🔐 [LOGIN] 2FA enabled. Generating OTP...")
      generateOtpAndSendToUser({
        user,
        email,
        res,
        purpose: 'login'
      })
    } 

    if (!twoFactorEnabled) {
      await createAndStoreLoginTokens(res, user)
       
      generateCsfrToken(req, res);

      console.log("✅ [LOGIN] Successful login for:", email);

      // Set content type and return user info
      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        twoFactorEnabled: false,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
        },
      });
    }
  } catch (error) {
    console.error("❌ [LOGIN] Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
