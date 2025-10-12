import { db } from "../../db/db";
import { FullRequest } from "../../middleware";
import { capsuleArticles } from '../../../shared/db/schema/news-capsule/index';
import { eq, and, lt, sql } from "drizzle-orm";
import { Request, Response } from "express";


export async function clearAllCapsuleArticles(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    
    // Get start of current date (midnight today)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    
    await db.transaction(async (tx) => {
      await tx
        .update(capsuleArticles)
        .set({
          markedForDeletion: true,
        })
        .where(
          and(
            eq(capsuleArticles.userId, userId),
            lt(capsuleArticles.createdAt, startOfToday)
          )
        );
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing all capsule articles:', error);
    res.status(500).json({ error: 'Failed to clear all articles' });
  }
}
