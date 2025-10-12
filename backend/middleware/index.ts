import express from 'express';
import dotenv from 'dotenv'
import { User } from '@shared/db/schema/user';
import { permissions, rolesPermissions, roles, rolesUsers } from '@shared/db/schema/rbac';
import { eq } from 'drizzle-orm';
import { withUserContext } from 'backend/db/with-user-context';

dotenv.config()
export const SECRET = process.env.JWT_SECRET || 'secret';

export type FullRequest = express.Request & { 
  user: User 
    & { permissions?: string[] } 
    & { role? : string | undefined | null }
};

async function getUserRole(userId: string, req?: express.Request ) {
  const userRole = await withUserContext(
    userId,
    async (db) => {
      return await db
        .select({ role: roles.name })
        .from(rolesUsers)
        .leftJoin(roles, eq(rolesUsers.roleId,roles.id))
        .where(eq(rolesUsers.userId,userId))
    },
    req
  );

  if (userRole.length === 0) return undefined
  else return userRole[0].role
}

async function getUserPermissions(userId: string) {
	return await withUserContext(userId, async (db) => {
    const userPermissions = await db
      .select({ name: permissions.name })
      .from(rolesUsers)
      .leftJoin(roles, eq(rolesUsers.roleId, roles.id))
      .leftJoin(rolesPermissions, eq(roles.id, rolesPermissions.roleId))
      .leftJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(rolesUsers.userId, userId));

    const permissionNames = userPermissions
      .map((p) => p.name)
      .filter((name): name is string => !!name); // only non-empty names

    return permissionNames;
  });
}


export async function attachPermissionsAndRoleToRequest(userId: string, req: express.Request) {
  console.log("Attaching permissions and role to request...")

  const userRole = await getUserRole(userId, req)
  const userPermissions = await getUserPermissions(userId);

  (req as unknown as FullRequest).user.permissions = userPermissions;
  (req as unknown as FullRequest).user.role = userRole;
}
