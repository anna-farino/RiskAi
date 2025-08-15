import { User, users } from "@shared/db/schema/user";
import { db } from "backend/db/db";
import { eq } from "drizzle-orm";
import { Request, Response } from "express";

export async function handleSet2FA(req: Request, res: Response) {
  const { twoFactorEnabled } = req.body
  const { user } = req as Request & { user: User }


  console.log("handleSet2FA == user", user)

  if (twoFactorEnabled == null) {
    console.error("[👥 2FA: no 2fa option found]")
    return res.status(400).json({ message: "No 2fa option found"})
  }

  try {
    const userResult = await db
      .update(users)
      .set({ twoFactorEnabled })
      .where(eq(users.id, user.id))
      .returning()

    if (!userResult || userResult.length === 0) {
      console.error("[👥 2FA: No user returned]")
      return res.status(500).send()
    }

    return res.status(200).json({ message: "2FA choice successfully updated"})

  } catch(error) {
    console.error("[👥 2FA: ERROR]", error);
    return res.status(500).send()
  }
}
