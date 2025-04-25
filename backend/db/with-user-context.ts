import { drizzle } from 'drizzle-orm/node-postgres';
import { pool } from './db';
import { eq } from 'drizzle-orm';
import { permissions, rolesPermissions, rolesUsers } from '@shared/db/schema/rbac';

export async function withUserContext<T>(
  userId: string,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>
)
  : Promise<T> 
{
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL app.current_user_id = '{$userId}'`);

    const currentUser = await client.query(`SELECT current_user`);
    console.log('👤 Current PostgreSQL user:', currentUser.rows[0].current_user);


    const db = drizzle(client);
    const perms = await db
      .select({ name: permissions.name })
      .from(rolesUsers)
      .innerJoin(rolesPermissions, eq(rolesUsers.roleId, rolesPermissions.roleId))
      .innerJoin(permissions, eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(rolesUsers.userId, userId));

    const permissionNames = perms.map(p => p.name); 
    console.log("[🔒 WITH USER CONTEXT] permissionNames", permissionNames)

    const pgArrayString = `{${permissionNames.map(p => `"${p}"`).join(',')}}`;
    await client.query(`SET LOCAL app.current_user_permissions = '${pgArrayString}'`);

    const result = await fn(db);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
