import { drizzle } from "drizzle-orm/node-postgres";
import { pool } from "./db";
import { Request } from "express";

export async function withUserContext<T>(
  userId: string,
  fn: (db: ReturnType<typeof drizzle>) => Promise<T>,
  req?: Request,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`);

    //console.log('[🔒 WITH USER CONTEXT] 👤 app.current_user_id:', userId);
    //const currentUser = await client.query(`SELECT current_user`);
    //console.log('[🔒 WITH USER CONTEXT] 👤 Current PostgreSQL user:', currentUser.rows[0].current_user);
    //const showDbUser = await client.query('SHOW app.current_user_id')
    //console.log('[🔒 WITH USER CONTEXT] 👤 user id from db:', showDbUser);

    const db = drizzle(client);
    const result = await fn(db);

    await client.query("COMMIT");

    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    console.log("ROLLED BACK!")
    throw err;
  } finally {
    try {
      client.release();
    } catch (e) {
      console.error("Error releasing client:", e);
    }
  }
}
