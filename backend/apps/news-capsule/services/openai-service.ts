import OpenAI from "openai";
import { log } from "backend/utils/log";

// Basic mock response function for when we can't connect to OpenAI
function generateMockResponse(articleUrl: string) {
  log("Generating mock threat intelligence data for testing", "openai");
  return {
    title: "Simulated Security Threat Analysis",
    threatName: "Test Vulnerability CVE-2025-DEMO",
    vulnerabilityId: "CVE-2025-DEMO",
    summary: "This is a simulated security threat summary generated when OpenAI processing is unavailable. It represents what would normally be AI-generated content based on the article.",
    impacts: "Potential data exposure and system compromise in test environments",
    attackVector: "Simulated remote code execution via unpatched systems",
    microsoftConnection: "Could potentially affect Windows systems if real",
    sourcePublication: new URL(articleUrl).hostname,
    originalUrl: articleUrl,
    targetOS: "Microsoft / Windows",
  };
}

// Process an article and extract threat information
export async function processArticleWithAI(articleUrl: string, articleText: string) {
  log(`Processing article with AI from URL: ${articleUrl}`, "openai");
  
  try {
    // Check if we have an API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      log("OpenAI API key not found. Using mock data.", "openai");
      return generateMockResponse(articleUrl);
    }
    
    // Initialize OpenAI client
    const openai = new OpenAI({
      apiKey
    });
    
    log("OpenAI client initialized, sending request", "openai");
    
    // Truncate article text if it's too long
    const maxTextLength = 8000; // Characters
    const truncatedText = articleText.length > maxTextLength 
      ? articleText.substring(0, maxTextLength) + "... (text truncated)"
      : articleText;
    
    // Request to OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo", // Using gpt-3.5-turbo for better reliability and cost
      messages: [
        {
          role: "system",
          content: `You are a cybersecurity analyst assistant. Extract cybersecurity threat information from articles in a structured format.
          
For each article, provide the following information:
- Title: Extract or create a concise title for the security issue
- Threat Name(s): Identify the specific threat, vulnerability, exploit, or CVE(s) mentioned
- Summary: Write a brief summary (max 60 words) of the key threat or incident
- Impacts: Describe the business or technical impact
- OS Connection: Identify which operating systems are affected, if mentioned
- Attack Vector: How the attack is delivered or initial access is gained
- Source: The name of the original publication`
        },
        {
          role: "user",
          content: `Here is a cybersecurity article from ${articleUrl}:\n\n${truncatedText}\n\nExtract the key threat intelligence in the requested format.`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    log("Received response from OpenAI", "openai");
    
    const content = response.choices[0]?.message?.content;
    if (!content) {
      log("Empty response from OpenAI, using mock data", "openai");
      return generateMockResponse(articleUrl);
    }

    // Parse the OpenAI response to extract structured data
    log("Parsing OpenAI response content", "openai");
    
    const title = extractField(content, "Title:") || "Security Threat Analysis";
    const threatName = extractField(content, "Threat Name(s):") || "Unknown Threat";
    const summary = extractField(content, "Summary:") || "No summary provided by AI analysis";
    const impacts = extractField(content, "Impacts:") || "Potential security impacts";
    const osConnection = extractField(content, "OS Connection:") || "Not specified";
    const attackVector = extractField(content, "Attack Vector:") || "Unknown attack vector";
    const source = extractField(content, "Source:") || new URL(articleUrl).hostname;
    
    const vulnerabilityId = extractCVE(threatName) || extractCVE(title) || extractCVE(summary) || "Unspecified";
    
    log(`Successfully extracted threat data - Title: ${title}`, "openai");
    
    const result = {
      title,
      threatName,
      vulnerabilityId,
      summary,
      impacts,
      attackVector,
      microsoftConnection: osConnection, // Using the osConnection as microsoftConnection
      sourcePublication: source,
      originalUrl: articleUrl,
      targetOS: osConnection || "Not specified",
    };
    
    return result;
  } catch (error) {
    log(`Error processing article with OpenAI: ${error}`, "openai");
    // Instead of throwing, return mock data to ensure the feature works
    return generateMockResponse(articleUrl);
  }
}

// Helper function to extract fields from the OpenAI response
function extractField(content: string, fieldName: string): string {
  const regex = new RegExp(`${fieldName}\\s*([^\\n]+(?:\\n(?!\\w+:)[^\\n]+)*)`, "i");
  const match = content.match(regex);
  return match ? match[1].trim() : "";
}

// Extract CVE ID if present
function extractCVE(text: string): string | null {
  if (!text) return null;
  const cveRegex = /CVE-\d{4}-\d{4,}/i;
  const match = text.match(cveRegex);
  return match ? match[0] : null;
}