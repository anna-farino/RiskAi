import { Request, Response } from "express";
import { db } from "../db/db";
import { users } from "../db/schema/user";
import { roles, rolesUsers } from "../db/schema/rbac";
import { eq, sql } from "drizzle-orm";


export async function handleGetUsersRoles(_req: Request, res: Response) {
  const usersRoles = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userRole: roles.name
    })
    .from(users)
    .leftJoin(
      rolesUsers,
      eq(users.id,rolesUsers.userId)
    )
    .leftJoin(
      roles,
      eq(rolesUsers.roleId,roles.id)
    )

  console.log("🚫👤 [USERS ROLES]", usersRoles)
    
  res.status(200).json(usersRoles)
}

export async function handleEditUsersRoles(req: Request, res: Response) {
  const { userId, roleName } = req.params;

  const response = await db
    .update(rolesUsers)
    .set({ roleId: sql`(select id from roles where name=${roleName})`})
    .where(eq(rolesUsers.userId, userId))
    .returning()

  console.log("📝🚫👤 [EDIT USERS ROLES] Update role:", response)

  const newUserRoles = await db
    .select({
      userId: users.id,
      userName: users.name,
      userEmail: users.email,
      userRole: roles.name
    })
    .from(users)
    .leftJoin(
      rolesUsers,
      eq(users.id,rolesUsers.userId)
    )
    .leftJoin(
      roles,
      eq(rolesUsers.roleId,roles.id)
    )

  console.log("📝🚫👤 [EDIT USERS ROLES] New users-roles:", newUserRoles)

  res.status(200).json(newUserRoles)
}

