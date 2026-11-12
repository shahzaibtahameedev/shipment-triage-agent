import { Hono } from "hono";
import type { PromptKey } from "../../prompt.ts";
import { isPromptKey, listPrompts, resetPrompt, savePrompt } from "../../stores/prompt-store.ts";
import { PROMPT_UPDATE_SCHEMA } from "../../stores/schemas.ts";
import { notFound, parseJsonBody } from "../http.ts";

export const promptsRoute = new Hono();

function toPromptKey(rawKey: string): PromptKey {
  if (!isPromptKey(rawKey)) {
    throw notFound(`Prompt ${rawKey} not found`);
  }

  return rawKey;
}

promptsRoute.get("/", (c) => {
  const prompts = listPrompts();

  return c.json(prompts);
});

promptsRoute.put("/:key", async (c) => {
  const key = toPromptKey(c.req.param("key"));
  const { content } = await parseJsonBody(c, PROMPT_UPDATE_SCHEMA);
  const prompt = savePrompt(key, content);

  return c.json(prompt);
});

promptsRoute.delete("/:key", (c) => {
  const key = toPromptKey(c.req.param("key"));
  const prompt = resetPrompt(key);

  return c.json(prompt);
});
