import { createUser } from "backend/utils/auth0/manage-users/create-user";
import { getToken } from "backend/utils/auth0/get-token";
import { Request, Response } from "express";

export async function handleCreateUser(req: Request, res: Response) {
  try {
    const { email, password } = req.body
    console.error("[👥 USERS] Creating user... (email, psw length):", email, password?.length)

    if (!email) {
      console.error("[👥 USERS] No email found")
      return res.status(400).json({ message: "No email found"})
    }
    if (!password) {
      console.error("[👥 USERS] No password found")
      return res.status(400).json({ message: "No password found"})
    }

    const token = await getToken()
    if (!token) {
      res.status(500).json({ message: "Token couldn't be retrieved" })
      return
    }
    const userCreated = await createUser({ email, password, token })
    if (userCreated) {
      return res.status(200).json({ message: `User for ${email} successfully created`})
    } else {
      return res.status(500).json({ message: `Couldn't create user for ${email}` })
    }
  } catch(error) {
    console.error(error)
    return res.status(500).json({ message: `Couldn't create new user` })
  }
}
