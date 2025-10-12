import { auth0Ids, users } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { getToken } from "backend/utils/auth0/get-token";
import { setMfa } from "backend/utils/auth0/set-mfa";
import { eq } from "drizzle-orm";
import { Request, Response } from "express";

export async function handleSetMfa(req: Request, res: Response) {
  const { twoFactorEnabled } = req.body
  const { userId } = req.params
  console.log("[👥 MFA] Setting MFA...", userId, twoFactorEnabled)

  if (twoFactorEnabled == null) {
    console.error("[👥 MFA: no MFA option found]")
    return res.status(400).json({ message: "No MFA option found"})
  }

  try {
    const token = await getToken()
    if (!token) {
      res.status(500).json({ message: "MFA status couldn't be updated" })
      return
    }

    const result = await db
      .select({ auth0Id: auth0Ids.auth0Id })
      .from(auth0Ids)
      .where(eq(auth0Ids.userId,userId))
      .limit(1)

    if (result.length === 0) {
      console.log("Auth0ids not found")
      return res.send(500).json({ message: "Error: auth0 id couldn't be retrieved"})
    }

    console.log("[👥 MFA]: result", result)

    const { auth0Id } = result[0]

    const mfaWasUpdate = await setMfa({ 
      newStatus: twoFactorEnabled, 
      userId: auth0Id,
      token
    })

    if (mfaWasUpdate) {
      console.log("updating user table twoFactorEnabled with: ", twoFactorEnabled)
      await db
        .update(users)
        .set({ twoFactorEnabled: twoFactorEnabled })
        .where(eq(users.id,userId))

      return res.status(200).json({ message: "MFA choice successfully updated"})
    } else {
      return res.status(500).json({ message: "MFA status couldn't be updated" })
    }
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Error while setting MFA status" })
  }
}
