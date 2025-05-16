import { db, pool } from "./backend/db/db";
import { sql } from "drizzle-orm";

async function main() {
  try {
    // Try to execute the query using the existing database connection
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS replit_test (
        x INTEGER
      );
    `);
    
    console.log('Table replit_test created successfully!');
    
    // Optional: Insert a test value
    await db.execute(sql`INSERT INTO replit_test (x) VALUES (42);`);
    console.log('Test value inserted successfully!');
    
    // Query to verify
    const result = await db.execute(sql`SELECT * FROM replit_test;`);
    console.log('Query result:', result);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Make sure to close the connection
    await pool.end?.();
    process.exit(0);
  }
}

main();