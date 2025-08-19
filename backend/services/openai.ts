import OpenAI from 'openai';

// Create a new OpenAI client with the API key from environment variables
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Export a wrapper function for article summarization
export async function summarizeArticle(articleText: string, options?: { maxTokens?: number }) {
  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: articleText }],
      model: "gpt-3.5-turbo",
      max_tokens: options?.maxTokens || 500,
    });
    
    return completion.choices[0].message.content;
  } catch (error) {
    console.error('Error using OpenAI API:', error);
    throw error;
  }
}

// Phase 2.2: AI Processing Pipeline - Cybersecurity Detection
export async function analyzeCybersecurity(article: {
  title: string;
  content: string;
  url?: string;
}): Promise<{
  isCybersecurity: boolean;
  confidence: number;
  categories?: string[];
}> {
  try {
    const prompt = `
Analyze if this article is related to cybersecurity, information security, or cyber threats.

Title: ${article.title}
Content: ${article.content.substring(0, 2000)}

Respond with JSON:
{
  "isCybersecurity": true/false,
  "confidence": 0.0-1.0,
  "categories": ["threat type", "attack vector", etc] (if cybersecurity-related)
}

Consider cybersecurity-related if it mentions:
- Security vulnerabilities, CVEs, or exploits
- Cyberattacks, ransomware, malware, or breaches
- Security patches, updates, or advisories
- Threat actors, APTs, or cybercrime
- Security tools, practices, or policies
- Data protection, privacy issues, or compliance
`;

    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity analyst determining if content is security-related."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    return {
      isCybersecurity: result.isCybersecurity || false,
      confidence: result.confidence || 0,
      categories: result.categories || []
    };
  } catch (error) {
    console.error('Error analyzing cybersecurity relevance:', error);
    // Default to false if analysis fails
    return {
      isCybersecurity: false,
      confidence: 0,
      categories: []
    };
  }
}

// Phase 2.2: Security Risk Scoring for cybersecurity articles
export async function calculateSecurityRisk(article: {
  title: string;
  content: string;
  detectedKeywords?: any;
}): Promise<{
  score: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  categories: {
    exploitability: number;
    impact: number;
    scope: number;
  };
}> {
  try {
    const prompt = `
Analyze the security risk level of this cybersecurity article.

Title: ${article.title}
Content: ${article.content.substring(0, 2000)}
Keywords: ${JSON.stringify(article.detectedKeywords || {})}

Provide a risk assessment with:
1. Overall risk score (0-10)
2. Severity level (low/medium/high/critical)
3. Category scores (0-10):
   - Exploitability: How easy to exploit
   - Impact: Potential damage if exploited
   - Scope: How widespread the threat is

Respond in JSON format:
{
  "score": 0-10,
  "severity": "low|medium|high|critical",
  "categories": {
    "exploitability": 0-10,
    "impact": 0-10,
    "scope": 0-10
  }
}
`;

    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "You are a cybersecurity risk analyst evaluating threat severity."
        },
        { role: "user", content: prompt }
      ],
      model: "gpt-3.5-turbo",
      response_format: { type: "json_object" },
      temperature: 0.3
    });

    const result = JSON.parse(completion.choices[0].message.content || '{}');
    
    // Calculate severity based on score
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';
    const score = result.score || 0;
    if (score >= 8) severity = 'critical';
    else if (score >= 6) severity = 'high';
    else if (score >= 4) severity = 'medium';
    
    return {
      score: score,
      severity: result.severity || severity,
      categories: {
        exploitability: result.categories?.exploitability || 0,
        impact: result.categories?.impact || 0,
        scope: result.categories?.scope || 0
      }
    };
  } catch (error) {
    console.error('Error calculating security risk:', error);
    // Default to low risk if analysis fails
    return {
      score: 0,
      severity: 'low',
      categories: {
        exploitability: 0,
        impact: 0,
        scope: 0
      }
    };
  }
}