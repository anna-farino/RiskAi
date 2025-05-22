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