// One-off check, run manually: npm run cache:verify
// Makes exactly ONE real model call to confirm:
//   1. cache_control survives LangChain and reaches OpenRouter (logged from the raw request body)
//   2. cached_tokens is read from the response without errors
import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "langchain";
import { CARRIERS } from "../constants.ts";
import { createSpecialistAgent } from "../carriers.ts";
import { MODEL } from "../client.ts";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const VERIFY_MAX_TOKENS = 16;
const SINGLE_CALL_RECURSION_LIMIT = 1;
const BODY_PREVIEW_LENGTH = 500;
const ERROR_PREVIEW_LENGTH = 200;

let cacheControlSent = false;

// Logging the real outgoing body, instead of trusting that LangChain forwards the field
const inspectingFetch: typeof fetch = async (url, init) => {
  const body = JSON.parse(String(init?.body ?? "{}"));
  const systemMessage = body.messages?.[0];
  const parts = Array.isArray(systemMessage?.content) ? systemMessage.content : [];
  const lastPart = parts[parts.length - 1];
  cacheControlSent = lastPart?.cache_control?.type === "ephemeral";
  console.log("[request] system message:", String(JSON.stringify(systemMessage)).slice(0, BODY_PREVIEW_LENGTH));
  console.log("[request] cache_control on last system part:", cacheControlSent);
  const response = await fetch(url, init);
  await printResponseUsage(response);

  return response;
};

async function printResponseUsage(response: Response): Promise<void> {
  try {
    const json = await response.clone().json();
    console.log("[response] raw usage:", JSON.stringify(json?.usage));
  } catch {
    console.log("[response] body was not plain JSON (streaming?); usage not shown here");
  }
}

// Mirrors client.ts config, plus the inspecting fetch and a small token cap
const verifyModel = new ChatOpenAI({
  model: MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0,
  maxTokens: VERIFY_MAX_TOKENS,
  configuration: { baseURL: OPENROUTER_BASE_URL, fetch: inspectingFetch },
});

const specialist = createSpecialistAgent(CARRIERS.DHL, verifyModel);
try {
  // recursionLimit 1 guarantees a single model call; the agent erroring afterwards is fine
  await specialist.invoke(
    { messages: [new HumanMessage("Verification ping. Reply with OK.")] },
    { recursionLimit: SINGLE_CALL_RECURSION_LIMIT },
  );
} catch (error) {
  console.log("[note] agent stopped early (expected):", String(error).slice(0, ERROR_PREVIEW_LENGTH));
}

console.log(`RESULT: cache_control reached OpenRouter = ${cacheControlSent}`);
process.exit(0);
