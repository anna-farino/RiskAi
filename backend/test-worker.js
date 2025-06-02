// Simple test to check if worker files exist
const fs = require('fs');
const path = require('path');

console.log('Checking if worker files exist...');

const workerPath = path.join(__dirname, 'workers', 'puppeteer-worker.ts');
const executorPath = path.join(__dirname, 'utils', 'puppeteer-worker-executor.ts');

console.log('TypeScript Worker file exists:', fs.existsSync(workerPath));
console.log('Executor file exists:', fs.existsSync(executorPath));

if (fs.existsSync(workerPath) && fs.existsSync(executorPath)) {
  console.log('✅ All TypeScript worker files are in place');
  console.log('✅ Implementation ready for testing');
} else {
  console.log('❌ Missing worker files');
}