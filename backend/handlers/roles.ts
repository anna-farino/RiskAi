import { Request, Response } from "express";
import { roles } from '@shared/db/schema/rbac';
import { withUserContext } from "backend/db/with-user-context";


export async function handleGetRoles(req: Request, res: Response) {
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
}




