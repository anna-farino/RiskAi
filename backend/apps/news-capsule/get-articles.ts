import { db } from "../../db/db";
import { FullRequest } from "../../middleware";
import { capsuleArticles } from '../../../shared/db/schema/news-capsule/index';
import { and, eq, desc } from "drizzle-orm";
import { Request, Response } from "express";


export async function getCapsueArticles(req: Request, res: Response) {
  try {
    const userId = (req as FullRequest).user.id;
    const articles = await db
      .select()
      .from(capsuleArticles)
      .where(
        and(
          eq(capsuleArticles.userId, userId),
          eq(capsuleArticles.markedForDeletion, false)
        )
      )
      .orderBy(desc(capsuleArticles.createdAt));
    
    res.json(articles);
  } catch (error) {
    console.error('Error fetching capsule articles:', error);
    res.status(500).json({ error: 'Failed to fetch articles' });
  }
}
