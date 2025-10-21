import { getToken } from 'backend/utils/auth0/get-token'
import getUsersInfo from './utils/get-users'
import { Response } from 'express'
import { FullRequest } from 'backend/middleware'
import isUserOrgAdmin from './utils/check-is-org-admin'

export default async function getUsersInfoHandler(req: FullRequest & { log: (s: string)=>void }, res: Response) {
  try {
    const { organizationId } = req.params
    if (!organizationId) {
      const message="No organization found"
      req.log(message)
      res.status(400).json({ message })
      return
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
      const message="Failed to retrieve Auth0 token"
      req.log(message)
      res.status(500).json({ message })
      return
    }

    const users = await getUsersInfo({ token, organizationId })

    res.send(users)

  } catch(error) {
    const message = error instanceof Error ? error.message : "Error unknown"
    req.log(message)
    res.status(500).json({ message })
  }
}
