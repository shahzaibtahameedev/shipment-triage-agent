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

export const MODEL = process.env.MODEL || "openrouter/free";

export const model = new ChatOpenAI({
  model: MODEL,
  apiKey: requireEnv("OPENROUTER_API_KEY"),
  temperature: 0, // triage should be repeatable, not creative
  configuration: { baseURL: OPENROUTER_BASE_URL },
});
