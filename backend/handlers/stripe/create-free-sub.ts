import { FullRequest } from 'backend/middleware';
import createFreeSub from 'backend/utils/stripe/create-free-sub';
import { Response } from 'express'


export default async function createFreeSubHandler(req: FullRequest, res: Response) {
  console.log("Handling free subscription creation...")
  try {
    const { id: userId, email } = req.user

    if (!userId || !email) {
      throw new Error("No userId or no email found")
    }

    await createFreeSub({ userId, email })

    res.status(201).json({ 
      message: `created free subscription for user ${email}`
    })

  } catch(error: unknown) {
    let message: string

    if (error instanceof Error) {
      message = error.message
    } else {
      message = String(error)
    } 

    console.error(message)
    res.status(500).json({ message })
  }
}
