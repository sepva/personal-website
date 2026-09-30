import { createOpenAI } from "@ai-sdk/openai";

/**
 * Creates an OpenAI provider instance using the official AI SDK provider.
 *
 * @param env - Environment variables containing OpenAI configuration
 * @param modelsEnvVar - Comma-separated string of model IDs (first one is used)
 * @returns OpenAI provider instance with the primary model name
 */
export function createOpenAIProvider(env: Cloudflare.Env, modelsEnvVar: string) {
  // Parse models and use the first one (primary model)
  const models = modelsEnvVar
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  const primaryModel = models[0] || "gpt-5.4-mini-2026-03-17";

  console.log("[OpenAI Provider] Using primary model:", primaryModel);

  const openai = createOpenAI({
    apiKey: env.OPENAI_API_KEY
  });

  return {
    provider: openai,
    primaryModel
  };
}
