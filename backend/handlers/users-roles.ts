import { Request, Response } from "express";
import { db } from "../db/db";
import { User, users } from "@shared/db/schema/user";
import { roles, rolesUsers } from "@shared/db/schema/rbac";
import { eq, sql } from "drizzle-orm";
import { withUserContext } from "backend/db/with-user-context";


export async function handleGetUsersRoles(req: Request, res: Response) {
  console.log("🚫👤 [USERS ROLES] Getting users roles...")

  const user = (req as any).user as User
  const userId = user.id;

  const usersRoles = await withUserContext(
    userId,
    (db) => {
      return db
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
        .orderBy(users.id)
    }
  )

    
  res.status(200).json(usersRoles)
}


export async function handleEditUsersRoles(req: Request, res: Response) {
  const { userId, roleName } = req.params;
  console.log("📝🚫👤 [EDIT USERS ROLES] userId, roleName:", userId, roleName)

  try {
    const userRoleResult = await db
      .select()
      .from(rolesUsers)
      .where(eq(rolesUsers.userId,userId))

    if (userRoleResult.length === 0) {
      const insertResult = await db
        .insert(rolesUsers)
        .values({
          userId,
          roleId: sql`(select id from roles where name=${roleName})`
        })

      console.log("📝🚫👤 [EDIT USERS ROLES] Update role:", insertResult)

    } else {
      const response = await db
        .update(rolesUsers)
        .set({ roleId: sql`(select id from roles where name=${roleName})`})
        .where(eq(rolesUsers.userId, userId))
        .returning()

      console.log("📝🚫👤 [EDIT USERS ROLES] Update role:", response)
    }

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
      .orderBy(users.id)

    console.log("📝🚫👤 [EDIT USERS ROLES] New users-roles:", newUserRoles)

    res.status(200).json(newUserRoles)
  } catch(error) {
    console.error("📝🚫👤 [EDIT USERS ROLES] An error occurred")
    res.status(500).json({ message: "An error occurred while updating the user's role"})
  }
}

