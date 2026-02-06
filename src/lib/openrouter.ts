import { createOpenRouter } from '@openrouter/ai-sdk-provider';

/**
 * Creates an OpenRouter provider instance using the official OpenRouter AI SDK provider.
 * 
 * This uses the @openrouter/ai-sdk-provider package which properly handles:
 * 1. Tool calling with correct schema serialization
 * 2. Multiple model fallbacks
 * 3. OpenRouter-specific features (reasoning, usage tracking, etc.)
 * 
 * @param env - Environment variables containing OpenRouter configuration
 * @param modelsEnvVar - Comma-separated string of model IDs (first one is used)
 * @returns OpenRouter provider instance with the primary model name
 */
export function createOpenRouterProvider(env: Cloudflare.Env, modelsEnvVar: string) {
  // Parse models and use the first one (primary model)
  const models = modelsEnvVar.split(',').map(m => m.trim()).filter(Boolean);
  const primaryModel = models[0] || 'arcee-ai/trinity-large-preview:free';
  
  console.log('[OpenRouter Provider] Using primary model:', primaryModel);
  
  // Create official OpenRouter provider
  const openrouter = createOpenRouter({
    apiKey: env.OPENROUTER_API_KEY,
    headers: {
      'HTTP-Referer': env.OPENROUTER_SITE_URL || 'https://yoursite.com',
      'X-Title': env.OPENROUTER_SITE_NAME || 'Personal Portfolio Chat'
    }
  });
  
  return {
    provider: openrouter,
    primaryModel
  };
}
