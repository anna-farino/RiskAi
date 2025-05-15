import { articles } from '@shared/db/schema/news-tracker'
import { Request, Response } from 'express'
import { withUserContext } from 'backend/db/with-user-context'


export async function testArticles(req: Request, res: Response) {
  const { user } = req.body

  if (!user) {
    res.status(200).send({ articles: ["no user found"]})
    return
  }

  const data = await withUserContext(
    user,
    async (db) => {
      return db
        .select()
        .from(articles)
    }
  )
  res.status(200).send({ articles: data })
}
