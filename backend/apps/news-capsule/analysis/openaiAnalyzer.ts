import { InsertArticle, Article, InsertAnalysis, Severity, Threat, Product } from "../schema";
import OpenAI from "openai";

// Initialize the OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// The newest OpenAI model is "gpt-4o" which was released May 13, 2024. Do not change this unless explicitly requested by the user
const MODEL = "gpt-4o";

export class OpenAIAnalyzer {
  /**
   * Analyzes article content using OpenAI's GPT model
   * @param article The article to analyze
   * @returns Analysis object with extracted information
   */
  async analyzeArticle(article: Article): Promise<InsertAnalysis> {
    try {
      console.log(`[🤖OpenAIAnalyzer] Analyzing article: ${article.title} using OpenAI`);
      
      // Analyze with OpenAI
      const analysisResult = await this.getOpenAIAnalysis(article);
      
      const result = {
        articleId: article.id,
        summary: analysisResult.summary,
        severity: analysisResult.severity,
        technicalDetails: analysisResult.technicalDetails,
        recommendations: analysisResult.recommendations,
        affectedProducts: analysisResult.affectedProducts,
        threats: analysisResult.threats,
      };
      console.log("[🤖OpenAIAnalyzer] Analysis result", result)
      return result
    } catch (error: any) {
      console.error("Error analyzing article with OpenAI:", error);
      throw new Error(`OpenAI analysis failed: ${error.message || 'Unknown error'}`);
    }
  }
  
  /**
   * Calls OpenAI API to analyze the article
   */
  private async getOpenAIAnalysis(article: Article): Promise<{
    summary: string;
    severity: Severity;
    technicalDetails: string;
    recommendations: string;
    affectedProducts: Product[];
    threats: Threat[];
  }> {
    // Construct the prompt
    const prompt = `
Analyze this cybersecurity news article and extract the following information, focusing exclusively on Microsoft-related security threats:

ARTICLE TITLE: ${article.title}
SOURCE: ${article.source}
DATE: ${article.date}
CONTENT:
${article.content}

Please provide a structured analysis with the following sections - use null for fields with no information:

1. THREATS: Identify all specific named threats (malware, exploits, vulnerabilities) mentioned in the article. For each threat, provide:
   - Name: The specific name of the threat (e.g., "Midnight Blizzard", "FoggyWeb")
   - Type: Categorize as 'vulnerability', 'malware', 'ransomware', 'zero-day', 'exploit', or 'other'
   - Details: Brief description (max 150 chars)
   - CVE: If mentioned (e.g., "CVE-2023-1234")

2. EXECUTIVE SUMMARY: Provide a concise summary in 2 sentences or less, focusing on the security impact.

3. SEVERITY: Rate the threat as 'critical', 'high', 'medium', or 'low' based on the article's description.

4. AFFECTED PRODUCTS: List all Microsoft products/systems affected, with versions if specified.

5. TECHNICAL DETAILS: Extract technical exploit information, attack vectors, vulnerability details (2-4 sentences only, focusing on the technical aspects).

6. RECOMMENDATIONS: Provide 2-3 specific, actionable steps for Microsoft users/admins to mitigate the threat. This must be a single string.

Respond in JSON format with these fields. Create descriptive threat names if no specific name is given in the article but a threat is clearly described. If multiple threats are mentioned, prioritize the most severe ones.
`;

    // Call OpenAI API
    const response = await openai.chat.completions.create({
      model: MODEL,
      messages: [
        { role: "system", content: "You are a cybersecurity analyst specializing in Microsoft security threats. Your task is to extract and structure relevant security information from news articles." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1, // Lower temperature for more deterministic results
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    const analysisText = response.choices[0].message.content || '';
    
    try {
      const analysis = JSON.parse(analysisText);
      
      // Transform to our data structure
      const threats: Threat[] = (analysis.THREATS || []).map((t: any) => ({
        name: t.Name || "Unknown Threat",
        type: this.validateThreatType(t.Type),
        details: t.Details || "No details provided",
        cve: t.CVE
      }));
      
      // Process affected products
      const affectedProducts: Product[] = (analysis.AFFECTED_PRODUCTS || []).map((p: any) => {
        const productName = typeof p === 'string' ? p : p.name || p.Name || "Unknown Product";
        const versions = typeof p === 'string' ? undefined : p.version || p.Version || p.versions || p.Versions;
        
        return {
          name: productName,
          versions: versions,
          icon: this.getProductIcon(productName)
        };
      });
      
      const result = {
        summary: analysis.EXECUTIVE_SUMMARY || "No summary provided",
        severity: this.validateSeverity(analysis.SEVERITY),
        technicalDetails: analysis.TECHNICAL_DETAILS || "No technical details available",
        recommendations: analysis.RECOMMENDATIONS || "No specific recommendations provided",
        affectedProducts,
        threats
      };
      console.log("[🤖OpenAIAnalyzer] AI result", result)
      return result
    } catch (e) {
      console.error("Error parsing OpenAI response:", e, analysisText);
      throw new Error("Failed to parse analysis results");
    }
  }
  
  /**
   * Validates the severity level
   */
  private validateSeverity(severity: string): Severity {
    const validSeverities: Severity[] = ['critical', 'high', 'medium', 'low'];
    
    if (!severity || typeof severity !== 'string') {
      return 'medium';
    }
    
    const normalizedSeverity = severity.toLowerCase().trim() as Severity;
    
    return validSeverities.includes(normalizedSeverity) ? normalizedSeverity : 'medium';
  }
  
  /**
   * Validates the threat type
   */
  private validateThreatType(type: string): Threat['type'] {
    const validTypes = ['vulnerability', 'malware', 'ransomware', 'zero-day', 'exploit', 'other'];
    
    if (!type || typeof type !== 'string') {
      return 'other';
    }
    
    const normalizedType = type.toLowerCase().trim();
    
    return validTypes.includes(normalizedType) ? normalizedType as Threat['type'] : 'other';
  }
  
  /**
   * Get icon name for a product
   */
  private getProductIcon(productName: string): string | undefined {
    const iconMap: Record<string, string> = {
      windows: 'windows',
      server: 'server',
      exchange: 'server',
      azure: 'cloud',
      cloud: 'cloud',
      office: 'file-word',
      sharepoint: 'share-nodes',
      sql: 'database',
      active: 'sitemap',
      directory: 'sitemap',
      defender: 'shield-halved',
      onedrive: 'cloud',
      teams: 'users',
      explorer: 'globe',
      edge: 'edge',
      '.net': 'code',
      visual: 'code',
      skype: 'comment',
      surface: 'tablet',
      xbox: 'gamepad',
    };
    
    const productLower = productName.toLowerCase();
    
    for (const [key, icon] of Object.entries(iconMap)) {
      if (productLower.includes(key)) {
        return icon;
      }
    }
    
    return 'microsoft'; // Default icon
  }
}

export const openaiAnalyzer = new OpenAIAnalyzer();
