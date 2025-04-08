import { users } from "@shared/db/schema/user";
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator' 
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import { CookieOptions, Request, Response } from "express";
import { hashString } from "backend/utils/auth";
import { sendEmailJs } from "backend/utils/sendEmailJs";
import { otps } from "@shared/db/schema/otps";


export async function handleForgotPswOtp(req: Request, res: Response) {
  try {
    console.log("🔐 [FORGOT-PSW-OTP] Incoming login request with body:", {
      email: req.body?.email,
    });

    const { email } = req.body;

    if (!email) {
      console.log("❌ [FORGOT-PSW-OTP] Missing credentials");
      return res.status(400).json({ error: 'Missing credentials' });
    }
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      console.log("❌ [FORGOT-PSW-OTP] User not found:", email);
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
    console.log("🔐 [FORGOT-PSW-OTP] OTP created")

    const hashedOtp = await hashString(otp)

    if (!hashedOtp) {
      console.log("❌ [FORGOT-PSW-OTP] An error was encountered while hashing the OTP")
      return res.status(500).json({
        message: "An error was encountered while hashing the OTP"
      })
    }
    console.log("🔐 [FORGOT-PSW-OTP] OTP hashed");

    const templateParams = { 
      email, 
      otp
    };
    
    try {
      const template = process.env.EMAILJS_TEMPLATE_OTP_ID as string
      sendEmailJs({ template, templateParams })

      console.log("🔐 [FORGOT-PSW-OTP] Email sent correctly");
    } catch(err) {

      console.log("❌ [FORGOT-PSW-OTP] An error occurred while sending the email")
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
    console.log("🔐 [FORGOT-PSW-OTP] OTP stored")

    const tempSessionToken = jwt.sign(
      {
        userId: user.id,
        purpose: 'new-password'
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

    res.cookie(
      'otp', 
      tempSessionToken, 
      {
        ...cookieOptions,
        maxAge: 1000 * 60 * 5, 
      }
    );

    console.log("✅ [FORGOT-PSW-OTP] OTP sent to:", email);

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({
      otpSent: true
    });

  } catch (error) {
    console.error("❌ [FORGOT-PSW-OTP] Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}




