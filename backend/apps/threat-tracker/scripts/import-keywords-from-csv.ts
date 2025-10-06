/**
 * Import keywords from CSV or JSON data
 * This script helps import production keywords with proper categorization
 */

import { db } from 'backend/db/db';
import { threatKeywords } from '@shared/db/schema/threat-tracker';
import { eq, and } from 'drizzle-orm';
import { log } from 'backend/utils/log';
import * as fs from 'fs';
import * as path from 'path';

interface ImportKeyword {
  term: string;
  category: 'threat' | 'vendor' | 'client' | 'hardware';
  userId?: string;
  active?: boolean;
}

// Sample data based on the screenshot - you can expand this
const SAMPLE_KEYWORDS: ImportKeyword[] = [
  // Vendors
  { term: 'Microsoft', category: 'vendor', active: true },
  { term: 'intellectdesign', category: 'vendor', active: true },
  { term: 'Vision Service Plan Inc', category: 'vendor', active: true },
  { term: 'thequakerproject', category: 'vendor', active: true },
  { term: 'bitraser', category: 'vendor', active: true },
  { term: 'Darktrace', category: 'vendor', active: true },
  { term: 'Nitro Software, Inc.', category: 'vendor', active: true },
  { term: 'BlackLine', category: 'vendor', active: true },
  { term: 'CARET Legal', category: 'vendor', active: true },
  { term: 'ZScaler', category: 'vendor', active: true },
  { term: 'Accurate Background', category: 'vendor', active: true },
  { term: 'John Hancock', category: 'vendor', active: true },
  { term: 'China Pacific Insurance', category: 'vendor', active: true },
  { term: 'EQuest LLC', category: 'vendor', active: true },
  { term: 'Arbitration Forums, Inc.', category: 'vendor', active: true },
  { term: 'Distinguished Programs', category: 'vendor', active: true },
  { term: 'Deloitte U.S.', category: 'vendor', active: true },
  { term: 'Palo Alto Networks, Inc.', category: 'vendor', active: true },
  { term: 'SendGrid', category: 'vendor', active: true },
  { term: 'darka', category: 'vendor', active: true },
  { term: 'Focused Consulting', category: 'vendor', active: true },
  { term: 'Flashpoint', category: 'vendor', active: true },
  { term: 'Ward Group', category: 'vendor', active: true },
  { term: 'Workiva Inc.', category: 'vendor', active: true },
  { term: 'Amazon Web Services', category: 'vendor', active: true },
  
  // Hardware
  { term: 'Windows', category: 'hardware', active: false },
  { term: 'Azure', category: 'hardware', active: true },
  { term: 'Dell', category: 'hardware', active: true },
  { term: 'iPhone', category: 'hardware', active: true },
  { term: 'Dell Latitude', category: 'hardware', active: true },
  
  // Clients
  { term: 'Berkshire Hathaway (GEICO)', category: 'client', active: true },
  { term: 'MetLife', category: 'client', active: true },
  { term: 'Allstate', category: 'client', active: true },
];

async function importKeywords(
  keywords: ImportKeyword[], 
  userId?: string,
  clearExisting: boolean = false
): Promise<void> {
  try {
    log('🚀 Starting keyword import...');
    
    if (clearExisting && userId) {
      log('🗑️ Clearing existing user keywords...');
      await db.delete(threatKeywords)
        .where(eq(threatKeywords.userId, userId));
    }
    
    let imported = 0;
    let skipped = 0;
    let errors = 0;
    
    for (const keyword of keywords) {
      try {
        // Check if keyword already exists
        const existing = await db.select()
          .from(threatKeywords)
          .where(
            and(
              eq(threatKeywords.term, keyword.term),
              userId ? eq(threatKeywords.userId, userId) : eq(threatKeywords.userId, threatKeywords.userId)
            )
          )
          .limit(1);
        
        if (existing.length > 0) {
          log(`⏭️ Skipping existing keyword: ${keyword.term}`);
          skipped++;
          continue;
        }
        
        // Insert new keyword
        await db.insert(threatKeywords)
          .values({
            term: keyword.term,
            category: keyword.category,
            userId: keyword.userId || userId,
            active: keyword.active ?? true,
            createdAt: new Date(),
            updatedAt: new Date()
          });
        
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
    
  } catch (error: any) {
    log(`❌ Import failed: ${error.message}`);
    throw error;
  }
}

async function loadFromCSV(filePath: string): Promise<ImportKeyword[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',').map(h => h.trim());
  
  const keywords: ImportKeyword[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: any = {};
    
    headers.forEach((header, index) => {
      row[header] = values[index];
    });
    
    if (row.term && row.category) {
      keywords.push({
        term: row.term,
        category: row.category as any,
        active: row.active === 'TRUE' || row.active === 'true',
        userId: row.user_id || row.userId
      });
    }
  }
  
  return keywords;
}

async function loadFromJSON(filePath: string): Promise<ImportKeyword[]> {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

// Run import if called directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const filePath = args.find(arg => !arg.startsWith('--'));
  const userId = args.find(arg => arg.startsWith('--user='))?.split('=')[1];
  const clearExisting = args.includes('--clear');
  const useSample = args.includes('--sample');
  
  if (args.includes('--help') || (!filePath && !useSample)) {
    console.log(`
Keyword Import Script
Usage: tsx import-keywords-from-csv.ts [file.csv|file.json] [options]

Options:
  --user=<userId>  Import keywords for specific user
  --clear          Clear existing user keywords before importing
  --sample         Use built-in sample data
  --help           Show this help message

Examples:
  tsx import-keywords-from-csv.ts keywords.csv --user=user123
  tsx import-keywords-from-csv.ts keywords.json --user=user123 --clear
  tsx import-keywords-from-csv.ts --sample --user=user123

CSV Format:
  term,category,active,user_id
  Microsoft,vendor,true,user123
  iPhone,hardware,true,user123
    `);
    process.exit(0);
  }
  
  (async () => {
    try {
      let keywords: ImportKeyword[];
      
      if (useSample) {
        log('📦 Using sample data...');
        keywords = SAMPLE_KEYWORDS;
      } else if (filePath) {
        const ext = path.extname(filePath).toLowerCase();
        
        if (ext === '.csv') {
          log(`📁 Loading keywords from CSV: ${filePath}`);
          keywords = await loadFromCSV(filePath);
        } else if (ext === '.json') {
          log(`📁 Loading keywords from JSON: ${filePath}`);
          keywords = await loadFromJSON(filePath);
        } else {
          throw new Error('Unsupported file format. Use .csv or .json');
        }
      } else {
        throw new Error('No input source specified');
      }
      
      log(`📊 Found ${keywords.length} keywords to import`);
      
      await importKeywords(keywords, userId, clearExisting);
      
      log('✅ Import completed successfully!');
      process.exit(0);
      
    } catch (error: any) {
      console.error('Import failed:', error.message);
      process.exit(1);
    }
  })();
}