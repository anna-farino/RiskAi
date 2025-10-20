// Test script to verify entity extraction improvements
const { extractArticleEntities } = require('./backend/services/openai');

const testArticle = {
  title: "Hackers used Cisco zero-day to plant rootkits on network switches (CVE-2025-20352)",
  content: `
    Hackers exploited a Cisco IOS/IOS XE vulnerability (CVE-2025-20352) to deploy Linux rootkits on network 
    switches, specifically targeting older Linux systems lacking modern security protections. The vulnerability 
    affects Cisco IOS and IOS XE software running on various Cisco switches and routers.
    
    The attackers targeted network infrastructure including switches and routers from multiple vendors. 
    They used sophisticated techniques to bypass security measures on enterprise storage arrays and 
    flash storage systems, though specific models were not disclosed.
    
    Cisco has released patches for affected IOS and IOS XE versions. The company confirmed that 
    Catalyst 9300 series switches running IOS XE are vulnerable. Security researchers discovered the 
    rootkit on compromised devices.
    
    Organizations using storage arrays, network switches, and other infrastructure devices should 
    apply patches immediately. The threat actors behind this campaign remain unidentified.
  `
};

async function testExtraction() {
  console.log('Testing entity extraction with improved prompt...\n');
  
  try {
    const entities = await extractArticleEntities(testArticle);
    
    console.log('Extracted Entities:');
    console.log('===================');
    
    console.log('\nSoftware:');
    entities.software.forEach(sw => {
      console.log(`  - ${sw.name} (vendor: ${sw.vendor}, confidence: ${sw.confidence})`);
      console.log(`    Context: "${sw.context?.substring(0, 100)}..."`);
    });
    
    console.log('\nHardware:');
    entities.hardware.forEach(hw => {
      console.log(`  - ${hw.name} (manufacturer: ${hw.manufacturer}, model: ${hw.model}, confidence: ${hw.confidence})`);
      console.log(`    Context: "${hw.context?.substring(0, 100)}..."`);
    });
    
    console.log('\nCompanies:');
    entities.companies.forEach(co => {
      console.log(`  - ${co.name} (type: ${co.type}, confidence: ${co.confidence})`);
    });
    
    console.log('\nCVEs:');
    entities.cves.forEach(cve => {
      console.log(`  - ${cve.id} (confidence: ${cve.confidence})`);
    });
    
    console.log('\n\nAnalysis:');
    console.log('----------');
    
    // Check for false positives
    const falsePositiveHardware = entities.hardware.filter(hw => {
      const namesToCheck = ['PowerStore', 'FlashArray', 'Nimble Storage'];
      return namesToCheck.some(name => hw.name.includes(name));
    });
    
    if (falsePositiveHardware.length > 0) {
      console.log('❌ ISSUE: Found hardware that should NOT have been extracted:');
      falsePositiveHardware.forEach(hw => {
        console.log(`   - ${hw.name} (This was inferred, not mentioned in text)`);
      });
    } else {
      console.log('✅ SUCCESS: No false positive hardware extractions (PowerStore, FlashArray, Nimble Storage not extracted)');
    }
    
    // Check for expected entities
    const expectedHardware = entities.hardware.find(hw => hw.name.includes('Catalyst 9300'));
    const expectedSoftware = entities.software.filter(sw => 
      sw.name.includes('IOS') || sw.name.includes('IOS XE')
    );
    const expectedCVE = entities.cves.find(cve => cve.id === 'CVE-2025-20352');
    
    if (expectedHardware) {
      console.log('✅ Found expected hardware: Catalyst 9300');
    }
    if (expectedSoftware.length > 0) {
      console.log('✅ Found expected software: IOS/IOS XE');
    }
    if (expectedCVE) {
      console.log('✅ Found expected CVE: CVE-2025-20352');
    }
    
  } catch (error) {
    console.error('Error during extraction:', error);
  }
}

testExtraction();