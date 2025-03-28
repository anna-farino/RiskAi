import { Request, Response } from "express";
import { db } from "../db/db";
import { roles } from "../db/schema/rbac";


export async function handleGetRoles(_req: Request, res: Response) {

  const data = await db
    .select({ name: roles.name })
    .from(roles)

  console.log("👥 [ROLES]: ", data)

  res.status(200).json(data)
}




