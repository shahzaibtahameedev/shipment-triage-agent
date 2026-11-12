import { existsSync, readFileSync } from "node:fs";
import { LOG_FILE, type LogEntry } from "../logger.ts";

export const DEFAULT_LOG_LIMIT = 1000;
export const MAX_LOG_LIMIT = 5000;

export interface LogQuery {
  shipmentId?: string;
  level?: string;
  event?: string;
  limit: number;
}

function parseLine(line: string): LogEntry | undefined {
  try {
    const entry = JSON.parse(line) as LogEntry;

    return entry;
  } catch {
    return undefined;
  }
}

function matchesQuery(entry: LogEntry, query: LogQuery): boolean {
  const matchesShipment = !query.shipmentId || entry.shipmentId === query.shipmentId;
  const matchesLevel = !query.level || entry.level === query.level;
  const matchesEvent = !query.event || entry.event === query.event;
  const matches = matchesShipment && matchesLevel && matchesEvent;

  return matches;
}

export function readLogs(query: LogQuery): LogEntry[] {
  if (!existsSync(LOG_FILE)) {
    return [];
  }

  const entries: LogEntry[] = [];
  const lines = readFileSync(LOG_FILE, "utf-8").split("\n");

  for (const line of lines) {
    const entry = line.trim() ? parseLine(line) : undefined;
    if (entry && matchesQuery(entry, query)) {
      entries.push(entry);
    }
  }
  const newestFirst = entries.reverse().slice(0, query.limit);

  return newestFirst;
}
