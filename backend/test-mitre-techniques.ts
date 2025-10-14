import { mitreSyncService } from './services/mitre-sync';
import { db } from './db/db';
import { threatKeywords } from '@shared/db/schema/threat-tracker/index';
import { eq, sql } from 'drizzle-orm';

async function testMitreTechniques() {
  console.log('Testing MITRE techniques sync...');
  
  try {
    // Check before sync
    const beforeCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatKeywords)
      .where(sql`term LIKE 'T%' AND term LIKE '%-%'`);
    
    console.log(`Before sync: ${beforeCount[0].count} MITRE techniques in database`);
    
    // Run sync
    await mitreSyncService.syncMitreData();
    
    // Check after sync
    const afterCount = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(threatKeywords)
      .where(sql`term LIKE 'T%' AND term LIKE '%-%'`);
    
    console.log(`After sync: ${afterCount[0].count} MITRE techniques in database`);
    
    // Show sample techniques
    const samples = await db
      .select()
      .from(threatKeywords)
      .where(sql`term LIKE 'T%' AND term LIKE '%-%'`)
      .limit(5);
    
    if (samples.length > 0) {
      console.log('\nSample MITRE techniques:');
      samples.forEach(s => console.log(`- ${s.term}`));
    } else {
      console.log('\nNo MITRE techniques found in database!');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

testMitreTechniques();