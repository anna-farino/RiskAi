import * as argon2 from 'argon2';
import { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from 'crypto';
import { User, users, refreshTokens } from '../db/schema/user';
import { db } from '../db/db';
import { and, eq, isNull, gt } from 'drizzle-orm';
import dotenvConfig from './dotenv-config';

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
      maxAge: 60 * 10 * 1000, // 10 minutes 
    });
    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
}

export async function verifyRefreshToken(token: string): Promise<User | null> {
  try {
    console.log('Verifying refresh token...');
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.token, token),
          isNull(refreshTokens.revokedAt),
          gt(refreshTokens.expiresAt, new Date())
        )
      );

    if (!refreshToken) {
      console.log('No valid refresh token found');
      return null;
    }

    console.log(`Found valid refresh token for user ${refreshToken.userId}`);
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, refreshToken.userId));

    return user || null;
  } catch (error) {
    console.error('Error verifying refresh token:', error);
    return null;
  }
}

export async function revokeRefreshToken(token: string): Promise<void> {
  console.log('Revoking refresh token...');
  await db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(eq(refreshTokens.token, token));
  console.log('Refresh token revoked');
}
