import { eq, desc, and, lt, gte } from "drizzle-orm";
import { db } from "backend/db/db";
import { CapsuleArticle, capsuleArticles, InsertCapsuleArticle } from "@shared/db/schema/news-capsule";


export async function getArticle(id: string): Promise<CapsuleArticle | undefined> {
   const [article] = await db
    .select()
    .from(capsuleArticles)
    .where(eq(capsuleArticles.id, id));
   return article;
 }

export async function getAllArticles(): Promise<CapsuleArticle[]> {
   return await db
     .select()
     .from(capsuleArticles)
     .where(eq(capsuleArticles.markedForDeletion, false))
     .orderBy(desc(capsuleArticles.createdAt));
 }

export async function createArticle(insertArticle: InsertCapsuleArticle): Promise<CapsuleArticle> {
   const [article] = await db
     .insert(capsuleArticles)
     .values(insertArticle)
     .returning();
   return article;
 }

export async function updateArticle(id: string, updates: Partial<CapsuleArticle>): Promise<CapsuleArticle | undefined> {
   const [updatedArticle] = await db
     .update(capsuleArticles)
     .set(updates)
     .where(eq(capsuleArticles.id, id))
     .returning();
   return updatedArticle;
 }

export async function deleteArticle(id: string): Promise<boolean> {
   const result = await db
     .delete(capsuleArticles)
     .where(eq(capsuleArticles.id, id))
     .returning();
   return result.length > 0;
 }
 
export async function deleteAllArticles(): Promise<boolean> {
   // Instead of deleting articles, mark them for deletion
   await db
     .update(capsuleArticles)
     .set({ markedForDeletion: true })
     .where(eq(capsuleArticles.markedForDeletion, false))
     .returning();
   return true;
 }

 export async function getEarlierArticles(): Promise<CapsuleArticle[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
 
    return await db
      .select()
      .from(capsuleArticles)
      .orderBy(desc(capsuleArticles.createdAt))
      .where(
        and(
          eq(capsuleArticles.markedForDeletion, false),
          lt(capsuleArticles.createdAt,today)
        ))
  }

export async function getTodayArticles(): Promise<CapsuleArticle[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to beginning of today
 
    return await db
      .select()
      .from(capsuleArticles)
      .orderBy(desc(capsuleArticles.createdAt))
      .where(
        and(
          eq(capsuleArticles.markedForDeletion, false),
          gte(capsuleArticles.createdAt,today)
        ))
}
