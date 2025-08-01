import { getToken } from "backend/utils/auth0/get-token";
import { setMfa } from "backend/utils/auth0/setMfa";
import { Request, Response } from "express";

export async function handleSetMfa(req: Request, res: Response) {
  const { twoFactorEnabled } = req.body
  const { userId } = req.params
  console.error("[👥 MFA] Setting MFA...", userId, twoFactorEnabled)

  if (twoFactorEnabled == null) {
    console.error("[👥 MFA: no MFA option found]")
    return res.status(400).json({ message: "No MFA option found"})
  }

  const token = await getToken()
  if (!token) {
    res.status(500).json({ message: "MFA status couldn't be updated" })
    return
  }

  const mfaWasUpdate = await setMfa({ 
    newStatus: twoFactorEnabled, 
    userId,
    token
  })

  if (mfaWasUpdate) {
    return res.status(200).json({ message: "MFA choice successfully updated"})
  } else {
    return res.status(500).json({ message: "MFA status couldn't be updated" })
  }
}
