#!/usr/bin/env node
/**
 * DataDome Bypass Test Runner
 * Simple test script to verify the enhanced DataDome bypass system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function log(message) {
  console.log(`[${new Date().toISOString()}] ${message}`);
}

function runTest() {
  log('Starting DataDome Bypass System Test...');
  
  try {
    // Check if TypeScript files are compiled
    const testFile = path.join(__dirname, 'test/datadome-bypass-test.ts');
    if (!fs.existsSync(testFile)) {
      log('ERROR: Test file not found at test/datadome-bypass-test.ts');
      return;
    }
    
    log('Running TypeScript test file...');
    
    // Run the TypeScript test using tsx
    const result = execSync('npx tsx test/datadome-bypass-test.ts', { 
      cwd: __dirname,
      stdio: 'inherit',
      timeout: 300000 // 5 minutes timeout
    });
    
    log('DataDome bypass test completed successfully');
    
  } catch (error) {
    log('ERROR: Test failed with error:');
    console.error(error.message);
    
    // Provide helpful troubleshooting
    log('\nTroubleshooting:');
    log('1. Ensure all dependencies are installed: npm install');
    log('2. Check if the scraping service is running properly');
    log('3. Verify network connectivity to test URLs');
    log('4. Check if DataDome patterns have changed');
    
    process.exit(1);
  }
}

// Quick system check
function systemCheck() {
  log('Performing system check...');
  
  try {
    // Check if required dependencies exist
    const requiredDeps = [
      'cycletls',
      'ghost-cursor',
      'puppeteer',
      'user-agents'
    ];
    
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    const installedDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    requiredDeps.forEach(dep => {
      if (!installedDeps[dep]) {
        log(`WARNING: Missing dependency: ${dep}`);
      } else {
        log(`✓ ${dep} is installed`);
      }
    });
    
    log('System check complete');
    
  } catch (error) {
    log('ERROR: System check failed:');
    console.error(error.message);
  }
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--system-check')) {
    systemCheck();
  } else {
    systemCheck();
    runTest();
  }
}