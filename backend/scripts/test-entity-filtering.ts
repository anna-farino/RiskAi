#!/usr/bin/env tsx

/**
 * Test script to verify generic entity terms are being filtered out
 */

import { extractArticleEntities } from "../services/openai";
import { EntityManager } from "../services/entity-manager";

// Test article with generic and specific terms mixed
const testArticle = {
  title: "Security Vulnerabilities Found in Network Equipment",
  content: `
    Researchers have discovered critical vulnerabilities affecting routers and network equipment 
    across multiple vendors. The vulnerabilities specifically impact Cisco ASA 5505 firewalls 
    and Netgear R7000 routers.
    
    Generic laptops and mobile devices are also at risk. Organizations using Dell PowerEdge R740 
    servers should patch immediately. The vulnerability affects databases and web servers running 
    Apache HTTP Server 2.4.49.
    
    Other affected hardware includes:
    - Home routers (generic mention)
    - Cisco Catalyst 9300 switches (specific)
    - SIM cards and bank cards (generic)
    - Microsoft Surface Book 3 laptops (specific)
    - Generic hard drives and USB drives
    - iPhone 14 and Samsung Galaxy S23 (specific)
    
    Software impacts include:
    - Operating systems (generic)
    - Windows Server 2022 (specific)
    - Cloud services and platforms (generic)
    - MySQL 8.0 and PostgreSQL 15 (specific)
    - Web servers and applications (generic)
    - Apache Log4j 2.17.0 (specific)
    
    Companies affected include Microsoft, Google, Amazon, and various cloud providers and tech companies.
    
    CVE-2023-1234 has a CVSS score of 9.8. The APT28 threat actor has been observed exploiting 
    these vulnerabilities in the wild.
  `
};

async function testEntityExtraction() {
  console.log("Testing entity extraction with generic term filtering...\n");
  console.log("=" .repeat(80));
  
  try {
    // Extract entities using the updated prompt
    console.log("\n1. Extracting entities from test article...");
    const extracted = await extractArticleEntities(testArticle);
    
    // Display results
    console.log("\n2. Extracted Software (should NOT include generic terms):");
    console.log("-".repeat(40));
    if (extracted.software.length === 0) {
      console.log("  ❌ No software extracted (check if being too restrictive)");
    } else {
      extracted.software.forEach(sw => {
        const isGeneric = ['database', 'web server', 'operating system', 'cloud services', 
                          'platform', 'application'].some(term => 
                          sw.name.toLowerCase().includes(term));
        const icon = isGeneric ? "❌" : "✅";
        console.log(`  ${icon} ${sw.name} (specificity: ${sw.specificity})`);
      });
    }
    
    console.log("\n3. Extracted Hardware (should NOT include generic terms):");
    console.log("-".repeat(40));
    if (extracted.hardware.length === 0) {
      console.log("  ❌ No hardware extracted (check if being too restrictive)");
    } else {
      extracted.hardware.forEach(hw => {
        const isGeneric = ['laptop', 'router', 'hard drive', 'usb drive', 'sim card', 
                          'bank card', 'mobile device', 'home router'].some(term => 
                          hw.name.toLowerCase() === term.toLowerCase());
        const icon = isGeneric ? "❌" : "✅";
        const display = hw.manufacturer ? `${hw.manufacturer} ${hw.name}` : hw.name;
        console.log(`  ${icon} ${display} (specificity: ${hw.specificity})`);
      });
    }
    
    console.log("\n4. Extracted Companies (should only be specific names):");
    console.log("-".repeat(40));
    extracted.companies.forEach(company => {
      const isGeneric = ['cloud providers', 'tech companies', 'organizations'].includes(
        company.name.toLowerCase()
      );
      const icon = isGeneric ? "❌" : "✅";
      console.log(`  ${icon} ${company.name} (type: ${company.type})`);
    });
    
    // Test EntityManager filtering
    console.log("\n5. Testing EntityManager post-processing filters:");
    console.log("-".repeat(40));
    const entityManager = new EntityManager();
    
    // Test generic hardware terms
    const genericHardwareTests = ['laptop', 'router', 'hard drives', 'sim cards'];
    const specificHardwareTests = ['Cisco ASA 5505', 'Dell PowerEdge R740', 'iPhone 14'];
    
    console.log("\nGeneric hardware (should be filtered):");
    for (const term of genericHardwareTests) {
      // @ts-ignore - accessing private method for testing
      const isGeneric = entityManager.isGenericHardware(term);
      console.log(`  ${term}: ${isGeneric ? '✅ Filtered' : '❌ NOT filtered'}`);
    }
    
    console.log("\nSpecific hardware (should NOT be filtered):");
    for (const term of specificHardwareTests) {
      // @ts-ignore - accessing private method for testing
      const isGeneric = entityManager.isGenericHardware(term);
      console.log(`  ${term}: ${isGeneric ? '❌ Incorrectly filtered!' : '✅ Allowed'}`);
    }
    
    // Test generic software terms
    const genericSoftwareTests = ['database', 'web server', 'operating system', 'platform'];
    const specificSoftwareTests = ['Apache HTTP Server', 'Windows 10', 'MySQL 8.0'];
    
    console.log("\nGeneric software (should be filtered):");
    for (const term of genericSoftwareTests) {
      // @ts-ignore - accessing private method for testing
      const isGeneric = entityManager.isGenericSoftware(term);
      console.log(`  ${term}: ${isGeneric ? '✅ Filtered' : '❌ NOT filtered'}`);
    }
    
    console.log("\nSpecific software (should NOT be filtered):");
    for (const term of specificSoftwareTests) {
      // @ts-ignore - accessing private method for testing  
      const isGeneric = entityManager.isGenericSoftware(term);
      console.log(`  ${term}: ${isGeneric ? '❌ Incorrectly filtered!' : '✅ Allowed'}`);
    }
    
    // Summary
    console.log("\n" + "=".repeat(80));
    console.log("SUMMARY:");
    console.log("-".repeat(40));
    
    const genericSoftwareFound = extracted.software.filter(sw => 
      ['database', 'web server', 'operating system', 'cloud services'].some(term => 
        sw.name.toLowerCase().includes(term))
    );
    
    const genericHardwareFound = extracted.hardware.filter(hw => 
      ['laptop', 'router', 'hard drive', 'usb drive', 'sim card'].some(term => 
        hw.name.toLowerCase() === term)
    );
    
    console.log(`✓ Software: ${extracted.software.length} specific items extracted`);
    console.log(`✓ Hardware: ${extracted.hardware.length} specific items extracted`);
    console.log(`✓ Companies: ${extracted.companies.length} named organizations extracted`);
    
    if (genericSoftwareFound.length > 0) {
      console.log(`⚠️  Warning: ${genericSoftwareFound.length} generic software terms found`);
    }
    
    if (genericHardwareFound.length > 0) {
      console.log(`⚠️  Warning: ${genericHardwareFound.length} generic hardware terms found`);
    }
    
    if (genericSoftwareFound.length === 0 && genericHardwareFound.length === 0) {
      console.log("\n🎉 SUCCESS: No generic terms were extracted!");
    } else {
      console.log("\n⚠️  Some generic terms may still be getting through. Review the results above.");
    }
    
  } catch (error) {
    console.error("\n❌ Error during testing:", error);
    process.exit(1);
  }
}

// Run the test
testEntityExtraction().then(() => {
  console.log("\n✅ Test completed");
  process.exit(0);
}).catch(error => {
  console.error("\n❌ Test failed:", error);
  process.exit(1);
});