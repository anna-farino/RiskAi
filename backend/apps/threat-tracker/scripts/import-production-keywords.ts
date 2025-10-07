/**
 * Import production keywords directly into the development database
 * This bypasses row-level security policies by using raw SQL
 */

import { db } from 'backend/db/db';
import { sql } from 'drizzle-orm';
import { log } from 'backend/utils/log';
import * as fs from 'fs';

interface ProductionKeyword {
  id: string;
  term: string;
  category: 'threat' | 'vendor' | 'client' | 'hardware';
  active: boolean;
  userId?: string;
  isDefault?: boolean;
}

// Based on your screenshot, here are some example keywords to import
const PRODUCTION_KEYWORDS: ProductionKeyword[] = [
  // Vendors from screenshot
  { id: '00034072-599d-425b-b43...', term: 'Microsoft', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '002507dd-1799-4132-8e1...', term: 'intellectdesign', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '002d025e-d940-4d42-991...', term: 'Vision Service Plan Inc', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '015caf8a-4bc9-42e9-ba0...', term: 'thequakerproject', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '01f2fc2f-e4cb-4d12-811...', term: 'bitraser', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02639610-8f21-434c-b3b...', term: 'Darktrace', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02832932-3200-47ab-908...', term: 'Nitro Software, Inc.', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02a50b79-4c85-4096-92c...', term: 'BlackLine', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02b99b45-ee44-4f35-a37...', term: 'CARET Legal', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02cfadf3-df4f-45ae-87c...', term: 'ZScaler', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '02d01e46-7efd-4b7b-bae...', term: 'Accurate Background', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03005566-0fd9-4194-897...', term: 'John Hancock', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03119934-966d-4cd2-958...', term: 'China Pacific Insurance', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03168b18-a13f-4742-b9f...', term: 'EQuest LLC', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03642333-0b20-44cb-b76...', term: 'Arbitration Forums, Inc.', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03be1b90-d48f-46f8-990...', term: 'Distinguished Programs', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '03da7e03-4a06-451c-867...', term: 'Deloitte U.S.', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '04000a98-0643-42b5-af1...', term: 'Palo Alto Networks, Inc.', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '04202099-8ce0-40f8-9a9...', term: 'SendGrid', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '0460da1e-1752-457b-97e...', term: 'darka', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '04885caa-46dd-4fb6-8e3...', term: 'Focused Consulting', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '048de807-ed10-4648-ab5...', term: 'Flashpoint', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '04d6bae2-87cf-4ac3-947...', term: 'Ward Group', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '050507bf-23af-4887-90e...', term: 'Workiva Inc.', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  { id: '05062014-a124-4cd9-b3c...', term: 'Amazon Web Services', category: 'vendor', active: true, userId: 'YOUR_USER_ID' },
  
  // Hardware from screenshot
  { id: '006cf3dc-b53b-4615-b43...', term: 'Windows', category: 'hardware', active: false, userId: 'YOUR_USER_ID' },
  { id: '00a4b4f3-a7e0-47ca-9d8...', term: 'Azure', category: 'hardware', active: true, userId: 'YOUR_USER_ID' },
  { id: '021ace8f-899d-44ec-841...', term: 'Azure', category: 'hardware', active: true, userId: 'YOUR_USER_ID' }, // duplicate?
  { id: '0268a08a-ed04-4e8b-b61...', term: 'Dell', category: 'hardware', active: true, userId: 'YOUR_USER_ID' },
  { id: '02f47196-6076-4e4e-bdc...', term: 'iPhone', category: 'hardware', active: true, userId: 'YOUR_USER_ID' },
  { id: '03579761-beb9-458b-a6f...', term: 'Dell Latitude', category: 'hardware', active: true, userId: 'YOUR_USER_ID' },
  
  // Clients from screenshot
  { id: '0306b4cc-3389-4907-b17...', term: 'Berkshire Hathaway (GEICO)', category: 'client', active: true, userId: 'YOUR_USER_ID' },
  { id: '042a5c8e-3126-442e-b8c...', term: 'MetLife', category: 'client', active: true, userId: 'YOUR_USER_ID' },
  { id: '0532c144-6167-47ac-a84...', term: 'Allstate', category: 'client', active: true, userId: 'YOUR_USER_ID' },
];

async function importProductionKeywords(
  keywords: ProductionKeyword[] = PRODUCTION_KEYWORDS,
  clearExisting: boolean = false
): Promise<void> {
  try {
    log('🚀 Starting production keyword import...');
    
    // First, get a valid user ID from your database
    const users = await db.execute(sql`SELECT id FROM users LIMIT 1`);
    const userId = users.rows[0]?.id;
    
    if (!userId && keywords.some(k => k.userId)) {
      log('⚠️ No users found in database. Creating keywords without user association.');
    }
    
    // Update keywords with actual user ID if needed
    const keywordsWithUserId = keywords.map(k => ({
      ...k,
      userId: k.userId === 'YOUR_USER_ID' ? userId : k.userId
    }));
    
    if (clearExisting && userId) {
      log('🗑️ Clearing existing user keywords...');
      await db.execute(sql`
        DELETE FROM threat_keywords 
        WHERE user_id = ${userId}
      `);
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const keyword of keywordsWithUserId) {
      try {
        // Check if keyword already exists
        const existing = await db.execute(sql`
          SELECT id FROM threat_keywords 
          WHERE term = ${keyword.term} 
          ${keyword.userId ? sql`AND user_id = ${keyword.userId}` : sql`AND user_id IS NULL`}
          LIMIT 1
        `);
        
        if (existing.rows.length > 0) {
          log(`⏭️ Skipping existing keyword: ${keyword.term}`);
          skipped++;
          continue;
        }
        
        // Insert using raw SQL to bypass RLS policies
        await db.execute(sql`
          INSERT INTO threat_keywords (
            id,
            term,
            category,
            active,
            user_id,
            is_default,
            created_at,
            updated_at
          ) VALUES (
            gen_random_uuid(),
            ${keyword.term},
            ${keyword.category}::text,
            ${keyword.active},
            ${keyword.userId || null},
            ${keyword.isDefault || false},
            NOW(),
            NOW()
          )
        `);
        
        imported++;
        log(`✅ Imported: ${keyword.term} (${keyword.category})`);
        
      } catch (error: any) {
        errors++;
        log(`❌ Failed to import "${keyword.term}": ${error.message}`);
      }
    }
    
    log(`\n📊 Import Summary:`);
    log(`   ✅ Imported: ${imported}`);
    log(`   ⏭️ Skipped: ${skipped}`);
    log(`   ❌ Errors: ${errors}`);
    
    // Verify the import
    const stats = await db.execute(sql`
      SELECT category, COUNT(*) as count 
      FROM threat_keywords 
      GROUP BY category
      ORDER BY category
    `);
    
    log('\n📈 Current keyword distribution:');
    stats.rows.forEach(row => {
      log(`   - ${row.category}: ${row.count}`);
    });
    
  } catch (error: any) {
    log(`❌ Import failed: ${error.message}`);
    throw error;
  }
}

async function exportCurrentKeywords(): Promise<void> {
  try {
    const keywords = await db.execute(sql`
      SELECT id, term, category, active, user_id, is_default
      FROM threat_keywords
      ORDER BY category, term
    `);
    
    const exportData = keywords.rows.map(row => ({
      id: row.id,
      term: row.term,
      category: row.category,
      active: row.active,
      userId: row.user_id,
      isDefault: row.is_default
    }));
    
    const filename = `keywords-export-${new Date().toISOString().slice(0, 10)}.json`;
    fs.writeFileSync(filename, JSON.stringify(exportData, null, 2));
    
    log(`📁 Exported ${exportData.length} keywords to ${filename}`);
  } catch (error: any) {
    log(`❌ Export failed: ${error.message}`);
    throw error;
  }
}

// Run import if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const clearExisting = args.includes('--clear');
  const exportOnly = args.includes('--export');
  
  if (args.includes('--help')) {
    console.log(`
Production Keyword Import Script
Usage: tsx import-production-keywords.ts [options]

Options:
  --clear     Clear existing user keywords before importing
  --export    Export current keywords to JSON file
  --help      Show this help message

Examples:
  tsx import-production-keywords.ts           # Import sample production data
  tsx import-production-keywords.ts --clear   # Clear and import
  tsx import-production-keywords.ts --export  # Export current keywords

Note: Edit the PRODUCTION_KEYWORDS array in this file to match your actual data,
or modify the script to load from a JSON file.
    `);
    process.exit(0);
  }
  
  (async () => {
    try {
      if (exportOnly) {
        await exportCurrentKeywords();
      } else {
        await importProductionKeywords(PRODUCTION_KEYWORDS, clearExisting);
        
        log('\n🚀 Now you can run the migration:');
        log('   tsx migrate-keywords-to-entities.ts');
      }
      
      process.exit(0);
      
    } catch (error: any) {
      console.error('Import failed:', error.message);
      process.exit(1);
    }
  })();
}