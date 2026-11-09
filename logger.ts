import { appendFileSync } from "node:fs";
import { format } from "node:util";

const LOG_FILE = new URL("./log.txt", import.meta.url);

export function log(...parts: unknown[]): void {
  appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${format(...parts)}\n`);
}
