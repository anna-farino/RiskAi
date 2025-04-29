import OpenAI from "openai";

// Function to check if OpenAI API key is configured
function isOpenAIConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;
try {
  // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
  if (isOpenAIConfigured()) {
    // Configure OpenAI with organization ID if available
    const config: { apiKey: string; organization?: string } = {
      apiKey: process.env.OPENAI_API_KEY || ''
    };
    
    // Add organization ID if present to ensure using corporate account
    // but only if it matches the API key
    if (process.env.OPENAI_ORGANIZATION) {
      try {
        config.organization = process.env.OPENAI_ORGANIZATION;
        console.log("Using OpenAI with organization ID");
      } catch (error) {
        console.warn("Error setting organization ID:", error);
        console.log("Continuing without organization ID");
      }
    } else {
      console.log("No organization ID provided - using default OpenAI account");
    }
    
    openai = new OpenAI(config);
  } else {
    console.warn("OpenAI API key not configured. AI-enhanced features will not be available.");
  }
} catch (error) {
  console.error("Error initializing OpenAI client:", error);
}

/**
 * Check if OpenAI integration is available
 * 
 * @returns Boolean indicating if OpenAI can be used
 */
export function isOpenAIAvailable(): boolean {
  return isOpenAIConfigured() && openai !== null;
}

/**
 * Get OpenAI configuration information for diagnostics
 * Does not expose the actual API key for security
 */
export async function getOpenAIInfo(): Promise<{
  available: boolean;
  usingOrganization: boolean;
  organizationName?: string;
  accountType: string;
}> {
  if (!isOpenAIAvailable()) {
    return {
      available: false,
      usingOrganization: false,
      accountType: 'unknown'
    };
  }

  try {
    // Check if organization is configured
    const usingOrganization = !!process.env.OPENAI_ORGANIZATION;
    
    // Make a simple models call to check account status
    const response = await openai!.models.list();
    
    // Try to determine account type based on available models
    let accountType = 'personal'; // Default assumption
    const models = response.data.map(model => model.id);
    
    if (models.includes('gpt-4o')) {
      // GPT-4o is typically available on business/enterprise accounts
      accountType = 'business/enterprise';
    }
    
    return {
      available: true,
      usingOrganization,
      organizationName: process.env.OPENAI_ORGANIZATION_NAME,
      accountType
    };
  } catch (error) {
    console.error('Error checking OpenAI configuration:', error);
    return {
      available: true,
      usingOrganization: !!process.env.OPENAI_ORGANIZATION,
      accountType: 'unknown (error checking)'
    };
  }
}

/**
 * Analyze OS-specific threat information using OpenAI API
 * 
 * @param prompt The detailed prompt to send to OpenAI
 * @returns The AI-generated response
 */
export async function analyzeWithAI(prompt: string): Promise<string> {
  // Check if OpenAI is properly configured
  if (!isOpenAIAvailable()) {
    throw new Error("OpenAI API is not configured or available.");
  }

  try {
    // Try making the API call without organization ID if it's set
    let response;
    try {
      response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3, // Lower temperature for more focused, factual responses
        max_tokens: 500 // Limit token usage to stay within quota
      });
    } catch (apiError: any) {
      // If we get an organization mismatch error, try again without the organization header
      if (apiError.code === 'mismatched_organization') {
        console.warn('Organization ID mismatch, removing organization ID and retrying');
        // Create a new client without the organization ID
        const tempOpenai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY || '' 
        });
        
        response = await tempOpenai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.3,
          max_tokens: 500
        });
      } else {
        // Re-throw other errors
        throw apiError;
      }
    }

    return response.choices[0].message.content || "";
  } catch (error: any) {
    console.error("Error calling OpenAI API:", error);
    
    // Provide more specific error message based on error type
    if (error.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your billing details.");
    } else if (error.code === 'mismatched_organization') {
      throw new Error("Organization ID doesn't match the API key. Please check your OpenAI credentials.");
    } else if (error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else {
      throw new Error("Failed to analyze with AI. Please try again later.");
    }
  }
}

/**
 * Get structured threat analysis from OpenAI
 * 
 * @param prompt The detailed prompt to send to OpenAI
 * @returns The AI-generated structured response as JSON
 */
export async function getStructuredAnalysis(prompt: string): Promise<any> {
  // Check if OpenAI is properly configured
  if (!isOpenAIAvailable()) {
    throw new Error("OpenAI API is not configured or available.");
  }

  try {
    // Try making the API call without organization ID if it's set
    let response;
    try {
      response = await openai!.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 800 // Limit token usage to stay within quota
      });
    } catch (apiError: any) {
      // If we get an organization mismatch error, try again without the organization header
      if (apiError.code === 'mismatched_organization') {
        console.warn('Organization ID mismatch, removing organization ID and retrying');
        // Create a new client without the organization ID
        const tempOpenai = new OpenAI({ 
          apiKey: process.env.OPENAI_API_KEY || '' 
        });
        
        response = await tempOpenai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
          temperature: 0.3,
          max_tokens: 800
        });
      } else {
        // Re-throw other errors
        throw apiError;
      }
    }

    // Parse the JSON response
    const content = response.choices[0].message.content || '{}';
    return JSON.parse(content);
  } catch (error: any) {
    console.error("Error getting structured analysis from OpenAI:", error);
    
    // Provide more specific error message based on error type
    if (error.code === 'insufficient_quota') {
      throw new Error("OpenAI API quota exceeded. Please check your billing details.");
    } else if (error.code === 'mismatched_organization') {
      throw new Error("Organization ID doesn't match the API key. Please check your OpenAI credentials.");
    } else if (error.status === 429) {
      throw new Error("Rate limit exceeded. Please try again later.");
    } else {
      throw new Error("Failed to get structured analysis from AI.");
    }
  }
}