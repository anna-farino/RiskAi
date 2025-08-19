import { Request, Response } from 'express';
import { db } from '../db/db';
import { dbHealthCheck } from '@shared/db/schema/db-health-check';
import { sql } from 'drizzle-orm';

export async function handleDatabaseHealthCheck(req: Request, res: Response) {
  const startTime = Date.now();
  
  try {
    // Test 1: Basic database connection
    await db.execute(sql`SELECT 1`);
    
    // Test 2: Check if RLS is properly configured
    // This should fail without proper user context
    let rlsEnforced = false;
    try {
      await db.select().from(dbHealthCheck).limit(1);
    } catch (error) {
      // Expected to fail - RLS is working
      rlsEnforced = true;
    }
    
    // Test 3: Test with user context (simulating authenticated request)
    const testUserId = 'health-check-test-user';
    let userContextTest = false;
    
    try {
      // Set user context like your auth middleware does
      await db.execute(sql`SELECT set_config('app.current_user_id', ${testUserId}, true)`);
      
      // Try to read - should work now
      await db.select().from(dbHealthCheck).where(sql`user_id = ${testUserId}`).limit(1);
      userContextTest = true;
      
      // Clean up: reset the context
      await db.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
    } catch (error) {
      console.error('User context test failed:', error);
    }
    
    // Test 4: Write test (create a health check record)
    let writeTest = false;
    try {
      await db.execute(sql`SELECT set_config('app.current_user_id', ${testUserId}, true)`);
      
      await db.insert(dbHealthCheck).values({
        userId: testUserId,
        checkName: 'automated-health-check',
        lastUpdated: new Date()
      }).onConflictDoNothing();
      
      writeTest = true;
      
      // Clean up the test record
      await db.delete(dbHealthCheck)
        .where(sql`user_id = ${testUserId} AND check_name = 'automated-health-check'`);
      
      await db.execute(sql`SELECT set_config('app.current_user_id', '', true)`);
    } catch (error) {
      console.error('Write test failed:', error);
    }
    
    const responseTime = Date.now() - startTime;
    const allTestsPassed = rlsEnforced && userContextTest && writeTest;
    
    const healthStatus = {
      status: allTestsPassed ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      tests: {
        connection: true,
        rls_enforced: rlsEnforced,
        user_context: userContextTest,
        write_operations: writeTest
      },
      details: allTestsPassed ? 'All database tests passed' : 'Some database tests failed'
    };
    
    console.log('🏥 Database health check completed:', healthStatus);
    
    res.status(allTestsPassed ? 200 : 503).json(healthStatus);
    
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    
    const responseTime = Date.now() - startTime;
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      responseTime: `${responseTime}ms`,
      error: 'Database connection failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}