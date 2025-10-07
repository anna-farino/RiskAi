import { users } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import { Request, Response } from "express";
import { generateOtpAndSendToUser } from "../utils/otp-create-send";


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
    generateOtpAndSendToUser({
      user,
      email,
      res,
      purpose: 'new-password'
    })
  } catch (error) {
    console.error("❌ [FORGOT-PSW-OTP] Error:", error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}




