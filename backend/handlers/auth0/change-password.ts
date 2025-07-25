import { Request, Response } from 'express'
import { sendResetPasswordLink } from '../../utils/auth0/send-reset-password'
import { getToken } from '../../utils/auth0/get-token'


export async function handleChangePassword(req: Request, res: Response) {
  console.log("[CHANGE PASSWORD] Route hit")
  const { email } = req.body
  if (!email) {
    res.status(400).json({ message: "Email not found" })
  }

  const token = await getToken()
  if (!token) {
    res.status(500).json({ message: "MFA status couldn't be updated" })
    return
  }

  const linkWasSentSuccesfully = await sendResetPasswordLink({ email, token })

  if (linkWasSentSuccesfully) {
    return res.status(200).send()
  } else {
    return res.status(500).send()
  }
} 
