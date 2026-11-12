import { HumanMessage } from "langchain";
import type { ChatOpenAI } from "@langchain/openai";
import { CARRIERS, type Carrier } from "./constants.ts";
import { createModel } from "./client.ts";
import { createSpecialistAgent, getSpecialistPrefixText } from "./carriers.ts";
import {
  CACHE_PREWARM_ENABLED,
  MIN_CACHEABLE_PREFIX_TOKENS,
  PROMPT_CACHE_ENABLED,
  estimateTokens,
} from "./caching.ts";
import { log, LOG_EVENTS, LOG_LEVELS } from "./logger.ts";

// OpenAI-compatible APIs may reject max_tokens: 0, so 1 is the cheapest valid request
const PREWARM_MAX_TOKENS = 1;

// Cuts the agent loop after its first model call; the provider has the prefix by then
const PREWARM_RECURSION_LIMIT = 1;

// Sits AFTER the cache breakpoint, so it never disturbs the cached prefix.
// It exists because some providers reject a request with no user message at all.
const PREWARM_MESSAGE = "Cache pre-warm. Reply with OK.";

const PREWARM_ERROR_PREVIEW_LENGTH = 160;

export function reportPrefixSizes(): void {
  for (const carrier of Object.values(CARRIERS)) {
    const estimatedTokens = estimateTokens(getSpecialistPrefixText(carrier));
    const belowMinimum = estimatedTokens < MIN_CACHEABLE_PREFIX_TOKENS;
    const minimumNote = belowMinimum
      ? ` (below the ~${MIN_CACHEABLE_PREFIX_TOKENS}-token minimum most providers cache)`
      : "";
    log({
      event: LOG_EVENTS.CACHE_PREFIX_SIZE,
      message: `[${carrier}] stable prefix ~${estimatedTokens} tokens${minimumNote}`,
      data: { carrier, estimatedTokens, belowMinimum },
    });
  }
}

export async function prewarmSpecialistCaches(): Promise<void> {
  if (!CACHE_PREWARM_ENABLED || !PROMPT_CACHE_ENABLED) {
    return;
  }

  try {
    const prewarmModel = createModel({ maxTokens: PREWARM_MAX_TOKENS });
    for (const carrier of Object.values(CARRIERS)) {
      await prewarmCarrier(carrier, prewarmModel);
    }
  } catch (error) {
    log({
      level: LOG_LEVELS.WARN,
      event: LOG_EVENTS.CACHE_PREWARM,
      message: `pre-warm skipped: ${String(error).slice(0, PREWARM_ERROR_PREVIEW_LENGTH)}`,
    });
  }
}

async function prewarmCarrier(carrier: Carrier, prewarmModel: ChatOpenAI): Promise<void> {
  try {
    const specialist = createSpecialistAgent(carrier, prewarmModel);
    await specialist.invoke(
      { messages: [new HumanMessage(PREWARM_MESSAGE)] },
      { recursionLimit: PREWARM_RECURSION_LIMIT },
    );
    log({ event: LOG_EVENTS.CACHE_PREWARM, message: `[${carrier}] prefix sent`, data: { carrier } });
  } catch (error) {
    log({
      level: LOG_LEVELS.WARN,
      event: LOG_EVENTS.CACHE_PREWARM,
      message: `[${carrier}] request ended early: ${String(error).slice(0, PREWARM_ERROR_PREVIEW_LENGTH)}`,
      data: { carrier },
    });
  }
}
