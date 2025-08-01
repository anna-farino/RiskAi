import { getToken } from "backend/utils/auth0/get-token";
import { readMfa } from "backend/utils/auth0/readMfa";
import { Request, Response } from "express";

export async function handleReadMfa(req: Request, res: Response) {
  const { userId } = req.params
  console.error("[👥 MFA] Reading MFA...", userId)

  const token = await getToken()
  if (!token) {
    res.status(500).json({ message: "MFA status couldn't be updated" })
    return
  }

  const mfaStatus = await readMfa({ userId, token })

  if (mfaStatus != 'not_found') {
    return res.status(200).json({ 
      mfaStatus
    })
  } else {
    return res.status(500).json({ message: "MFA status couldn't be read" })
  }
}
