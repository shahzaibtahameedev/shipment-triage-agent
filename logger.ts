import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, mkdirSync } from "node:fs";

const LOG_DIR = new URL("./logs/", import.meta.url);
export const LOG_FILE = new URL("agent-log.jsonl", LOG_DIR);

export const LOG_LEVELS = {
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
} as const;

export type LogLevel = (typeof LOG_LEVELS)[keyof typeof LOG_LEVELS];

export const LOG_EVENTS = {
  RUN_STARTED: "run_started",
  ALREADY_PENDING: "already_pending",
  NOTHING_TO_RESUME: "nothing_to_resume",
  ROUTE_SELECTED: "route_selected",
  TOOL_CALL: "tool_call",
  SPECIALIST_RESULT: "specialist_result",
  APPROVAL_REQUESTED: "approval_requested",
  HUMAN_DECISION: "human_decision",
  RUN_COMPLETED: "run_completed",
  RUN_FAILED: "run_failed",
  CACHE_USAGE: "cache_usage",
  CACHE_PREFIX_SIZE: "cache_prefix_size",
  CACHE_PREWARM: "cache_prewarm",
} as const;

export type LogEvent = (typeof LOG_EVENTS)[keyof typeof LOG_EVENTS];

export const RUN_KINDS = {
  TRIAGE: "triage",
  RESUME: "resume",
} as const;

export type RunKind = (typeof RUN_KINDS)[keyof typeof RUN_KINDS];

export interface RunContext {
  runId: string;
  shipmentId: string;
  kind: RunKind;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: LogEvent;
  message: string;
  runId?: string;
  shipmentId?: string;
  kind?: RunKind;
  data?: unknown;
}

interface LogInput {
  level?: LogLevel;
  event: LogEvent;
  message: string;
  data?: unknown;
  context?: RunContext;
}

const runContextStorage = new AsyncLocalStorage<RunContext>();

mkdirSync(LOG_DIR, { recursive: true });

export function withRunContext<T>(context: RunContext, fn: () => Promise<T>): Promise<T> {
  const result = runContextStorage.run(context, fn);

  return result;
}

export function log(input: LogInput): void {
  const context = input.context ?? runContextStorage.getStore();
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level: input.level ?? LOG_LEVELS.INFO,
    event: input.event,
    message: input.message,
    runId: context?.runId,
    shipmentId: context?.shipmentId,
    kind: context?.kind,
    data: input.data,
  };

  appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`);
  console.log(`[${entry.event}] ${entry.message}`);
}
