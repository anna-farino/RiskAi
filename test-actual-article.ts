import { extractArticleEntities } from './backend/services/openai';

// The ACTUAL full article content fetched from the website
const actualArticle = {
  title: "A New Security Layer for macOS Takes Aim at Admin Errors Before Hackers Do",
  content: `Cybersecurity Webinars

Stop Drowning in Vulnerability Lists Outsmart Attackers with DASR: Learn Automated Hardening
Static defenses overwhelm teams with vuln lists. Learn how automation and context-driven reduction close real risks faster.
Join the Experts

From Chaos to Clarity How to Make AI Work for Your GRC Program
The future of GRC isn't coming—it's already here, powered by AI that learns, adapts, and audits itself.
Join the Session

Latest News

Cybersecurity Resources

Why Security Culture Still Fails—And How to Fix It

Discover how top orgs build security culture and how you can course-correct.

Discover How to Make CTEM a Reality in 2025: Download Your Guide Now!

Ensure CTEM success! Download our ebook for practical tips on using XM Cyber to implement your exposure management strategy.

CI/CD Pipeline Security Best Practices

This new cheat sheet walks you through the OWASP Top 10 CI/CD security risks and shares clear, actionable steps to help reduce your attack surface and strengthen your delivery processes.

See GitGuardian in action ➡️ Interactive Tour

In this self-guided tour, discover key features that security teams and IAM leaders love.

Expert Insights Articles Videos

Wiz 15-minute Demo: Secure Everything You Build and Run in the Cloud
October 27, 2025Watch ➝

Modern Browser Attacks: Why Perimeter Tools Are No Longer Enough
October 20, 2025Read ➝

What Happens to MSSPs and MDRs in the Age of the AI-SOC?
October 20, 2025Read ➝

Beyond Tools: Why Testing Human Readiness is the Hidden Superpower of Modern Security Validation
October 13, 2025Read ➝

Get Latest News in Your Inbox

Get the latest news, expert insights, exclusive resources, and strategies from industry leaders – all for free.`,
  url: "https://thehackernews.com/2025/10/a-new-security-layer-for-macos-takes.html"
};

async function testWithActualContent() {
  console.log("=== Testing with ACTUAL Article Content (from web scrape) ===\n");
  console.log("Content length:", actualArticle.content.length, "characters");
  console.log("\nExtracting entities...\n");

  try {
    const extractedEntities = await extractArticleEntities(actualArticle);

    console.log("\n📊 EXTRACTED ENTITIES:\n");
    
    console.log("Software:", extractedEntities.software.length);
    extractedEntities.software.forEach((sw, i) => {
      console.log(`  ${i + 1}. ${sw.name} (${sw.vendor || 'No vendor'})`);
    });

    console.log("\nHardware:", extractedEntities.hardware.length);
    extractedEntities.hardware.forEach((hw, i) => {
      console.log(`  ${i + 1}. ${hw.name} (${hw.manufacturer || 'No manufacturer'})`);
    });

    console.log("\nCompanies:", extractedEntities.companies.length);
    extractedEntities.companies.forEach((comp, i) => {
      console.log(`  ${i + 1}. ${comp.name} (${comp.type})`);
    });

    console.log("\n\n🔍 TESTING FOR HALLUCINATED ENTITIES:\n");
    
    const contentLower = actualArticle.content.toLowerCase();
    
    // Check for the entities from the screenshot
    const suspiciousEntities = [
      "Windows Server",
      "Windows 11",
      "Cisco Catalyst",
      "Cisco Nexus",
      "BIG-IP",
      "PowerStore",
      "FlashArray",
      "Nimble Storage",
      "FortiGate",
      "Strata NGFW"
    ];
    
    console.log("Checking if these entities appear in the content:");
    suspiciousEntities.forEach(entity => {
      const found = contentLower.includes(entity.toLowerCase());
      console.log(`  ${entity}: ${found ? '✅ FOUND' : '❌ NOT FOUND'}`);
    });

  } catch (error) {
    console.error("Error:", error);
  }
}

testWithActualContent();
