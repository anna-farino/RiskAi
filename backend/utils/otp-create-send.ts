import { User } from "@shared/db/schema/user"
import jwt from 'jsonwebtoken';
import otpGenerator from 'otp-generator' 
import { hashString } from "./auth"
import express, { CookieOptions } from 'express'
import { sendEmailJs } from "./sendEmailJs"
import { db } from "../../backend/db/db"
import { otps } from "@shared/db/schema/otps"


type Args = {
  res: express.Response,
  user: User,
  email: string,
  purpose: 'login' | 'signup' | 'new-password'
}
export async function generateOtpAndSendToUser({
  user,
  res,
  email,
  purpose
}: Args) {
  const otp = otpGenerator.generate(
    6,
    {
      digits: true,
      lowerCaseAlphabets: false,
      upperCaseAlphabets: false,
      specialChars: false
    }
  )
  console.log("🔐 [OTP] OTP created")

  const hashedOtp = await hashString(otp)

  if (!hashedOtp) {
    console.log("❌ [OTP] An error was encountered while hashing the OTP")
    return res.status(500).json({
      message: "An error was encountered while hashing the OTP"
    })
  }
  console.log("🔐 [OTP] OTP hashed");

  const templateParams = { 
    email, 
    otp
  };
  
  try {
    const template = process.env.EMAILJS_TEMPLATE_OTP_ID as string
    sendEmailJs({ template, templateParams })

    console.log("🔐 [OTP] Email sent correctly");
  } catch(err) {

    console.log("❌ [OTP] An error occurred while sending the email")
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
  console.log("🔐 [OTP] OTP stored")

  const tempSessionToken = jwt.sign(
    {
      purpose,
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

  console.log("✅ [OTP] OTP sent to:", email);

  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json({
    twoFactorEnabled: true,
    otpSent: true
  });
}
