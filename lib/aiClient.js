let aiClient;

export function getAIClient() {
  if (aiClient) return aiClient;

  const OpenAI = require('openai');

  const apiKey = process.env.OPENAI_API_KEY;
  const baseURL = process.env.OPENROUTER_BASE_URL;

  if (!apiKey) {
    console.warn('OpenAI API key not configured');
    return null;
  }

  aiClient = new OpenAI({
    apiKey,
    baseURL: baseURL || undefined,
  });

  return aiClient;
}
