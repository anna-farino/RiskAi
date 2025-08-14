import { getToken } from 'backend/utils/auth0/get-token'
import { getUserByEmail } from 'backend/utils/auth0/get-user-by-email'
import { sendEmailVerification } from 'backend/utils/auth0/send-email-verification'
import { Request, Response } from 'express'


export async function handleSendEmailVerification(req: Request, res: Response) {
  const email = req.body?.email
  if (!email) {
    console.log("❌ [Send Email Verification] No email found in request body")
    return res.status(400).json({ error: "No email found"})
  }
  try {
    const token = await getToken()
    if (!token) throw new Error("No token retrieved")

    const user = await getUserByEmail({ token, email })
    if (!user) throw new Error("No user found")

    const userId = user.user_id
    if (!userId) throw new Error("No user id found")

    await sendEmailVerification({ token, userId })

  } catch(error) {
    console.error("❌ [Send Email Verification] An error ocurred while trying to send a verification email:", error)
    res.status(500).send()
  }
  res.status(200).json({ message: "Email sent correctly"})
}
