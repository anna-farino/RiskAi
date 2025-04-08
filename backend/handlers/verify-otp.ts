import { Request, Response } from "express";
import { generateToken as generateCsfrToken } from '../middleware/csrf';
import dotenv from 'dotenv'
import jwt from 'jsonwebtoken'
import { db } from "../db/db";
import { otps } from "@shared/db/schema/otps";
import { desc, eq } from "drizzle-orm";
import { cookieOptions, createAndStoreLoginTokens, verifyHashedString } from "../utils/auth";
import { users } from "@shared/db/schema/user";
import dotenvConfig from "../utils/dotenv-config";

dotenvConfig(dotenv)

type Args = {
  otpPurpose: 'login' | 'new-password'
}
export function handleVerifyOtp({ otpPurpose }: Args) {
  return async function(req: Request, res: Response) {

    console.log("[🍪 VERIFY] Verifying otp token...", otpPurpose)

    try {
      const { code } = req.body;
      if (!req.cookies.otp) {
        console.log("[🍪❌ VERIFY] No cookie found...")
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

      if (otpPurpose != purpose) {
        console.error("Wrong otp purpose: handler, purpose", otpPurpose, purpose)
        return res.status(403).json({ message: "Permission denied" })
      }

      console.log(`[🍪 VERIFY] Verifying code ${code} for user with id ${userId}...`)

      const [ otpFromDb ] = await db
        .select()
        .from(otps)
        .where(eq(otps.user_id,userId))
        .orderBy(desc(otps.created_at))
        .limit(1)

      if (!otpFromDb) {
        console.log("[🍪❌ VERIFY] No stored otp found")
        res.status(500).json({
          message: "No stored otp"
        })
      } 

      const isOtpCorrect = verifyHashedString(code,otpFromDb.otp)

      if (!isOtpCorrect) {
        console.log("[🍪❌ VERIFY] Otp incorrect")
        res.status(500).json({
          message: "Otp is not correct"
        })
      }
      if (otpFromDb.used) {
        console.log("[🍪❌ VERIFY] Otp used")
        res.status(500).json({
          message: "Otp is not valid"
        })
      }
      if (new Date(otpFromDb.expires_at).getTime() < Date.now()) {
        console.log("[🍪❌ VERIFY] Otp expired")
        res.status(500).json({
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
        res.status(500).json({
          message: "No user found"
        })
        return
      }

      if (purpose === 'login') {
        await createAndStoreLoginTokens(res, user)
        generateCsfrToken(req, res);
        res.clearCookie('otp', cookieOptions)
      }

      res.status(200).json({
        message: "code correct"
      })

    } catch(error) {
        console.log("[🍪❌ VERIFY] Error:", (error as any).message)
        res.status(500).json({
          message: "Server Error"
      })
    }
  }
}
