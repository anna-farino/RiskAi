// Workaround to run TypeScript backend with the existing package.json script
// This file allows nodemon to run the TypeScript backend
require('tsx/cjs');
require('./index.ts');