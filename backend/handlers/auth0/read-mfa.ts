import { auth0Ids } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { getToken } from "backend/utils/auth0/get-token";
import { readMfa } from "backend/utils/auth0/read-mfa";
import { eq } from "drizzle-orm";
import { Request, Response } from "express";

export async function handleReadMfa(req: Request, res: Response) {
  const { userId } = req.params
  console.error("[👥 MFA] Reading MFA...", userId)

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
    const mfaStatus = await readMfa({ 
      userId: auth0Id, 
      token 
    })

    if (mfaStatus != 'not_found') {
      return res.status(200).json({ 
        mfaStatus
      })
    } else {
      return res.status(500).json({ message: "MFA status couldn't be read" })
    }
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: "Error while reading MFA status"})
  }
}
