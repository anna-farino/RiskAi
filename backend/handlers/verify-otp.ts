import { Request, Response } from "express";
import { generateToken as generateCsfrToken } from '../middleware/csrf';
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { db } from "../db/db";
import { otps } from "@shared/db/schema/otps";
import { and, desc, eq } from "drizzle-orm";
import { cookieOptions, createAndStoreLoginTokens, hashString, verifyHashedString } from "../utils/auth";
import { users } from "@shared/db/schema/user";
import dotenvConfig from "../utils/dotenv-config";

dotenvConfig(dotenv)

type Args = {
  otpPurpose: 'login' | 'new-password' | 'signup'
}
export function handleVerifyOtp({ otpPurpose }: Args) {
  return async function(req: Request, res: Response) {

    console.log("[🍪 VERIFY OTP] Verifying otp token...", otpPurpose)

    try {
      const { code } = req.body;
      if (!req.cookies.otp) {
        console.log("[🍪❌ VERIFY OTP] No cookie found...")
        res.status(500).json({ message: "No cookie found"})
        return
      }
      const decodedToken = jwt
        .verify(
          req.cookies.otp, 
          process.env.JWT_SECRET!
        ) as unknown as { 
          userId: string,
          purpose: string
        };

      const { userId, purpose } = decodedToken;

      console.log(`[🍪 VERIFY OTP] userId, purpose:`, userId, purpose)

      if (otpPurpose != purpose) {
        console.error("Wrong otp purpose: handler, purpose", otpPurpose, purpose)
        return res.status(403).json({ message: "Permission denied" })
      }

      console.log(`[🍪 VERIFY OTP] Verifying code ${code} for user with id ${userId}...`)

      const [ otpFromDb ] = await db
        .select()
        .from(otps)
        .where(and(
          eq(otps.user_id,userId),
        ))
        .orderBy(desc(otps.created_at))
        .limit(1)

      if (!otpFromDb) {
        console.log("[🍪❌ VERIFY OTP] No stored otp found")
        return res.status(500).json({
          message: "No stored otp"
        })
      } 
      console.log(`[🍪 VERIFY OTP] an otp was found in db`)

      const isOtpCorrect = await verifyHashedString(code,otpFromDb.otp)

      if (!isOtpCorrect) {
        console.log("[🍪❌ VERIFY OTP] Otp incorrect")
        return res.status(500).json({
          message: "Otp is not correct"
        })
      }
      if (otpFromDb.used) {
        console.log("[🍪❌ VERIFY OTP] Otp used")
        return res.status(500).json({
          message: "Otp is not valid"
        })
      }
      if (new Date(otpFromDb.expires_at).getTime() < Date.now()) {
        console.log("[🍪❌ VERIFY OTP] Otp expired")
        return res.status(500).json({
          message: "Otp expired"
        })
      }
      await db
        .update(otps)
        .set({ used: true })
        .where(eq(otps.id,otpFromDb.id))

      const [ user ] = await db
        .select()
        .from(users)
        .where(eq(users.id,userId))
        .limit(1)

      if (!user) {
        return res.status(500).json({
          message: "No user found"
        })
      }

      if (purpose === 'signup') {
        await db
          .update(users)
          .set({ verified: true})
          .where(eq(users.id, user.id))
      }

      if (purpose === 'login' || purpose === 'signup') {
        await createAndStoreLoginTokens(res, user)
        generateCsfrToken(req, res);
        res.clearCookie('otp', cookieOptions)
      }

      return res.status(200).json({
        message: "code correct"
      })

    } catch(error) {
        console.log("[🍪❌ VERIFY OTP] Error:", (error as any).message)
        res.status(500).json({
          message: "Server Error"
      })
    }
  }
}
