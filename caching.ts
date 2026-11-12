import "dotenv/config";
import { SystemMessage, type AIMessage } from "langchain";

export const PROMPT_CACHE_ENABLED = process.env.PROMPT_CACHE !== "false";
export const CACHE_PREWARM_ENABLED = process.env.CACHE_PREWARM === "true";
export const MIN_CACHEABLE_PREFIX_TOKENS = 1024;

const CHARS_PER_TOKEN = 4;

const CACHE_CONTROL = { type: "ephemeral" } as const;

export function toCacheableSystemPrompt(systemPrompt: string): SystemMessage | string {
  if (!PROMPT_CACHE_ENABLED) {
    return systemPrompt;
  }

  const message = new SystemMessage({
    content: [{ type: "text", text: systemPrompt, cache_control: CACHE_CONTROL }],
  });

  return message;
}

export function estimateTokens(text: string): number {
  const estimated = Math.ceil(text.length / CHARS_PER_TOKEN);

  return estimated;
}

export interface CacheUsage {
  cachedTokens: number;
  cacheWriteTokens: number;
}

interface RawUsage {
  prompt_tokens_details?: { cached_tokens?: number; cache_write_tokens?: number };
  cache_write_tokens?: number;
}

export function getCacheUsage(response: AIMessage): CacheUsage {
  const rawUsage = response.response_metadata?.usage as RawUsage | undefined;
  const promptDetails = rawUsage?.prompt_tokens_details;
  const inputDetails = response.usage_metadata?.input_token_details;
  const cachedTokens = promptDetails?.cached_tokens ?? inputDetails?.cache_read ?? 0;
  const cacheWriteTokens = promptDetails?.cache_write_tokens ?? rawUsage?.cache_write_tokens ?? inputDetails?.cache_creation ?? 0;
  const usage: CacheUsage = { cachedTokens, cacheWriteTokens };

  return usage;
}
