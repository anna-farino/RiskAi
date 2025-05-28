import { db } from 'backend/db/db'
import { articles } from '@shared/db/schema/news-tracker'
import { Request, Response } from 'express'


export async function testArticles(_req: Request, res: Response) {
  console.log("[🧪 TEST ARTICLES]")

  const data = await db
    .select()
    .from(articles)

  res.status(200).send({ articles: data })
}
