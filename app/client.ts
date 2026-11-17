import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.includes("paste-your-key")) {
    throw new Error(`Missing ${name}. Copy .env.example to .env and paste your key.`);
  }
  return value;
}

const DEFAULT_MODEL = "openrouter/free";

export const MODEL = process.env.MODEL || DEFAULT_MODEL;

export const MODEL_SMALL = process.env.MODEL_SMALL || MODEL;
export const MODEL_STRONG = process.env.MODEL_STRONG || MODEL;
export const MODEL_BACKUP = process.env.MODEL_BACKUP || MODEL;

interface ModelOptions {
  model?: string;
  maxTokens?: number;
  timeout?: number;
}

export function createModel(options: ModelOptions = {}): ChatOpenAI {
  const chatModel = new ChatOpenAI({
    model: options.model || MODEL,
    apiKey: requireEnv("OPENROUTER_API_KEY"),
    temperature: 0,
    maxTokens: options.maxTokens,
    timeout: options.timeout,
    configuration: { baseURL: OPENROUTER_BASE_URL },
  });

  return chatModel;
}

export const model = createModel();
