import { Request, Response } from 'express';
import { verifyRefreshToken, generateAccessToken, createRefreshToken, revokeRefreshToken } from '../utils/auth';

export async function handleRefreshToken(req: Request, res: Response) {
  try {
    console.log('Refresh token request received');
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      console.log('No refresh token provided in cookies');
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const { user } = await verifyRefreshToken(req,refreshToken);

    if (!user) {
      console.log('Invalid or expired refresh token');
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Revoke the old refresh token
    await revokeRefreshToken(req,refreshToken);

    // Generate new tokens
    const newAccessToken = generateAccessToken(user);
    const newRefreshToken = await createRefreshToken(user.id);

    console.log(`Generated new tokens for user ${user.id}`);

    // Set new cookies
    res.cookie('token', newAccessToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 3600000, // 1 hour
    });

    res.cookie('refreshToken', newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      path: '/',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({ message: 'Tokens refreshed successfully' });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}
