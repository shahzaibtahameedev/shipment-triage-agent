import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const FIXTURES_DIR = new URL("../fixtures/", import.meta.url);
const TEMP_FILE_SUFFIX = ".tmp";
const JSON_INDENT = 2;

export function fixtureUrl(fileName: string): URL {
  const url = new URL(fileName, FIXTURES_DIR);

  return url;
}

export function readJson<T>(fileUrl: URL, fallback: T): T {
  if (!existsSync(fileUrl)) {
    return fallback;
  }

  const parsed = JSON.parse(readFileSync(fileUrl, "utf-8")) as T;

  return parsed;
}

export function writeJson(fileUrl: URL, data: unknown): void {
  const tempUrl = new URL(`${fileUrl.href}${TEMP_FILE_SUFFIX}`);
  writeFileSync(tempUrl, `${JSON.stringify(data, null, JSON_INDENT)}\n`);
  renameSync(tempUrl, fileUrl);
}

export function normalizeShipmentId(shipmentId: string): string {
  const normalized = String(shipmentId ?? "").trim().toUpperCase();

  return normalized;
}
