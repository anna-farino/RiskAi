import { Request, Response } from "express";
import { roles } from '@shared/db/schema/rbac';
import { withUserContext } from "backend/db/with-user-context";


export async function handleGetRoles(req: Request, res: Response) {
  try {
    const { id } = req.params

    const data = await withUserContext(
      id,
      async (db) => {
        return db
          .select({ name: roles.name })
          .from(roles)
      }
    )

    console.log("👥 [ROLES]: ", data)

    res.status(200).json(data)
  } catch(error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred";
    (req as Request & { log: (_: string)=>void }).log(error)
    res.status(500).json({ message })
  }
}




