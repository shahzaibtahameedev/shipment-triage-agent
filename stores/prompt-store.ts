import { FIXTURE_FILES } from "../constants.ts";
import { DEFAULT_PROMPTS, PROMPT_KEYS, type PromptDefinition, type PromptKey } from "../prompt.ts";
import { fixtureUrl, readJson, writeJson } from "./json-file.ts";

type PromptOverrides = Partial<Record<PromptKey, string>>;

export interface PromptView extends PromptDefinition {
  defaultContent: string;
  isModified: boolean;
}

const OVERRIDES_FILE = fixtureUrl(FIXTURE_FILES.PROMPT_OVERRIDES);

function readOverrides(): PromptOverrides {
  const overrides = readJson<PromptOverrides>(OVERRIDES_FILE, {});

  return overrides;
}

function toPromptView(definition: PromptDefinition, overrides: PromptOverrides): PromptView {
  const override = overrides[definition.key];
  const view: PromptView = {
    key: definition.key,
    label: definition.label,
    group: definition.group,
    description: definition.description,
    placeholders: definition.placeholders,
    content: override ?? definition.content,
    defaultContent: definition.content,
    isModified: override !== undefined,
  };

  return view;
}

export function isPromptKey(value: string): value is PromptKey {
  const isKey = (Object.values(PROMPT_KEYS) as string[]).includes(value);

  return isKey;
}

export function getPrompt(key: PromptKey): string {
  const content = readOverrides()[key] ?? DEFAULT_PROMPTS[key].content;

  return content;
}

export function listPrompts(): PromptView[] {
  const overrides = readOverrides();
  const prompts = Object.values(DEFAULT_PROMPTS).map((definition) => toPromptView(definition, overrides));

  return prompts;
}

export function savePrompt(key: PromptKey, content: string): PromptView {
  const overrides = readOverrides();
  const definition = DEFAULT_PROMPTS[key];

  if (content === definition.content) {
    delete overrides[key];
  } else {
    overrides[key] = content;
  }
  writeJson(OVERRIDES_FILE, overrides);
  const view = toPromptView(definition, overrides);

  return view;
}

export function resetPrompt(key: PromptKey): PromptView {
  const view = savePrompt(key, DEFAULT_PROMPTS[key].content);

  return view;
}
