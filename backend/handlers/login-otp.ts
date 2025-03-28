import { CookieOptions, Request, Response } from 'express';
import emailjs from '@emailjs/nodejs'
import otpGenerator from 'otp-generator' 
import jwt from 'jsonwebtoken';
import { db } from '../db/db';
import { users } from '../db/schema/user';
import { eq } from 'drizzle-orm';
import { hashString, verifyHashedString } from '../utils/auth';
import { otps } from '../db/schema/otps';
import dotenv from 'dotenv'
import dotenvConfig from '../utils/dotenv-config';

dotenvConfig(dotenv)

export async function handleLoginOtp(req: Request, res: Response) {

  try {
    console.log("🔐 [LOGIN-OTP] Incoming login request with body:", {
      email: req.body?.email,
      hasPassword: !!req.body?.password,
    });

    const { email, password } = req.body;

    if (!email || !password) {
      console.log("❌ [LOGIN-OTP] Missing credentials");
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      console.log("❌ [LOGIN-OTP] User not found:", email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const isValidPassword = await verifyHashedString(password, user.password);

    if (!isValidPassword) {
      console.log("❌ [LOGIN-OTP] Invalid password for:", email);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const otp = otpGenerator.generate(
      6,
      {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false
      }
    )
    console.log("🔐 [LOGIN-OTP] OTP created")

    const hashedOtp = await hashString(otp)

    if (!hashedOtp) {
      console.log("❌ [LOGIN-OTP] An error was encountered while hashing the OTP")
      return res.status(500).json({
        message: "An error was encountered while hashing the OTP"
      })
    }
    console.log("🔐 [LOGIN-OTP] OTP hashed");

    const templateParams = { 
      email, 
      otp
    };
    
    try {
      emailjs.init({
        publicKey: process.env.EMAILJS_PUBLIC_KEY,
      })
      await emailjs.send(
        process.env.EMAILJS_SERVICE_ID as string, 
        process.env.EMAILJS_TEMPLATE_OTP_ID as string, 
        templateParams,
        {
          publicKey: process.env.EMAILJS_PUBLIC_KEY as string,  
          privateKey: process.env.EMAILJS_PRIVATE_KEY as string 
        },
      );
      console.log("🔐 [LOGIN-OTP] Email sent correctly");
    } catch(err) {
      console.log("❌ [LOGIN-OTP] An error occurred while sending the email")
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
    console.log("🔐 [LOGIN-OTP] OTP stored")

    const tempSessionToken = jwt.sign(
      {
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

    console.log("✅ [LOGIN-OTP] OTP sent to:", email);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      otpSent: true
    });

  } catch (error) {
    console.error("❌ [LOGIN-OTP] Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
