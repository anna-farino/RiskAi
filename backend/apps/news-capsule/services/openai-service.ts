import OpenAI from "openai";
import { log } from "backend/utils/log";

// Check if OpenAI API key is available
const apiKey = process.env.OPENAI_API_KEY;

let openai: OpenAI | null = null;

if (apiKey) {
  openai = new OpenAI({
    apiKey
  });
} else {
  log("OpenAI API key not found. AI features will not be available.", "openai");
}

// Process an article and extract threat information
export async function processArticleWithAI(articleUrl: string, articleText: string) {
  if (!openai) {
    throw new Error("OpenAI API key not configured");
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4",
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
          content: `Here is a cybersecurity article from ${articleUrl}:\n\n${articleText}\n\nExtract the key threat intelligence in the requested format.`
        }
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    // Parse the OpenAI response to extract structured data
    const title = extractField(content, "Title:");
    const threatName = extractField(content, "Threat Name(s):");
    const summary = extractField(content, "Summary:");
    const impacts = extractField(content, "Impacts:");
    const osConnection = extractField(content, "OS Connection:") || "Not specified";
    const attackVector = extractField(content, "Attack Vector:") || "Unknown attack vector";
    const source = extractField(content, "Source:");

    return {
      title,
      threatName,
      vulnerabilityId: extractCVE(threatName) || "Unspecified",
      summary,
      impacts,
      attackVector,
      microsoftConnection: osConnection, // Using the osConnection as microsoftConnection
      sourcePublication: source,
      originalUrl: articleUrl,
      targetOS: osConnection || "Not specified",
    };
  } catch (error) {
    log(`Error processing article with OpenAI: ${error}`, "openai");
    throw new Error(`Failed to process article with AI: ${error}`);
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
  const cveRegex = /CVE-\d{4}-\d{4,}/i;
  const match = text.match(cveRegex);
  return match ? match[0] : null;
}