import { drizzle } from 'drizzle-orm/node-postgres';
import type { Request, Response, NextFunction } from 'express';
import { pool } from '../db/db'; 
import onFinished from 'on-finished';
import { User } from '@shared/db/schema/user';
import { permissions, rolesPermissions, rolesUsers } from '@shared/db/schema/rbac';
import { eq } from 'drizzle-orm';

declare module 'express-serve-static-core' {
  interface Request {
    db: ReturnType<typeof drizzle>,
    user: User 
      & { permissions?: string[] } 
      & { role? : string | undefined | null }
    }
}

export async function withDbContext(
  req: Request & { user?: { id: string } },
  res: Response,
  next: NextFunction
) {
  const client = await pool.connect();
  await client.query('BEGIN');

  try {
    const userId = req.user?.id ?? 'c320f636-a0b9-42ae-b653-5c0d2aadcba5';
    await client.query(
      `SET LOCAL app.current_user_id = '${userId}'`
    );

    const dbForPerms = drizzle(client);
    const perms = await dbForPerms
      .select({ name: permissions.name })
      .from(rolesUsers)
      .innerJoin(rolesPermissions, eq(rolesUsers.roleId, rolesPermissions.roleId))
      .innerJoin(permissions,    eq(rolesPermissions.permissionId, permissions.id))
      .where(eq(rolesUsers.userId, userId));

    const permNames = perms.map(p => p.name).filter(Boolean);
    const pgArray = permNames.length
      ? `{${permNames.map(n => `"${n}"`).join(',')}}`
      : '{}';

    await client.query(
      `SET LOCAL app.current_user_permissions = '${pgArray}'`
    );

    req.db = drizzle(client);

    onFinished(res, async (err) => {
      try {
        if (err || res.statusCode >= 400) {
          await client.query('ROLLBACK');
        } else {
          await client.query('COMMIT');
        }
      } finally {
        client.release();
      }
    });

    next();
  } catch (err) {
    await client.query('ROLLBACK');
    client.release();
    next(err);
  }
}
