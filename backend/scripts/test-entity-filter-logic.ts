#!/usr/bin/env tsx

/**
 * Test script to verify generic entity filtering logic (without API calls)
 */

import { EntityManager } from "../services/entity-manager";

// Create test instance
const entityManager = new EntityManager();

console.log("Testing Entity Filtering Logic (without API calls)");
console.log("=" .repeat(60));

// Test generic hardware terms that SHOULD be filtered
const genericHardware = [
  'laptop', 'laptops', 'router', 'routers', 'server', 'servers',
  'hard drives', 'hard drive', 'sim cards', 'sim card',
  'bank cards', 'bank card', 'mobile devices', 'mobile device',
  'ip cameras', 'ip camera', 'dvrs', 'dvr', 'home routers',
  'usb drives', 'memory cards', 'high-capacity hard drives'
];

// Test specific hardware that should NOT be filtered
const specificHardware = [
  'Cisco ASA 5505', 'Dell PowerEdge R740', 'iPhone 14',
  'SurfaceBook 3', 'MacBook Pro M2', 'Netgear R7000',
  'Samsung Galaxy S23', 'ThinkPad X1 Carbon', 'ASA 5500'
];

// Test generic software terms that SHOULD be filtered  
const genericSoftware = [
  'database', 'databases', 'web server', 'web servers',
  'operating system', 'operating systems', 'cloud services',
  'application', 'applications', 'software', 'platform',
  'solution', 'tool', 'framework', 'library', 'service'
];

// Test specific software that should NOT be filtered
const specificSoftware = [
  'Apache HTTP Server', 'Windows 10', 'MySQL 8.0',
  'PostgreSQL 15', 'Apache Log4j', 'Windows Server 2022',
  'Microsoft Office 365', 'Chrome 119', 'nginx 1.24'
];

console.log("\n🔍 Testing Hardware Filtering:");
console.log("-".repeat(40));

console.log("\n✅ Generic terms (SHOULD be filtered):");
let genericFiltered = 0;
for (const term of genericHardware) {
  // @ts-ignore - accessing private method for testing
  const isFiltered = entityManager.isGenericHardware(term);
  if (isFiltered) {
    console.log(`  ✓ "${term}" - correctly filtered`);
    genericFiltered++;
  } else {
    console.log(`  ✗ "${term}" - NOT FILTERED (should be!)`);
  }
}

console.log(`\n📊 Result: ${genericFiltered}/${genericHardware.length} generic hardware terms filtered`);

console.log("\n✅ Specific terms (should NOT be filtered):");
let specificAllowed = 0;
for (const term of specificHardware) {
  // @ts-ignore - accessing private method for testing
  const isFiltered = entityManager.isGenericHardware(term);
  if (!isFiltered) {
    console.log(`  ✓ "${term}" - correctly allowed`);
    specificAllowed++;
  } else {
    console.log(`  ✗ "${term}" - INCORRECTLY FILTERED!`);
  }
}

console.log(`\n📊 Result: ${specificAllowed}/${specificHardware.length} specific hardware terms allowed`);

console.log("\n" + "=".repeat(60));
console.log("\n🔍 Testing Software Filtering:");
console.log("-".repeat(40));

console.log("\n✅ Generic terms (SHOULD be filtered):");
let softwareGenericFiltered = 0;
for (const term of genericSoftware) {
  // @ts-ignore - accessing private method for testing
  const isFiltered = entityManager.isGenericSoftware(term);
  if (isFiltered) {
    console.log(`  ✓ "${term}" - correctly filtered`);
    softwareGenericFiltered++;
  } else {
    console.log(`  ✗ "${term}" - NOT FILTERED (should be!)`);
  }
}

console.log(`\n📊 Result: ${softwareGenericFiltered}/${genericSoftware.length} generic software terms filtered`);

console.log("\n✅ Specific terms (should NOT be filtered):");
let softwareSpecificAllowed = 0;
for (const term of specificSoftware) {
  // @ts-ignore - accessing private method for testing
  const isFiltered = entityManager.isGenericSoftware(term);
  if (!isFiltered) {
    console.log(`  ✓ "${term}" - correctly allowed`);
    softwareSpecificAllowed++;
  } else {
    console.log(`  ✗ "${term}" - INCORRECTLY FILTERED!`);
  }
}

console.log(`\n📊 Result: ${softwareSpecificAllowed}/${specificSoftware.length} specific software terms allowed`);

// Final summary
console.log("\n" + "=".repeat(60));
console.log("📈 FINAL SUMMARY:");
console.log("-".repeat(40));

const hardwareSuccess = genericFiltered === genericHardware.length && 
                       specificAllowed === specificHardware.length;
const softwareSuccess = softwareGenericFiltered === genericSoftware.length && 
                       softwareSpecificAllowed === specificSoftware.length;

console.log(`\nHardware Filtering:`);
console.log(`  • Generic filtered: ${genericFiltered}/${genericHardware.length} ${genericFiltered === genericHardware.length ? '✅' : '❌'}`);
console.log(`  • Specific allowed: ${specificAllowed}/${specificHardware.length} ${specificAllowed === specificHardware.length ? '✅' : '❌'}`);

console.log(`\nSoftware Filtering:`);
console.log(`  • Generic filtered: ${softwareGenericFiltered}/${genericSoftware.length} ${softwareGenericFiltered === genericSoftware.length ? '✅' : '❌'}`);
console.log(`  • Specific allowed: ${softwareSpecificAllowed}/${specificSoftware.length} ${softwareSpecificAllowed === specificSoftware.length ? '✅' : '❌'}`);

if (hardwareSuccess && softwareSuccess) {
  console.log("\n🎉 SUCCESS: All filtering tests passed!");
} else {
  console.log("\n⚠️  WARNING: Some tests failed. Review the results above.");
}

process.exit(0);