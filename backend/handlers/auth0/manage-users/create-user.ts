import { FullRequest } from "backend/middleware";
import { createUser } from "./utils/create-user";
import { getToken } from "backend/utils/auth0/get-token";
import { Request, Response } from "express";
import isUserOrgAdmin from "./utils/check-is-org-admin";

export async function handleCreateUser(req: Request, res: Response) {
  try {
    const { email, password, organizationId } = req.body

    console.log("[👥 USERS] Creating user... (email, psw length):", email, password?.length)

    if (!email) {
      console.error("[👥 USERS] No email found")
      return res.status(400).json({ message: "No email found"})
    }
    if (!password) {
      console.error("[👥 USERS] No password found")
      return res.status(400).json({ message: "No password found"})
    }
    if (!organizationId) {
      console.error("[👥 USERS] No organizationId found")
      return res.status(400).json({ message: "No organizationId found"})
    }

    const reqUserId = (req as FullRequest)?.user?.id
    if (!reqUserId) {
      console.error("[👥 USERS] No reqUserId found")
      return res.status(400).json({ message: "No reqUserId found"})
    }

    const isAdmin = await isUserOrgAdmin({ reqUserId, organizationId })
    if (!isAdmin) {
      console.error("[👥 USERS] User is not the admin of this organization")
      return res.status(403).json({ message: "User is not the admin of this organization"})
    }

    const token = await getToken()
    if (!token) {
      res.status(500).json({ message: "Token couldn't be retrieved" })
      return
    }

    await createUser({ email, password, token, organizationId })

    return res.status(200).json({ message: `User for ${email} successfully created`})

  } catch(error) {
    console.log("[👥 USERS] Couldn't create user")

    const message = error instanceof Error
      ? error.message
      : "Failed to create user";

    return res.status(500).json({ message })
  }
}
