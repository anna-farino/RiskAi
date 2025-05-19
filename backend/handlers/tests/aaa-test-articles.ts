import { articles } from '@shared/db/schema/news-tracker'
import { Request, Response } from 'express'


export async function testArticles(req: Request, res: Response) {

  const data = await req.db
    .select()
    .from(articles)

  res.status(200).send({ articles: data })
}
