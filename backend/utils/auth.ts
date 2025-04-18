import * as argon2 from 'argon2';
import { CookieOptions, Response, Request } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User, users, refreshTokens } from '@shared/db/schema/user';
import { db } from '../db/db';
import { and, eq, isNull, gt } from 'drizzle-orm';
import dotenvConfig from './dotenv-config';
import { reqLog } from './req-log';

dotenvConfig(dotenv)

const SECRET = process.env.JWT_SECRET!;
const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days in seconds
const ACCESS_TOKEN_EXPIRES_IN = '1h'; // 1 hour

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'none',
  path: '/',
};

export async function hashString(password: string) {
  try {
    const hash = await argon2.hash(password)
    return hash
  }	catch(error) {
    console.error(error)
  }
}

export async function verifyHashedString(input: string, stored: string) {
  try {
    return await argon2.verify(stored, input)
  } catch(error) {
    console.error(error)
  }
}

export function generateAccessToken(user: User) {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email 
    }, 
    SECRET, 
    { 
      expiresIn: ACCESS_TOKEN_EXPIRES_IN 
    }
  );
}

export function generateRefreshToken(): string {
  return crypto.randomBytes(40).toString('hex');
}


export async function createRefreshToken(userId: string): Promise<string> {
  const token = generateRefreshToken();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRES_IN * 1000);

  await db.insert(refreshTokens).values({
    userId,
    token,
    expiresAt
  });

  console.log(`Created refresh token for user ${userId}, expires at ${expiresAt}`);
  return token;
}

export async function createAndStoreLoginTokens(res: Response, user: User) {
    const accessToken = generateAccessToken(user);
    const refreshToken = await createRefreshToken(user.id);

    res.cookie('token', accessToken, {
      ...cookieOptions,
      maxAge: 60 * 1000, // 1 minute 
    });
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 60 * 60 * 1000, // 1 hour 
    });
}

type Return = Promise<{ user: User | null, isRefreshTokenValid: boolean }>

export async function verifyRefreshToken(req: Request, token: string): Return {
  try {
    reqLog(req, 'Verifying refresh token...');
    
    const [ refreshToken ] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token));

    if (!refreshToken) {
      reqLog(req, "The refresh token doesn't match any token in the database")
      return {
        user: null,
        isRefreshTokenValid: false
      }
    }

    const [ user ] = await db
      .select()
      .from(users)
      .where(eq(users.id, refreshToken.userId));

    if (!user) {
      reqLog(req, "No corresponding user found")
      return {
        user: null,
        isRefreshTokenValid: false
      }
    }

    const currentDate = new Date()
    const expiresAt = new Date(refreshToken.expiresAt)
    const isRefreshTokenValid =  expiresAt > currentDate 
    reqLog(req, "[verifyRefreshToken], expiresAt, newDate, >?", expiresAt, currentDate, refreshToken.expiresAt > currentDate)

    if (!isRefreshTokenValid) {
      reqLog(req, 'No valid refresh token found');
      return {
        user,
        isRefreshTokenValid
      };
    }

    reqLog(req, `Found valid refresh token: `, refreshToken.token);

      return {
        user: user || null,
        isRefreshTokenValid
      };
  } catch (error) {
    reqLog(req, 'Error verifying refresh token:', error);
      return {
        user: null,
        isRefreshTokenValid: false
      };
  }
}

export async function revokeRefreshToken(req: Request, token: string): Promise<void> {
  reqLog(req,'Revoking refresh token...');
  const revokedDate = new Date()
  try {
    const data = await db
      .update(refreshTokens)
      .set({ revokedAt: revokedDate })
      .where(eq(refreshTokens.token, token))
      .returning()
    if (data.length === 0) throw new Error()
    reqLog(req,'Refresh token revoked:', token, revokedDate);

  } catch(err) {
    reqLog(req, "An error occurred while revoking the refresh token")
  }
}
