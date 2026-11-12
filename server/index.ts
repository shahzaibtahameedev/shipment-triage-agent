import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { startTracing, stopTracing } from "../tracing.ts";
import { closeGraph } from "../triage-runner.ts";
import { handleApiError, notFound, requireLocalHost } from "./http.ts";
import { logsRoute } from "./routes/logs.ts";
import { promptsRoute } from "./routes/prompts.ts";
import { runsRoute } from "./routes/runs.ts";
import { shipmentsRoute } from "./routes/shipments.ts";
import { testShipmentsRoute } from "./routes/test-shipments.ts";

const DEFAULT_PORT = 3001;
const PORT = Number(process.env.API_PORT ?? DEFAULT_PORT);

const DEFAULT_HOST = "127.0.0.1";
const HOST = process.env.API_HOST ?? DEFAULT_HOST;
const WEB_DIST_DIR = "web/dist/web/browser";
const SPA_INDEX_FILE = `${WEB_DIST_DIR}/index.html`;

const app = new Hono();

app.use("/api/*", requireLocalHost);
app.route("/api/shipments", shipmentsRoute);
app.route("/api/test-shipments", testShipmentsRoute);
app.route("/api/runs", runsRoute);
app.route("/api/logs", logsRoute);
app.route("/api/prompts", promptsRoute);
app.all("/api/*", (c) => {
  throw notFound(`No API route for ${c.req.method} ${c.req.path}`);
});

if (existsSync(WEB_DIST_DIR)) {
  app.use("*", serveStatic({ root: WEB_DIST_DIR }));
  app.get("*", serveStatic({ path: SPA_INDEX_FILE }));
}

app.onError(handleApiError);

startTracing();
const server = serve({ fetch: app.fetch, port: PORT, hostname: HOST }, (info) => {
  console.log(`API listening on http://${HOST}:${info.port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await closeGraph();
  await stopTracing();
  process.exit(0);
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
