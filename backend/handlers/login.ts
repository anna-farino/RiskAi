import { otps } from '@shared/db/schema/otps';
import { generateToken as generateCsfrToken } from 'backend/middleware/csrf';
import otpGenerator from 'otp-generator' 
import jwt from 'jsonwebtoken';
import { users } from '@shared/db/schema/user';
import { db } from 'backend/db/db';
import { createAndStoreLoginTokens, hashString, verifyHashedString } from 'backend/utils/auth';
import { sendEmailJs } from 'backend/utils/sendEmailJs';
import { eq } from 'drizzle-orm';
import { Request, Response, CookieOptions } from 'express';

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
      const otp = otpGenerator.generate(
        6,
        {
          digits: true,
          lowerCaseAlphabets: false,
          upperCaseAlphabets: false,
          specialChars: false
        }
      )
      console.log("🔐 [LOGIN] OTP created")

      const hashedOtp = await hashString(otp)

      if (!hashedOtp) {
        console.log("❌ [LOGIN] An error was encountered while hashing the OTP")
        return res.status(500).json({
          message: "An error was encountered while hashing the OTP"
        })
      }
      console.log("🔐 [LOGIN] OTP hashed");

      const templateParams = { 
        email, 
        otp
      };
      
      try {
        const template = process.env.EMAILJS_TEMPLATE_OTP_ID as string
        sendEmailJs({ template, templateParams })

        console.log("🔐 [LOGIN] Email sent correctly");
      } catch(err) {

        console.log("❌ [LOGIN] An error occurred while sending the email")
        console.error(err)

        res.status(500).json({
          message: "An error occurred while sending the email"
        })
        return
      }

      await db
        .insert(otps)
        .values({
          otp: hashedOtp,
          expires_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          user_id: user.id
        })
      console.log("🔐 [LOGIN] OTP stored")

      const tempSessionToken = jwt.sign(
        {
          purpose: 'login',
          userId: user.id
        },
        process.env.JWT_SECRET!,
        {
          expiresIn: "5m" 
        }

      );
      const cookieOptions: CookieOptions = {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        path: '/',
      };

      res.cookie('otp', tempSessionToken, {
        ...cookieOptions,
        maxAge: 1000 * 60 * 5, 
      });

      console.log("✅ [LOGIN] OTP sent to:", email);

      res.setHeader('Content-Type', 'application/json');
      return res.status(200).json({
        twoFactorEnabled: true,
        otpSent: true
      });
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
