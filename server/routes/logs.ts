import { Hono } from "hono";
import { DEFAULT_LOG_LIMIT, MAX_LOG_LIMIT, readLogs, type LogQuery } from "../../stores/log-store.ts";

export const logsRoute = new Hono();

function parseLimit(rawLimit: string | undefined): number {
  const requested = Number(rawLimit);

  if (!Number.isInteger(requested) || requested <= 0) {
    return DEFAULT_LOG_LIMIT;
  }

  const limit = Math.min(requested, MAX_LOG_LIMIT);

  return limit;
}

logsRoute.get("/", (c) => {
  const query: LogQuery = {
    shipmentId: c.req.query("shipmentId") || undefined,
    level: c.req.query("level") || undefined,
    event: c.req.query("event") || undefined,
    limit: parseLimit(c.req.query("limit")),
  };
  const logs = readLogs(query);

  return c.json(logs);
});
