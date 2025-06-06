import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./db";
import { eq } from "drizzle-orm";
import {
  permissions,
  rolesPermissions,
  rolesUsers,
} from "@shared/db/schema/rbac";
import { Request } from "express";

export async function withUserContext<T>(
  userId: string,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>,
  req?: Request,
): Promise<T> {
  const client = await pool.connect();
  let reqLog: (...args: unknown[]) => void;
  if (req) reqLog = (req as any).log;

  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);

    // req && reqLog('[🔒 WITH USER CONTEXT] 👤 app.current_user_id:', userId);

    const currentUser = await client.query(`SELECT current_user`);
    // req && reqLog('[🔒 WITH USER CONTEXT] 👤 Current PostgreSQL user:', currentUser.rows[0].current_user);

    //const showDbUser = await client.query('SHOW app.current_user_id')
    //req && reqLog('[🔒 WITH USER CONTEXT] 👤 user id from db:', showDbUser);

    const db = drizzle(client);
    const perms = await db
      .select({ name: permissions.name })
      .from(rolesUsers)
      .innerJoin(
        rolesPermissions,
        eq(rolesUsers.roleId, rolesPermissions.roleId),
      )
      .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(rolesUsers.userId, userId));

    const permissionNames = perms.map((p) => p.name).filter(Boolean);
    // req && reqLog("[🔒 WITH USER CONTEXT] permissionNames", permissionNames)
    const pgArrayString =
      permissionNames.length > 0
        ? `{${permissionNames.map((p) => `"${p}"`).join(",")}}`
        : "{}";

    await client.query(
      `SET LOCAL app.current_user_permissions = '${pgArrayString}'`,
    );

    const result = await fn(db);

    await client.query("COMMIT");

    // req && reqLog("[🔒 WITH USER CONTEXT] pgArrayString", pgArrayString)

    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    try {
      client.release();
    } catch (e) {
      console.error("Error releasing client:", e);
    }
  }
}
