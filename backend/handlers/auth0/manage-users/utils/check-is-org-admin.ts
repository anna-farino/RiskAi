import { organizations } from "@shared/db/schema/organizations"
import { roles, rolesUsers } from "@shared/db/schema/rbac"
import { users } from "@shared/db/schema/user"
import { db } from "backend/db/db"
import { eq, and } from "drizzle-orm"

type Args = {
  reqUserId: string,
  organizationId: string
}

export default async function isUserOrgAdmin({ reqUserId, organizationId }: Args) {

  const res = await db
    .select({
      role: roles.name,
      organizationId: organizations.id
    })
    .from(users)
    .innerJoin(organizations, eq(organizations.id,users.organizationId))
    .innerJoin(rolesUsers, eq(rolesUsers.userId,users.id))
    .innerJoin(roles, eq(roles.id,rolesUsers.roleId))
    .where(and(
      eq(users.id,reqUserId),
      eq(users.organizationId,organizationId)
    ))

  return res.length !== 0 && res[0].role === 'admin'
}
