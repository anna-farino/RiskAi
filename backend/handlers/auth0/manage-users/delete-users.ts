import { getToken } from "backend/utils/auth0/get-token";
import pLimit from 'p-limit'
import { Response } from "express";
import deleteUser from "./utils/delete-users";
import { FullRequest } from "backend/middleware";
import { db } from "backend/db/db";
import { users } from "@shared/db/schema/user";
import { eq } from "drizzle-orm";
import isUserOrgAdmin from "./utils/check-is-org-admin";


export default async function deleteUsersHandler(req: FullRequest, res: Response) {
  console.log("Delete users handler")
  try {
    const reqUserId = req.user.id
    if (!reqUserId) {
      console.error("No reqUserId found")
      res.status(400).json({ message: "Error: No reqUserId provided"})
      return
    }
    const { userIds } = req.body 
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      res.status(400).json({ message: "Error: No user ids provided"})
      return
    }

    const token = await getToken()
    const limit = pLimit(5)

    const results = await Promise.allSettled(
      userIds.map(userId =>
        limit(async () => {
          const res = await db
            .select({ organizationId: users.organizationId})
            .from(users)
            .where(eq(users.id,userId))

          if (res.length === 0) {
            console.error("User is member of no organization")
            return({ userId, status: 418 })
          }
          const organizationId = res[0].organizationId
          if (!organizationId) {
            console.error("User has no organization")
            return({ userId, status: 418 })
          }
          const isOrgAdmin = await isUserOrgAdmin({ reqUserId, organizationId })
          if (!isOrgAdmin) {
            console.error("ReqUser is not the admin of this organization")
            return({ userId, status: 403 })
          }

          return deleteUser({ userId, token })
        })
      )
    )

    const summary = {
      deleted: results
        .filter(r => r.status === "fulfilled" && r.value.status === 204)
        .map(r => (r as { value: { userId: string }}).value.userId),
      notFound: results
        .filter(r => r.status === "fulfilled" && r.value.status === 404)
        .map(r => (r as { value: { userId: string }}).value.userId),
      noOrg: results
        .filter(r => r.status === "fulfilled" && r.value.status === 418)
        .map(r => (r as { value: { userId: string }}).value.userId),
      forbidden: results
        .filter(r => r.status === "fulfilled" && r.value.status === 403)
        .map(r => (r as { value: { userId: string }}).value.userId),
      failed: results
        .filter(r => r.status === "rejected")
        .map(r => ({ id: userIds[results.indexOf(r)], error: r.reason.message })),
    };

    res.json(summary);

  } catch(error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    console.error(message)
    res.status(500).json({ message })
  }
}
