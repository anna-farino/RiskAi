import { extractArticleEntities } from './backend/services/openai';
import { EntityManager } from './backend/services/entity-manager';

// The actual article content from the URL
const testArticle = {
  title: "A New Security Layer for macOS Takes Aim at Admin Errors Before Hackers Do",
  content: `ThreatLocker launched a Beta version of its Defense Against Configurations (DAC) for macOS, following its earlier release for Windows. The tool addresses common security misconfigurations that could be exploited by attackers. DAC for macOS aims to prevent configuration errors before they become security vulnerabilities.

The new tool helps organizations secure their macOS endpoints by detecting and preventing misconfigurations in real-time. ThreatLocker's Defense Against Configurations works by monitoring system settings and alerting administrators to potential security risks.

This macOS version follows the successful Windows release and brings the same security configuration management capabilities to Apple's operating system. The tool integrates with ThreatLocker's existing security platform to provide comprehensive endpoint protection.`,
  url: "https://thehackernews.com/2025/10/a-new-security-layer-for-macos-takes.html"
};

async function testExtraction() {
  console.log("=== Testing Entity Extraction ===\n");
  console.log("Article Title:", testArticle.title);
  console.log("\n--- Step 1: Extract Entities from Article ---\n");

  try {
    const extractedEntities = await extractArticleEntities(testArticle);

    console.log("\n📊 EXTRACTED ENTITIES:\n");
    
    console.log("Software:", extractedEntities.software.length);
    extractedEntities.software.forEach((sw, i) => {
      console.log(`  ${i + 1}. ${sw.name}`);
      console.log(`     Vendor: ${sw.vendor || 'N/A'}`);
      console.log(`     Confidence: ${sw.confidence}`);
      console.log(`     Context: "${sw.context?.substring(0, 80)}..."`);
    });

    console.log("\nHardware:", extractedEntities.hardware.length);
    extractedEntities.hardware.forEach((hw, i) => {
      console.log(`  ${i + 1}. ${hw.name}`);
      console.log(`     Manufacturer: ${hw.manufacturer || 'N/A'}`);
      console.log(`     Model: ${hw.model || 'N/A'}`);
      console.log(`     Confidence: ${hw.confidence}`);
      console.log(`     Context: "${hw.context?.substring(0, 80)}..."`);
    });

    console.log("\nCompanies:", extractedEntities.companies.length);
    extractedEntities.companies.forEach((comp, i) => {
      console.log(`  ${i + 1}. ${comp.name}`);
      console.log(`     Type: ${comp.type}`);
      console.log(`     Confidence: ${comp.confidence}`);
      console.log(`     Context: "${comp.context?.substring(0, 80)}..."`);
    });

    console.log("\nCVEs:", extractedEntities.cves.length);
    console.log("Threat Actors:", extractedEntities.threatActors.length);
    console.log("Attack Vectors:", extractedEntities.attackVectors.length);

    // Now simulate the validation process
    console.log("\n\n--- Step 2: Simulate Validation Process ---\n");
    
    const fullContent = `${testArticle.title} ${testArticle.content}`;
    console.log("Full content length:", fullContent.length, "characters\n");

    // Test software validation
    console.log("SOFTWARE VALIDATION:");
    extractedEntities.software.forEach((sw) => {
      const contentLower = fullContent.toLowerCase();
      const nameLower = sw.name.toLowerCase();
      
      const nameAppears = contentLower.includes(nameLower);
      const vendorNameAppears = sw.vendor && contentLower.includes(`${sw.vendor.toLowerCase()} ${nameLower}`);
      const awsVariation = nameLower === 'amazon web services' && contentLower.includes('aws');
      const gcpVariation = nameLower === 'google cloud platform' && contentLower.includes('gcp');
      
      const wouldPass = nameAppears || vendorNameAppears || awsVariation || gcpVariation;
      
      console.log(`  ${wouldPass ? '✅ PASS' : '❌ FAIL'}: "${sw.name}"`);
      if (!wouldPass) {
        console.log(`      - Name in content: ${nameAppears}`);
        console.log(`      - Vendor+Name in content: ${vendorNameAppears}`);
      }
    });

    // Test hardware validation
    console.log("\nHARDWARE VALIDATION:");
    extractedEntities.hardware.forEach((hw) => {
      const contentLower = fullContent.toLowerCase();
      const nameLower = hw.name.toLowerCase();
      const modelLower = hw.model?.toLowerCase();
      const fullName = hw.manufacturer ? `${hw.manufacturer} ${hw.name}` : hw.name;
      
      const nameAppears = contentLower.includes(nameLower);
      const modelAppears = modelLower && contentLower.includes(modelLower);
      const fullNameAppears = hw.manufacturer && contentLower.includes(fullName.toLowerCase());
      
      const wouldPass = nameAppears || modelAppears || fullNameAppears;
      
      console.log(`  ${wouldPass ? '✅ PASS' : '❌ FAIL'}: "${hw.name}"`);
      if (!wouldPass) {
        console.log(`      - Name in content: ${nameAppears}`);
        console.log(`      - Model in content: ${modelAppears}`);
        console.log(`      - Full name in content: ${fullNameAppears}`);
      }
    });

    // Test company validation
    console.log("\nCOMPANY VALIDATION:");
    extractedEntities.companies.forEach((comp) => {
      const contentLower = fullContent.toLowerCase();
      const companyNameLower = comp.name.toLowerCase();
      
      const wouldPass = contentLower.includes(companyNameLower);
      
      console.log(`  ${wouldPass ? '✅ PASS' : '❌ FAIL'}: "${comp.name}"`);
      if (!wouldPass) {
        console.log(`      - Company name NOT found in article content`);
      }
    });

    console.log("\n=== Test Complete ===\n");

  } catch (error) {
    console.error("Error during extraction:", error);
  }
}

testExtraction();
